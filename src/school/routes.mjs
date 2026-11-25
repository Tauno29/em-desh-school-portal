// Application API for the learner portal, admin dashboard and gallery.
// Identity is application-owned: admin from the ADMIN_CODE secret, learners from
// student ID + school-issued PIN. No platform user context is used.
import {
  clearCookie, constantTimeEqualStrings, hashSecret, newPin, newSessionToken,
  readBearerToken, readCookie, sessionCookie, sha256Hex, verifyAgainstDummy, verifySecret,
} from './security.mjs';
import { verifyUploadedObject } from './storage-validation.mjs';

const ADMIN_COOKIE = '__Host-omps_admin';
const LEARNER_COOKIE = '__Host-omps_portal';
const ADMIN_SESSION_MS = 365 * 24 * 60 * 60 * 1000;
const LEARNER_SESSION_MS = 8 * 60 * 60 * 1000;
const ADMIN_THROTTLE_WINDOW_MS = 60 * 1000;
const ADMIN_THROTTLE_MAX_ATTEMPTS = 5;
const LEARNER_THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const LEARNER_THROTTLE_MAX_ATTEMPTS = 10;
const MAX_BODY_BYTES = 16384;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const REPORT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_REPORT_BYTES = 10 * 1024 * 1024;
const APPLICATION_STATUSES = ['new', 'contacted', 'archived'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// EDPS is the current prefix; OMPS IDs issued before the 2026 rename stay valid.
const STUDENT_ID = /^(?:EDPS|OMPS)-\d{4}-\d{3,6}$/;
const PIN = /^\d{6}$/;

export function application({ db, storage, BackendError, env }) {
  const fail = (code, status) => { throw new BackendError(code, status); };

  const rows = (result) => {
    if (!result || result.error || !Array.isArray(result.data)) fail('database_unavailable', 503);
    return result.data;
  };

  const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  });

  async function readJson(request, maxBytes = MAX_BODY_BYTES) {
    const reader = request.body?.getReader();
    if (!reader) fail('invalid_input', 400);
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel().catch(() => {});
          fail('payload_too_large', 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      const text = new TextDecoder('utf-8').decode(bytes);
      const params = new URLSearchParams(text);
      if ([...params.keys()].length > 0) return Object.fromEntries(params);
      console.log('read-json-failed', `type=${request.headers.get('content-type') ?? 'none'}`, `bytes=${size}`);
      fail('invalid_input', 400);
    }
  }

  // Browser requests arrive through the hosting gateway, so the public origin
  // differs from the internal request URL, and the gateway does not forward the
  // public host. The owner-fixed suffix survives site renames, so accept any
  // https host under it plus externally forwarded hosts, never arbitrary origins.
  const SITE_HOST_SUFFIX = env.get('SITE_HOST_SUFFIX') || '-wx7u4fclyzp.qoder.website';
  const PUBLIC_SITE_ORIGIN = env.get('PUBLIC_SITE_ORIGIN')?.replace(/\/$/, '').toLowerCase();

  function isPublishedSiteOrigin(origin) {
    if (PUBLIC_SITE_ORIGIN && origin === PUBLIC_SITE_ORIGIN) return true;
    try {
      const url = new URL(origin);
      return url.protocol === 'https:'
        && url.host.endsWith(SITE_HOST_SUFFIX)
        && url.host.length > SITE_HOST_SUFFIX.length;
    } catch {
      return false;
    }
  }

  function trustedOrigins(request) {
    const origins = new Set();
    const protocols = new Set(['https', 'http']);
    const forwardedProto = request.headers.get('x-forwarded-proto');
    if (forwardedProto) {
      for (const part of forwardedProto.split(',')) {
        const value = part.trim().toLowerCase();
        if (value === 'http' || value === 'https') protocols.add(value);
      }
    }
    try {
      const url = new URL(request.url);
      origins.add(url.origin);
      for (const protocol of protocols) origins.add(`${protocol}://${url.host}`);
    } catch { /* invalid request URL is handled by the route match */ }
    for (const name of ['x-forwarded-host', 'x-original-host', 'host']) {
      const header = request.headers.get(name);
      if (!header) continue;
      for (const part of header.split(',')) {
        const host = part.trim().toLowerCase();
        if (!/^[a-z0-9.:[\]-]+$/.test(host)) continue;
        for (const protocol of protocols) origins.add(`${protocol}://${host}`);
      }
    }
    return origins;
  }

  function requireTrustedOrigin(request) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    const origin = request.headers.get('origin');
    if (!origin) return;
    const fetchSite = request.headers.get('sec-fetch-site');
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') fail('origin_forbidden', 403);
    // Published browsers send the public origin while the hosting gateway
    // rebases the request URL to the internal container host. The browser's
    // same-origin metadata is the reliable signal in that setup.
    if (fetchSite === 'same-origin') return;
    const normalized = origin.trim().toLowerCase();
    if (isPublishedSiteOrigin(normalized)) return;
    for (const candidate of trustedOrigins(request)) {
      if (normalized === candidate) return;
    }
    fail('origin_forbidden', 403);
  }

  const clean = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

  // Accept the value from the select ("4") and the labels people actually type ("Grade 4").
  function normalizeGrade(value) {
    const text = clean(value, 20).toLowerCase();
    if (!text) return null;
    if (['kg', 'k', 'kindergarten', 'pre-primary', 'preprimary'].includes(text)) return 'KG';
    const match = /^(?:grade\s*)?([1-7])$/.exec(text);
    return match ? match[1] : null;
  }

  function field(body, name, { min = 0, max = 100 } = {}) {
    const value = clean(body[name], max);
    if (value.length < min) fail('invalid_input', 400);
    return value;
  }

  function optionalField(body, name, max) {
    if (body[name] === undefined || body[name] === null) return undefined;
    if (typeof body[name] !== 'string') fail('invalid_input', 400);
    return clean(body[name], max);
  }

  // ---- sessions -------------------------------------------------------------

  async function createSession(role, learnerId, ttlMs) {
    const token = newSessionToken();
    const digest = await sha256Hex(token);
    const result = await db.from('sessions').insert({
      token_hash: digest,
      role,
      learner_id: learnerId ?? null,
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
      created_at: new Date().toISOString(),
    }).select('token_hash');
    if (result.error) fail('session_unavailable', 503);
    return token;
  }

  async function findSession(request, cookieName, role) {
    // Prefer explicitly attached tokens over the cookie, which may belong to an
    // older session after a re-login in a cookie-blocked preview.
    let token = readBearerToken(request);
    if (!token) {
      try {
        const candidate = new URL(request.url).searchParams.get('s');
        if (candidate && /^[A-Za-z0-9_-]{43}$/.test(candidate)) token = candidate;
      } catch { /* route matching already validated the URL */ }
    }
    if (!token) token = readCookie(request, cookieName);
    if (!token) return null;
    const digest = await sha256Hex(token);
    const found = rows(await db.from('sessions')
      .select('token_hash,role,learner_id,expires_at').eq('token_hash', digest).limit(1));
    if (found.length !== 1) return null;
    const session = found[0];
    if (session.role !== role) return null;
    const expires = Date.parse(session.expires_at);
    if (!Number.isFinite(expires) || expires <= Date.now()) {
      await db.from('sessions').delete().eq('token_hash', digest);
      return null;
    }
    return { digest, learnerId: session.learner_id };
  }

  async function dropSession(digest) {
    const result = await db.from('sessions').delete().eq('token_hash', digest).select('token_hash');
    if (result.error) fail('database_unavailable', 503);
  }

  async function loadLearner(id) {
    const found = rows(await db.from('learners')
      .select('id,student_id,first_name,last_name,grade,class_name,guardian_name,guardian_phone,status,pin_hash,created_at,updated_at')
      .eq('id', id).limit(1));
    return found[0] ?? null;
  }

  async function requireAdmin(request) {
    const session = await findSession(request, ADMIN_COOKIE, 'admin');
    if (!session) fail('login_required', 401);
    return session;
  }

  async function requireLearner(request) {
    const session = await findSession(request, LEARNER_COOKIE, 'learner');
    if (!session) fail('login_required', 401);
    const learner = await loadLearner(session.learnerId);
    if (!learner || learner.status !== 'active') fail('login_required', 401);
    return { session, learner };
  }

  // ---- login throttling -----------------------------------------------------

  async function consumeAttempt(throttleKey, { windowMs, maxAttempts }) {
    const now = Date.now();
    const found = rows(await db.from('login_throttle')
      .select('throttle_key,failed_attempts,locked_until').eq('throttle_key', throttleKey).limit(1));

    if (found.length === 0) {
      const created = await db.from('login_throttle').insert({
        throttle_key: throttleKey,
        failed_attempts: 1,
        locked_until: new Date(now + windowMs).toISOString(),
        updated_at: new Date(now).toISOString(),
      }).select('throttle_key');
      if (created.error) fail('database_unavailable', 503);
      return;
    }

    const row = found[0];
    const count = row.failed_attempts;
    const windowEnd = Date.parse(row.locked_until);
    if (!Number.isSafeInteger(count) || !Number.isFinite(windowEnd)) fail('database_unavailable', 503);

    if (now >= windowEnd) {
      const reset = await db.from('login_throttle').update({
        failed_attempts: 1,
        locked_until: new Date(now + windowMs).toISOString(),
        updated_at: new Date(now).toISOString(),
      }).eq('throttle_key', throttleKey).select('throttle_key');
      if (reset.error) fail('database_unavailable', 503);
      return;
    }

    if (count >= maxAttempts) fail('too_many_attempts', 429);

    const updated = await db.from('login_throttle')
      .update({
        failed_attempts: count + 1,
        locked_until: count + 1 >= maxAttempts
          ? new Date(now + windowMs).toISOString()
          : row.locked_until,
        updated_at: new Date(now).toISOString(),
      })
      .eq('throttle_key', throttleKey).select('throttle_key');
    if (updated.error) fail('database_unavailable', 503);
  }

  async function clearAttempts(throttleKey) {
    await db.from('login_throttle').delete().eq('throttle_key', throttleKey);
  }

  // ---- applications ---------------------------------------------------------

  function clientAddress(request) {
    for (const name of ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip']) {
      const value = request.headers.get(name);
      const first = value?.split(',')[0]?.trim();
      if (first) return first;
    }
    return 'unknown';
  }

  const adminApplication = (row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    grade: row.grade,
    fatherName: row.father_name ?? '',
    fatherPhone: row.father_phone ?? '',
    fatherOccupation: row.father_occupation ?? '',
    motherName: row.mother_name ?? '',
    motherPhone: row.mother_phone ?? '',
    motherOccupation: row.mother_occupation ?? '',
    guardianName: row.guardian_name,
    guardianEmail: row.guardian_email,
    guardianPhone: row.guardian_phone,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const APPLICATION_COLUMNS = 'id,first_name,last_name,grade,father_name,father_phone,father_occupation,mother_name,mother_phone,mother_occupation,guardian_name,guardian_email,guardian_phone,message,status,created_at,updated_at';

  // Optional email delivery: the owner adds the Web3Forms access key in Site
  // Settings. The destination inbox is fixed by that key, never by this code.
  async function notifyApplication(application) {
    const accessKey = env.get('WEB3FORMS_ACCESS_KEY');
    if (!accessKey) return;
    const grade = application.grade === 'KG' ? 'Kindergarten' : `Grade ${application.grade}`;
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          access_key: accessKey,
          subject: `New application: ${application.firstName} ${application.lastName} (${grade})`,
          from_name: 'Em-Desh school website',
          'Learner': `${application.firstName} ${application.lastName}`,
          'Grade applying for': grade,
          'Father': application.fatherName
            ? `${application.fatherName}${application.fatherOccupation ? `, ${application.fatherOccupation}` : ''} (${application.fatherPhone || 'no phone'})`
            : '—',
          'Mother': application.motherName
            ? `${application.motherName}${application.motherOccupation ? `, ${application.motherOccupation}` : ''} (${application.motherPhone || 'no phone'})`
            : '—',
          'Guardian': application.guardianName,
          'Guardian email': application.guardianEmail || '—',
          'Guardian phone': application.guardianPhone || '—',
          'Message': application.message || '—',
        }),
      });
      if (!response.ok) console.log('apply-email-failed', `status=${response.status}`);
    } catch (error) {
      console.log('apply-email-failed', error?.name ?? 'error');
    }
  }

  // ---- learners -------------------------------------------------------------

  const publicLearner = (row) => ({
    studentId: row.student_id,
    firstName: row.first_name,
    lastName: row.last_name,
    grade: row.grade,
    className: row.class_name ?? '',
    status: row.status,
    guardianName: row.guardian_name,
    guardianPhone: row.guardian_phone,
    enrolledAt: row.created_at,
  });

  const adminLearner = (row) => ({
    id: row.id,
    ...publicLearner(row),
    updatedAt: row.updated_at,
  });

  const ADMIN_COLUMNS = 'id,student_id,first_name,last_name,grade,class_name,guardian_name,guardian_phone,status,created_at,updated_at';

  async function nextStudentId() {
    const year = new Date().getUTCFullYear();
    const prefix = `EDPS-${year}-`;
    // The platform rejects oversized page requests; recent rows hold the highest sequence.
    const recent = rows(await db.from('learners')
      .select('student_id')
      .order('created_at', { ascending: false })
      .limit(500));
    let highest = 0;
    for (const row of recent) {
      if (typeof row.student_id !== 'string' || !row.student_id.startsWith(prefix)) continue;
      const sequence = Number(row.student_id.slice(prefix.length));
      if (Number.isSafeInteger(sequence) && sequence > highest) highest = sequence;
    }
    return { prefix, highest };
  }

  async function registerLearner(input) {
    const pinHash = await hashSecret(input.pin);
    const { prefix, highest } = await nextStudentId();

    for (let offset = 1; offset <= 10; offset += 1) {
      const studentId = `${prefix}${String(highest + offset).padStart(3, '0')}`;
      const result = await db.from('learners').insert({
        student_id: studentId,
        first_name: input.firstName,
        last_name: input.lastName,
        grade: input.grade,
        class_name: input.className,
        guardian_name: input.guardianName,
        guardian_phone: input.guardianPhone,
        status: 'active',
        pin_hash: pinHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select(ADMIN_COLUMNS);
      if (!result.error && Array.isArray(result.data) && result.data.length === 1) return result.data[0];
      const message = String(result.error?.message ?? '');
      if (!message.includes('duplicate') && result.error?.code !== '23505') fail('database_unavailable', 503);
    }
    fail('student_id_unavailable', 409);
  }

  // ---- learner records ------------------------------------------------------

  const behaviorItem = (row) => ({
    id: row.id,
    note: row.note,
    recordedOn: row.recorded_on,
    createdAt: row.created_at,
  });

  const testItem = (row) => ({
    id: row.id,
    subject: row.subject,
    score: row.score,
    term: row.term,
    recordedOn: row.recorded_on,
    createdAt: row.created_at,
  });

  async function signedReportCards(found) {
    return Promise.all(found.map(async (row) => {
      let url = null;
      if (row.status === 'ready') {
        try {
          const signed = await storage.createSignedUrl(row.object_path, 3600);
          if (signed?.signedUrl) url = signed.signedUrl;
        } catch {
          url = null;
        }
      }
      return {
        id: row.id,
        fileName: row.file_name,
        term: row.term,
        contentType: row.content_type,
        sizeBytes: row.size_bytes,
        status: row.status,
        createdAt: row.created_at,
        url,
      };
    }));
  }

  function recordedAt(value) {
    if (value === undefined || value === null || value === '') return new Date().toISOString();
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('invalid_input', 400);
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) fail('invalid_input', 400);
    return parsed.toISOString();
  }

  async function learnerRecords(learnerId) {
    const behavior = rows(await db.from('behavior_records')
      .select('id,note,recorded_on,created_at').eq('learner_id', learnerId)
      .order('recorded_on', { ascending: false }).limit(200)).map(behaviorItem);
    const tests = rows(await db.from('test_results')
      .select('id,subject,score,term,recorded_on,created_at').eq('learner_id', learnerId)
      .order('recorded_on', { ascending: false }).limit(200)).map(testItem);
    const reportCards = await signedReportCards(rows(await db.from('report_cards')
      .select('id,object_path,file_name,content_type,size_bytes,term,status,created_at')
      .eq('learner_id', learnerId).order('created_at', { ascending: false }).limit(100)));
    return { behavior, tests, reportCards };
  }

  async function requireLearnerById(id) {
    if (!UUID.test(id)) fail('not_found', 404);
    const learner = await loadLearner(id);
    if (!learner) fail('not_found', 404);
    return learner;
  }

  // ---- gallery --------------------------------------------------------------

  function signedImage(row, url) {
    return { id: row.id, caption: row.caption, url, createdAt: row.created_at };
  }

  async function viewableImages(limit) {
    const found = rows(await db.from('gallery_images')
      .select('id,caption,object_path,created_at,status,homepage_role')
      .eq('status', 'ready').or('homepage_role.is.null,homepage_role.eq.gallery')
      .order('created_at', { ascending: false }).limit(limit));
    const signed = await Promise.allSettled(found.map(async (row) => {
      const result = await storage.createSignedUrl(row.object_path, 3600);
      if (!result?.signedUrl) throw new Error('sign_failed');
      return signedImage(row, result.signedUrl);
    }));
    return signed.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value);
  }

  async function adminGallery() {
    const found = rows(await db.from('gallery_images')
      .select('id,caption,object_path,content_type,size_bytes,status,homepage_role,homepage_order,created_at')
      .order('created_at', { ascending: false }).limit(100));
    return Promise.all(found.map(async (row) => {
      let url = null;
      if (row.status === 'ready') {
        try {
          const signed = await storage.createSignedUrl(row.object_path, 3600);
          if (signed?.signedUrl) url = signed.signedUrl;
        } catch {
          url = null;
        }
      }
      return {
        id: row.id,
        caption: row.caption,
        status: row.status,
        sizeBytes: row.size_bytes,
        contentType: row.content_type,
        homepageRole: row.homepage_role || 'gallery',
        homepageOrder: Number(row.homepage_order) || 0,
        createdAt: row.created_at,
        url,
      };
    }));
  }

  const DEFAULT_SETTINGS = {
    notificationEnabled: false,
    notificationText: '',
    notificationLinkText: '',
    notificationLinkUrl: '',
  };

  async function readSetting(settingKey) {
    const found = rows(await db.from('site_settings').select('setting_value').eq('setting_key', settingKey).limit(1));
    return found[0]?.setting_value || '';
  }

  async function writeSetting(settingKey, settingValue) {
    const existing = rows(await db.from('site_settings').select('setting_key').eq('setting_key', settingKey).limit(1));
    const payload = { setting_value: settingValue, updated_at: new Date().toISOString() };
    const result = existing.length
      ? await db.from('site_settings').update(payload).eq('setting_key', settingKey).select('setting_key')
      : await db.from('site_settings').insert({ setting_key: settingKey, ...payload }).select('setting_key');
    if (result.error) fail('database_unavailable', 503);
  }

  async function readSiteSettings() {
    const found = rows(await db.from('site_settings').select('setting_key,setting_value').limit(50));
    const values = { ...DEFAULT_SETTINGS };
    for (const row of found) {
      if (row.setting_key === 'notificationEnabled') values.notificationEnabled = row.setting_value === 'true';
      if (row.setting_key === 'notificationText') values.notificationText = row.setting_value || '';
      if (row.setting_key === 'notificationLinkText') values.notificationLinkText = row.setting_value || '';
      if (row.setting_key === 'notificationLinkUrl') values.notificationLinkUrl = row.setting_value || '';
    }
    return values;
  }

  async function signedWelcomeVideo() {
    const objectPath = await readSetting('welcomeVideoPath');
    if (!objectPath) return null;
    try {
      const signed = await storage.createSignedUrl(objectPath, 3600);
      return signed?.signedUrl
        ? { url: signed.signedUrl, contentType: await readSetting('welcomeVideoContentType') || 'video/mp4' }
        : null;
    } catch {
      return null;
    }
  }

  async function signedHomepageImages() {
    const found = rows(await db.from('gallery_images')
      .select('id,caption,object_path,created_at,homepage_role,homepage_order,status')
      .eq('status', 'ready').neq('homepage_role', 'gallery').order('homepage_order', { ascending: true }).limit(12));
    const signed = await Promise.allSettled(found.map(async (row) => {
      const result = await storage.createSignedUrl(row.object_path, 3600);
      if (!result?.signedUrl) throw new Error('sign_failed');
      return { id: row.id, caption: row.caption, role: row.homepage_role, url: result.signedUrl, createdAt: row.created_at };
    }));
    return signed.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value);
  }

  async function replaceHomepageHero(exceptId = null) {
    let query = db.from('gallery_images').update({ homepage_role: 'gallery' }).eq('homepage_role', 'hero');
    if (exceptId) query = query.neq('id', exceptId);
    const result = await query;
    if (result.error) fail('database_unavailable', 503);
  }

  // ---- routes ---------------------------------------------------------------

  async function route(request) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/(?:\.netlify\/functions\/|functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/);
    if (!match) fail('not_found', 404);
    const path = match[1] || '/';
    const method = request.method;
    const is = (...allowed) => allowed.includes(method);

    requireTrustedOrigin(request);

    if (path === '/api/health' && is('GET')) return json({ ok: true });

    if (path === '/api/gallery' && is('GET')) {
      return json({ ok: true, items: await viewableImages(60) });
    }

    if (path === '/api/homepage' && is('GET')) {
      const items = await signedHomepageImages();
      return json({
        ok: true,
        settings: await readSiteSettings(),
        welcomeVideo: await signedWelcomeVideo(),
        hero: items.find((item) => item.role === 'hero') ?? null,
        news: items.filter((item) => item.role === 'news').slice(0, 8),
      });
    }

    if (path === '/api/apply' && is('POST')) {
      const raw = await readJson(request, 4096);
      const body = raw && typeof raw === 'object' ? raw : {};
      // Hidden honeypot field: real visitors never fill it.
      if (clean(body.website, 40)) return json({ ok: true }, 201);
      const firstName = clean(body.firstName, 80);
      const lastName = clean(body.lastName, 80);
      const grade = normalizeGrade(body.grade);
      const fatherName = clean(body.fatherName, 100);
      const fatherPhone = clean(body.fatherPhone, 40);
      const fatherOccupation = clean(body.fatherOccupation, 100);
      const motherName = clean(body.motherName, 100);
      const motherPhone = clean(body.motherPhone, 40);
      const motherOccupation = clean(body.motherOccupation, 100);
      const guardianName = clean(body.guardianName, 100);
      const guardianEmail = clean(body.guardianEmail, 120);
      const guardianPhone = clean(body.guardianPhone, 40);
      const message = clean(body.message, 1000);
      if (!firstName) fail('first_name_required', 400);
      if (!lastName) fail('last_name_required', 400);
      if (!grade) fail('grade_invalid', 400);
      if (!guardianName) fail('guardian_required', 400);
      if (!guardianEmail && !guardianPhone) fail('contact_required', 400);
      if (guardianEmail && !EMAIL.test(guardianEmail)) fail('email_invalid', 400);
      if (body.consent !== true) fail('consent_required', 400);

      await consumeAttempt(`apply:${await sha256Hex(clientAddress(request))}`, {
        windowMs: LEARNER_THROTTLE_WINDOW_MS,
        maxAttempts: LEARNER_THROTTLE_MAX_ATTEMPTS,
      });
      const inserted = await db.from('applications').insert({
        first_name: firstName,
        last_name: lastName,
        grade,
        father_name: fatherName,
        father_phone: fatherPhone,
        father_occupation: fatherOccupation,
        mother_name: motherName,
        mother_phone: motherPhone,
        mother_occupation: motherOccupation,
        guardian_name: guardianName,
        guardian_email: guardianEmail,
        guardian_phone: guardianPhone,
        message,
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select('id');
      if (inserted.error || !inserted.data?.length) fail('database_unavailable', 503);
      await notifyApplication({
        firstName, lastName, grade,
        fatherName, fatherPhone, fatherOccupation,
        motherName, motherPhone, motherOccupation,
        guardianName, guardianEmail, guardianPhone, message,
      });
      console.log('application-received');
      return json({ ok: true }, 201);
    }

    if (path === '/api/admin/login' && is('POST')) {
      if (!env.get('ADMIN_CODE')) fail('service_not_configured', 503);
      const body = await readJson(request, 2048);
      const code = typeof body.code === 'string' ? body.code : '';
      if (!/^\d{6}$/.test(code)) fail('invalid_credentials', 401);
      await consumeAttempt('admin', {
        windowMs: ADMIN_THROTTLE_WINDOW_MS,
        maxAttempts: ADMIN_THROTTLE_MAX_ATTEMPTS,
      });
      const configured = env.get('ADMIN_CODE') ?? '';
      const matches = constantTimeEqualStrings(await sha256Hex(code), await sha256Hex(configured));
      if (!matches) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        fail('invalid_credentials', 401);
      }
      await clearAttempts('admin');
      const token = await createSession('admin', null, ADMIN_SESSION_MS);
      return json({ ok: true, token }, 200, { 'set-cookie': sessionCookie(ADMIN_COOKIE, token, ADMIN_SESSION_MS / 1000) });
    }

    if (path === '/api/admin/logout' && is('POST')) {
      const session = await findSession(request, ADMIN_COOKIE, 'admin');
      if (session) await dropSession(session.digest);
      return json({ ok: true }, 200, { 'set-cookie': clearCookie(ADMIN_COOKIE) });
    }

    if (path === '/api/admin/me' && is('GET')) {
      await requireAdmin(request);
      return json({ ok: true, role: 'admin' });
    }

    if (path === '/api/admin/learners' && is('GET')) {
      await requireAdmin(request);
      const items = rows(await db.from('learners')
        .select(ADMIN_COLUMNS).order('created_at', { ascending: false }).limit(500)).map(adminLearner);
      return json({
        ok: true,
        items,
        counts: {
          total: items.length,
          active: items.filter((item) => item.status === 'active').length,
          inactive: items.filter((item) => item.status !== 'active').length,
        },
      });
    }

    if (path === '/api/admin/learners' && is('POST')) {
      await requireAdmin(request);
      const body = await readJson(request);
      const firstName = clean(body?.firstName, 80);
      const lastName = clean(body?.lastName, 80);
      const grade = normalizeGrade(body?.grade);
      if (!firstName || !lastName || !grade) {
        console.log('learner-reject', JSON.stringify({
          keys: body && typeof body === 'object' ? Object.keys(body).join(',') : typeof body,
          grade: typeof body?.grade === 'string' ? body.grade.slice(0, 20) : null,
          contentType: request.headers.get('content-type') ?? null,
        }));
      }
      if (!firstName) fail('first_name_required', 400);
      if (!lastName) fail('last_name_required', 400);
      if (!grade) fail('grade_invalid', 400);
      const className = clean(body?.className, 20);
      const guardianName = field(body, 'guardianName', { max: 100 });
      const guardianPhone = field(body, 'guardianPhone', { max: 40 });
      const pin = newPin();
      const created = await registerLearner({
        firstName, lastName, grade, className, guardianName, guardianPhone, pin,
      });
      console.log('learner-created', created.student_id);
      return json({ ok: true, learner: adminLearner(created), pin }, 201);
    }

    if (path === '/api/admin/learners/bulk-delete' && is('DELETE')) {
      await requireAdmin(request);
      const body = await readJson(request, 1024);
      if (body?.confirmation !== 'delete all learners') fail('delete_confirmation_required', 400);

      const learnerRows = rows(await db.from('learners').select('id').limit(5000));
      const reportCards = rows(await db.from('report_cards').select('object_path').limit(5000));
      if (reportCards.length) {
        try {
          await storage.remove(reportCards.map((card) => card.object_path));
        } catch {
          fail('storage_unavailable', 503);
        }
      }
      for (const [table, column] of [['report_cards', 'id'], ['test_results', 'id'], ['behavior_records', 'id'], ['sessions', 'token_hash'], ['learners', 'id']]) {
        const removed = await db.from(table).delete().select(column);
        if (removed.error) fail('database_unavailable', 503);
      }
      console.log('learners-bulk-deleted', learnerRows.length);
      return json({ ok: true, deleted: learnerRows.length });
    }

    const learnerMatch = path.match(/^\/api\/admin\/learners\/([0-9a-f-]{36})$/);
    if (learnerMatch && is('PATCH')) {
      await requireAdmin(request);
      const id = learnerMatch[1];
      if (!UUID.test(id)) fail('not_found', 404);
      const existing = await loadLearner(id);
      if (!existing) fail('not_found', 404);

      const body = await readJson(request);
      const changes = { updated_at: new Date().toISOString() };
      const firstName = optionalField(body, 'firstName', 80);
      const lastName = optionalField(body, 'lastName', 80);
      const className = optionalField(body, 'className', 20);
      const guardianName = optionalField(body, 'guardianName', 100);
      const guardianPhone = optionalField(body, 'guardianPhone', 40);
      if (firstName !== undefined) { if (!firstName) fail('invalid_input', 400); changes.first_name = firstName; }
      if (lastName !== undefined) { if (!lastName) fail('invalid_input', 400); changes.last_name = lastName; }
      if (className !== undefined) changes.class_name = className;
      if (guardianName !== undefined) changes.guardian_name = guardianName;
      if (guardianPhone !== undefined) changes.guardian_phone = guardianPhone;
      if (body.grade !== undefined) {
        const grade = normalizeGrade(body.grade);
        if (!grade) fail('grade_invalid', 400);
        changes.grade = grade;
      }
      if (body.status !== undefined) {
        if (!['active', 'inactive'].includes(body.status)) fail('invalid_input', 400);
        changes.status = body.status;
      }
      const resetPin = body.resetPin === true;
      if (Object.keys(changes).length === 1 && !resetPin) fail('invalid_input', 400);

      let pin;
      if (resetPin) {
        pin = newPin();
        changes.pin_hash = await hashSecret(pin);
      }

      const updated = rows(await db.from('learners').update(changes).eq('id', id).select(ADMIN_COLUMNS));
      if (updated.length !== 1) fail('not_found', 404);

      if (resetPin || changes.status === 'inactive') {
        const dropped = await db.from('sessions').delete().eq('learner_id', id).select('token_hash');
        if (dropped.error) fail('database_unavailable', 503);
      }

      return json({ ok: true, learner: adminLearner(updated[0]), ...(pin ? { pin } : {}) });
    }

    if (learnerMatch && is('DELETE')) {
      await requireAdmin(request);
      const id = learnerMatch[1];
      if (!UUID.test(id)) fail('not_found', 404);
      const existing = await loadLearner(id);
      if (!existing) fail('not_found', 404);

      const cards = rows(await db.from('report_cards')
        .select('id,object_path').eq('learner_id', id).limit(500));
      if (cards.length) {
        try {
          await storage.remove(cards.map((card) => card.object_path));
        } catch {
          fail('storage_unavailable', 503);
        }
      }
      for (const table of ['report_cards', 'test_results', 'behavior_records']) {
        rows(await db.from(table).delete().eq('learner_id', id).select('id'));
      }
      rows(await db.from('sessions').delete().eq('learner_id', id).select('token_hash'));
      rows(await db.from('learners').delete().eq('id', id).select('id'));
      console.log('learner-deleted', existing.student_id);
      return json({ ok: true });
    }

    const recordsMatch = path.match(/^\/api\/admin\/learners\/([0-9a-f-]{36})\/records$/);
    if (recordsMatch && is('GET')) {
      await requireAdmin(request);
      const learner = await requireLearnerById(recordsMatch[1]);
      return json({ ok: true, learner: adminLearner(learner), ...(await learnerRecords(learner.id)) });
    }

    const behaviorMatch = path.match(/^\/api\/admin\/learners\/([0-9a-f-]{36})\/behavior$/);
    if (behaviorMatch && is('POST')) {
      await requireAdmin(request);
      const learner = await requireLearnerById(behaviorMatch[1]);
      const body = await readJson(request, 4096);
      const note = clean(body.note, 500);
      if (!note) fail('invalid_input', 400);
      const created = rows(await db.from('behavior_records').insert({
        learner_id: learner.id,
        note,
        recorded_on: recordedAt(body.recordedOn),
        created_at: new Date().toISOString(),
      }).select('id,note,recorded_on,created_at'));
      if (created.length !== 1) fail('database_unavailable', 503);
      return json({ ok: true, item: behaviorItem(created[0]) }, 201);
    }

    const testsMatch = path.match(/^\/api\/admin\/learners\/([0-9a-f-]{36})\/tests$/);
    if (testsMatch && is('POST')) {
      await requireAdmin(request);
      const learner = await requireLearnerById(testsMatch[1]);
      const body = await readJson(request, 4096);
      const subject = clean(body.subject, 60);
      const term = clean(body.term, 40);
      const score = body.score;
      if (!subject) fail('invalid_input', 400);
      if (!Number.isInteger(score) || score < 0 || score > 100) fail('invalid_input', 400);
      const created = rows(await db.from('test_results').insert({
        learner_id: learner.id,
        subject,
        score,
        term,
        recorded_on: recordedAt(body.recordedOn),
        created_at: new Date().toISOString(),
      }).select('id,subject,score,term,recorded_on,created_at'));
      if (created.length !== 1) fail('database_unavailable', 503);
      return json({ ok: true, item: testItem(created[0]) }, 201);
    }

    const behaviorItemMatch = path.match(/^\/api\/admin\/behavior\/([0-9a-f-]{36})$/);
    if (behaviorItemMatch && is('DELETE')) {
      await requireAdmin(request);
      const deleted = rows(await db.from('behavior_records').delete().eq('id', behaviorItemMatch[1]).select('id'));
      if (deleted.length !== 1) fail('not_found', 404);
      return json({ ok: true });
    }

    const testItemMatch = path.match(/^\/api\/admin\/tests\/([0-9a-f-]{36})$/);
    if (testItemMatch && is('DELETE')) {
      await requireAdmin(request);
      const deleted = rows(await db.from('test_results').delete().eq('id', testItemMatch[1]).select('id'));
      if (deleted.length !== 1) fail('not_found', 404);
      return json({ ok: true });
    }

    const reportIntentMatch = path.match(/^\/api\/admin\/learners\/([0-9a-f-]{36})\/report-cards$/);
    if (reportIntentMatch && is('POST')) {
      await requireAdmin(request);
      const learner = await requireLearnerById(reportIntentMatch[1]);
      const body = await readJson(request, 4096);
      const contentType = typeof body.contentType === 'string' ? body.contentType.toLowerCase() : '';
      const sizeBytes = body.sizeBytes;
      const fileName = clean(body.fileName, 120) || 'Report card';
      const term = clean(body.term, 40);
      if (!REPORT_TYPES.includes(contentType)) fail('unsupported_document_type', 415);
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_REPORT_BYTES) fail('document_too_large', 400);

      const inserted = await db.from('report_cards').insert({
        learner_id: learner.id,
        object_path: `report-cards/${crypto.randomUUID()}`,
        file_name: fileName,
        content_type: contentType,
        size_bytes: sizeBytes,
        term,
        status: 'pending',
        created_at: new Date().toISOString(),
      }).select('id,object_path');
      if (inserted.error || !inserted.data?.length) fail('database_unavailable', 503);
      const row = inserted.data[0];

      const signed = await storage.createSignedUploadUrl(row.object_path, { upsert: false }).catch(() => null);
      if (!signed?.signedUrl) {
        await db.from('report_cards').delete().eq('id', row.id);
        fail('storage_unavailable', 503);
      }
      return json({ ok: true, id: row.id, uploadUrl: signed.signedUrl }, 201);
    }

    const reportCompleteMatch = path.match(/^\/api\/admin\/report-cards\/([0-9a-f-]{36})\/complete$/);
    if (reportCompleteMatch && is('POST')) {
      await requireAdmin(request);
      const id = reportCompleteMatch[1];
      if (!UUID.test(id)) fail('not_found', 404);
      const found = rows(await db.from('report_cards')
        .select('id,object_path,file_name,content_type,size_bytes,term,status,created_at').eq('id', id).limit(1));
      const row = found[0];
      if (!row) fail('not_found', 404);
      if (row.status === 'ready') {
        return json({ ok: true, item: (await signedReportCards([row]))[0] });
      }

      let download;
      try {
        download = await storage.download(row.object_path);
      } catch {
        fail('upload_pending', 409);
      }
      let verified;
      try {
        verified = await verifyUploadedObject(download, {
          maxBytes: MAX_REPORT_BYTES,
          expectedBytes: Number(row.size_bytes),
          allowedContentTypes: REPORT_TYPES,
          timeoutMs: 20000,
        });
      } catch (error) {
        await storage.remove([row.object_path]).catch(() => {});
        await db.from('report_cards').delete().eq('id', id);
        const reason = ['upload_too_large', 'upload_size_mismatch', 'upload_type_mismatch'].includes(error?.message)
          ? 'invalid_upload' : 'upload_unavailable';
        fail(reason, 422);
      }

      const updated = await db.from('report_cards').update({
        status: 'ready', content_type: verified.contentType, size_bytes: verified.size,
      }).eq('id', id).eq('status', 'pending').select('id,status');
      if (updated.error) fail('database_unavailable', 503);

      const refreshed = rows(await db.from('report_cards')
        .select('id,object_path,file_name,content_type,size_bytes,term,status,created_at').eq('id', id).limit(1));
      if (!refreshed.length) {
        await storage.remove([row.object_path]).catch(() => {});
        fail('not_found', 404);
      }
      return json({ ok: true, item: (await signedReportCards(refreshed))[0] });
    }

    const reportCardMatch = path.match(/^\/api\/admin\/report-cards\/([0-9a-f-]{36})$/);
    if (reportCardMatch && is('DELETE')) {
      await requireAdmin(request);
      const id = reportCardMatch[1];
      if (!UUID.test(id)) fail('not_found', 404);
      const found = rows(await db.from('report_cards').select('id,object_path').eq('id', id).limit(1));
      const row = found[0];
      if (!row) fail('not_found', 404);
      try {
        await storage.remove([row.object_path]);
      } catch {
        fail('storage_unavailable', 503);
      }
      const deleted = await db.from('report_cards').delete().eq('id', id).select('id');
      if (deleted.error) fail('database_unavailable', 503);
      return json({ ok: true });
    }

    if (path === '/api/admin/applications' && is('GET')) {
      await requireAdmin(request);
      const items = rows(await db.from('applications')
        .select(APPLICATION_COLUMNS).order('created_at', { ascending: false }).limit(200)).map(adminApplication);
      return json({
        ok: true,
        items,
        counts: {
          total: items.length,
          new: items.filter((item) => item.status === 'new').length,
          contacted: items.filter((item) => item.status === 'contacted').length,
          archived: items.filter((item) => item.status === 'archived').length,
        },
      });
    }

    const applicationMatch = path.match(/^\/api\/admin\/applications\/([0-9a-f-]{36})$/);
    if (applicationMatch && is('PATCH')) {
      await requireAdmin(request);
      const body = await readJson(request, 2048);
      if (!APPLICATION_STATUSES.includes(body.status)) fail('invalid_input', 400);
      const updated = rows(await db.from('applications').update({
        status: body.status,
        updated_at: new Date().toISOString(),
      }).eq('id', applicationMatch[1]).select('id,status'));
      if (updated.length !== 1) fail('not_found', 404);
      return json({ ok: true, status: updated[0].status });
    }

    if (applicationMatch && is('DELETE')) {
      await requireAdmin(request);
      const deleted = rows(await db.from('applications').delete().eq('id', applicationMatch[1]).select('id'));
      if (deleted.length !== 1) fail('not_found', 404);
      return json({ ok: true });
    }

    if (path === '/api/admin/site-settings' && is('GET')) {
      await requireAdmin(request);
      return json({ ok: true, settings: await readSiteSettings() });
    }

    if (path === '/api/admin/site-settings' && is('PATCH')) {
      await requireAdmin(request);
      const body = await readJson(request, 4096);
      const notificationEnabled = body.notificationEnabled === true;
      const notificationText = clean(body.notificationText, 240);
      const notificationLinkText = clean(body.notificationLinkText, 80);
      const notificationLinkUrl = clean(body.notificationLinkUrl, 300);
      if (notificationLinkUrl) {
        try {
          const url = new URL(notificationLinkUrl);
          if (!['http:', 'https:'].includes(url.protocol)) fail('invalid_input', 400);
        } catch { fail('invalid_input', 400); }
      }
      const values = {
        notificationEnabled: String(notificationEnabled),
        notificationText,
        notificationLinkText,
        notificationLinkUrl,
      };
      for (const [settingKey, settingValue] of Object.entries(values)) {
        const existing = rows(await db.from('site_settings').select('setting_key').eq('setting_key', settingKey).limit(1));
        const payload = { setting_value: settingValue, updated_at: new Date().toISOString() };
        const result = existing.length
          ? await db.from('site_settings').update(payload).eq('setting_key', settingKey).select('setting_key')
          : await db.from('site_settings').insert({ setting_key: settingKey, ...payload }).select('setting_key');
        if (result.error) fail('database_unavailable', 503);
      }
      return json({ ok: true, settings: await readSiteSettings() });
    }

    if (path === '/api/admin/welcome-video' && is('GET')) {
      await requireAdmin(request);
      const objectPath = await readSetting('welcomeVideoPath');
      const video = await signedWelcomeVideo();
      return json({ ok: true, configured: Boolean(objectPath && video), video });
    }

    if (path === '/api/admin/welcome-video' && is('POST')) {
      await requireAdmin(request);
      const body = await readJson(request, 2048);
      const contentType = typeof body.contentType === 'string' ? body.contentType.toLowerCase() : '';
      const sizeBytes = body.sizeBytes;
      if (!VIDEO_TYPES.includes(contentType)) fail('unsupported_media_type', 415);
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_VIDEO_BYTES) fail('invalid_input', 400);
      const objectPath = `homepage/welcome-video-${crypto.randomUUID()}`;
      const signed = await storage.createSignedUploadUrl(objectPath, { upsert: false }).catch(() => null);
      if (!signed?.signedUrl) fail('storage_unavailable', 503);
      await writeSetting('welcomeVideoPendingPath', objectPath);
      await writeSetting('welcomeVideoPendingContentType', contentType);
      await writeSetting('welcomeVideoPendingSizeBytes', String(sizeBytes));
      return json({ ok: true, uploadUrl: signed.signedUrl }, 201);
    }

    if (path === '/api/admin/welcome-video/complete' && is('POST')) {
      await requireAdmin(request);
      const objectPath = await readSetting('welcomeVideoPendingPath');
      const contentType = await readSetting('welcomeVideoPendingContentType');
      const expectedBytes = Number(await readSetting('welcomeVideoPendingSizeBytes'));
      if (!objectPath || !VIDEO_TYPES.includes(contentType) || !Number.isSafeInteger(expectedBytes)) fail('upload_pending', 409);
      let download;
      try { download = await storage.download(objectPath); } catch { fail('upload_pending', 409); }
      let verified;
      try {
        verified = await verifyUploadedObject(download, {
          maxBytes: MAX_VIDEO_BYTES,
          expectedBytes,
          allowedContentTypes: VIDEO_TYPES,
          timeoutMs: 30000,
        });
      } catch (error) {
        await storage.remove([objectPath]).catch(() => {});
        const reason = error?.message === 'upload_too_large' || error?.message === 'upload_size_mismatch' || error?.message === 'upload_type_mismatch' ? 'invalid_upload' : 'upload_unavailable';
        fail(reason, 422);
      }
      const previousPath = await readSetting('welcomeVideoPath');
      await writeSetting('welcomeVideoPath', objectPath);
      await writeSetting('welcomeVideoContentType', verified.contentType);
      await writeSetting('welcomeVideoPendingPath', '');
      await writeSetting('welcomeVideoPendingContentType', '');
      await writeSetting('welcomeVideoPendingSizeBytes', '');
      if (previousPath && previousPath !== objectPath) await storage.remove([previousPath]).catch(() => {});
      return json({ ok: true, video: await signedWelcomeVideo() });
    }

    if (path === '/api/admin/gallery' && is('GET')) {
      await requireAdmin(request);
      return json({ ok: true, items: await adminGallery() });
    }

    if (path === '/api/admin/gallery' && is('POST')) {
      await requireAdmin(request);
      const body = await readJson(request, 4096);
      const caption = clean(body.caption, 120);
      const homepageRole = ['gallery', 'news', 'hero'].includes(body.homepageRole) ? body.homepageRole : 'gallery';
      const contentType = typeof body.contentType === 'string' ? body.contentType.toLowerCase() : '';
      const sizeBytes = body.sizeBytes;
      if (!IMAGE_TYPES.includes(contentType)) fail('unsupported_media_type', 415);
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_IMAGE_BYTES) fail('invalid_input', 400);
      if (homepageRole === 'hero') await replaceHomepageHero();

      const inserted = await db.from('gallery_images').insert({
        caption,
        object_path: `gallery/${crypto.randomUUID()}`,
        content_type: contentType,
        size_bytes: sizeBytes,
        status: 'pending',
        homepage_role: homepageRole,
        homepage_order: Number.isSafeInteger(body.homepageOrder) ? Math.max(0, Math.min(99, body.homepageOrder)) : 0,
        created_at: new Date().toISOString(),
      }).select('id,object_path');
      if (inserted.error || !inserted.data?.length) fail('database_unavailable', 503);
      const row = inserted.data[0];

      const signed = await storage.createSignedUploadUrl(row.object_path, { upsert: false }).catch(() => null);
      if (!signed?.signedUrl) {
        await db.from('gallery_images').delete().eq('id', row.id);
        fail('storage_unavailable', 503);
      }
      return json({ ok: true, id: row.id, uploadUrl: signed.signedUrl }, 201);
    }

    const completeMatch = path.match(/^\/api\/admin\/gallery\/([0-9a-f-]{36})\/complete$/);
    if (completeMatch && is('POST')) {
      await requireAdmin(request);
      const id = completeMatch[1];
      if (!UUID.test(id)) fail('not_found', 404);
      const found = rows(await db.from('gallery_images')
        .select('id,caption,object_path,content_type,size_bytes,status,created_at').eq('id', id).limit(1));
      const row = found[0];
      if (!row) fail('not_found', 404);
      if (row.status === 'ready') {
        const signed = await storage.createSignedUrl(row.object_path, 3600).catch(() => null);
        return json({ ok: true, item: signedImage(row, signed?.signedUrl ?? null) });
      }

      let download;
      try {
        download = await storage.download(row.object_path);
      } catch {
        fail('upload_pending', 409);
      }
      let verified;
      try {
        verified = await verifyUploadedObject(download, {
          maxBytes: MAX_IMAGE_BYTES,
          expectedBytes: Number(row.size_bytes),
          allowedContentTypes: IMAGE_TYPES,
          timeoutMs: 15000,
        });
      } catch (error) {
        await storage.remove([row.object_path]).catch(() => {});
        await db.from('gallery_images').delete().eq('id', id);
        const reason = error?.message === 'upload_too_large' || error?.message === 'upload_size_mismatch'
          || error?.message === 'upload_type_mismatch' ? 'invalid_upload' : 'upload_unavailable';
        fail(reason, 422);
      }

      const updated = await db.from('gallery_images').update({
        status: 'ready', content_type: verified.contentType, size_bytes: verified.size,
      }).eq('id', id).eq('status', 'pending').select('id,status');
      if (updated.error) fail('database_unavailable', 503);

      let current = row;
      if (!updated.data?.length) {
        const refreshed = rows(await db.from('gallery_images')
          .select('id,caption,object_path,created_at,status').eq('id', id).limit(1));
        if (!refreshed.length) {
          await storage.remove([row.object_path]).catch(() => {});
          fail('not_found', 404);
        }
        current = refreshed[0];
      }
      const signed = await storage.createSignedUrl(current.object_path, 3600).catch(() => null);
      return json({ ok: true, item: signedImage(current, signed?.signedUrl ?? null) });
    }

    const galleryMatch = path.match(/^\/api\/admin\/gallery\/([0-9a-f-]{36})$/);
    if (galleryMatch && is('PATCH')) {
      await requireAdmin(request);
      const id = galleryMatch[1];
      if (!UUID.test(id)) fail('not_found', 404);
      const body = await readJson(request, 2048);
      const homepageRole = ['gallery', 'news', 'hero'].includes(body.homepageRole) ? body.homepageRole : null;
      if (!homepageRole) fail('invalid_input', 400);
      const homepageOrder = body.homepageOrder === undefined ? 0 : Number(body.homepageOrder);
      if (!Number.isInteger(homepageOrder) || homepageOrder < 0 || homepageOrder > 99) fail('invalid_input', 400);
      if (homepageRole === 'hero') await replaceHomepageHero(id);
      const updated = await db.from('gallery_images').update({ homepage_role: homepageRole, homepage_order: homepageOrder }).eq('id', id).select('id,homepage_role,homepage_order');
      if (updated.error || !updated.data?.length) fail(updated.error ? 'database_unavailable' : 'not_found', updated.error ? 503 : 404);
      return json({ ok: true });
    }
    if (galleryMatch && is('DELETE')) {
      await requireAdmin(request);
      const id = galleryMatch[1];
      if (!UUID.test(id)) fail('not_found', 404);
      const found = rows(await db.from('gallery_images')
        .select('id,object_path').eq('id', id).limit(1));
      const row = found[0];
      if (!row) fail('not_found', 404);
      try {
        await storage.remove([row.object_path]);
      } catch {
        fail('storage_unavailable', 503);
      }
      const deleted = await db.from('gallery_images').delete().eq('id', id).select('id');
      if (deleted.error) fail('database_unavailable', 503);
      return json({ ok: true });
    }

    if (path === '/api/portal/login' && is('POST')) {
      const body = await readJson(request, 2048);
      const studentId = clean(body.studentId, 20).toUpperCase();
      const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
      if (!STUDENT_ID.test(studentId) || !PIN.test(pin)) fail('invalid_credentials', 401);
      await consumeAttempt(`learner:${studentId}`, {
        windowMs: LEARNER_THROTTLE_WINDOW_MS,
        maxAttempts: LEARNER_THROTTLE_MAX_ATTEMPTS,
      });

      const found = rows(await db.from('learners')
        .select('id,student_id,first_name,last_name,grade,class_name,guardian_name,guardian_phone,status,pin_hash,created_at,updated_at')
        .eq('student_id', studentId).limit(1));
      const learner = found[0];
      const matches = learner
        ? await verifySecret(pin, learner.pin_hash)
        : await verifyAgainstDummy(pin);
      if (!learner || !matches) fail('invalid_credentials', 401);
      if (learner.status !== 'active') fail('account_inactive', 403);

      await clearAttempts('learner');
      const token = await createSession('learner', learner.id, LEARNER_SESSION_MS);
      return json({ ok: true, token, learner: publicLearner(learner) }, 200,
        { 'set-cookie': sessionCookie(LEARNER_COOKIE, token, LEARNER_SESSION_MS / 1000) });
    }

    if (path === '/api/portal/logout' && is('POST')) {
      const session = await findSession(request, LEARNER_COOKIE, 'learner');
      if (session) await dropSession(session.digest);
      return json({ ok: true }, 200, { 'set-cookie': clearCookie(LEARNER_COOKIE) });
    }

    if (path === '/api/portal/me' && is('GET')) {
      const { learner } = await requireLearner(request);
      return json({ ok: true, learner: publicLearner(learner) });
    }

    if (path === '/api/portal/records' && is('GET')) {
      const { learner } = await requireLearner(request);
      return json({ ok: true, ...(await learnerRecords(learner.id)) });
    }

    if (path === '/api/portal/change-pin' && is('POST')) {
      const { session, learner } = await requireLearner(request);
      const body = await readJson(request, 2048);
      const currentPin = typeof body.currentPin === 'string' ? body.currentPin.trim() : '';
      const newPinValue = typeof body.newPin === 'string' ? body.newPin.trim() : '';
      if (!PIN.test(currentPin) || !PIN.test(newPinValue)) fail('invalid_input', 400);
      if (currentPin === newPinValue) fail('pin_unchanged', 400);
      await consumeAttempt(`pin:${learner.id}`, {
        windowMs: LEARNER_THROTTLE_WINDOW_MS,
        maxAttempts: LEARNER_THROTTLE_MAX_ATTEMPTS,
      });
      if (!await verifySecret(currentPin, learner.pin_hash)) fail('invalid_credentials', 401);
      await clearAttempts(`pin:${learner.id}`);

      const updated = rows(await db.from('learners').update({
        pin_hash: await hashSecret(newPinValue),
        updated_at: new Date().toISOString(),
      }).eq('id', learner.id).select('id'));
      if (updated.length !== 1) fail('database_unavailable', 503);

      const dropped = await db.from('sessions').delete()
        .eq('learner_id', learner.id).neq('token_hash', session.digest).select('token_hash');
      if (dropped.error) fail('database_unavailable', 503);
      return json({ ok: true });
    }

    const known = [
      '/api/gallery', '/api/apply', '/api/admin/login', '/api/admin/logout', '/api/admin/me',
      '/api/admin/learners', '/api/admin/applications', '/api/admin/gallery', '/api/admin/welcome-video',
      '/api/portal/login', '/api/portal/logout', '/api/portal/me', '/api/portal/records',
      '/api/portal/change-pin',
    ];
    if (known.includes(path) || learnerMatch || recordsMatch || behaviorMatch || testsMatch
      || behaviorItemMatch || testItemMatch || reportIntentMatch || reportCompleteMatch
      || reportCardMatch || applicationMatch || completeMatch || galleryMatch) fail('method_not_allowed', 405);
    fail('not_found', 404);
  }

  return async function handle(context) {
    return route(context.request);
  };
}
