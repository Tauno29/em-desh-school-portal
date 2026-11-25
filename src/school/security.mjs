// Password and PIN derivation, tokens, cookies. Server-side only.

export const PBKDF2_ITERATIONS = 600000;
const SALT_BYTES = 16;
const encoder = new TextEncoder();
const FIXED_DUMMY_SALT = new Uint8Array(SALT_BYTES);
const DUMMY_HASH = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function derive(secret, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashSecret(secret, iterations = PBKDF2_ITERATIONS) {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const derived = await derive(secret, salt, iterations);
  return `pbkdf2$${iterations}$${toBase64(salt)}$${toBase64(derived)}`;
}

export async function verifySecret(secret, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isSafeInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
  let salt;
  try { salt = fromBase64(parts[2]); } catch { return false; }
  const derived = await derive(secret, salt, iterations);
  return timingSafeEqual(toBase64(derived), parts[3]);
}

// Same derivation cost for unknown student IDs so timing does not reveal existence.
export async function verifyAgainstDummy(secret) {
  const derived = await derive(secret, FIXED_DUMMY_SALT, PBKDF2_ITERATIONS);
  timingSafeEqual(toBase64(derived), DUMMY_HASH);
  return false;
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function constantTimeEqualStrings(left, right) {
  return typeof left === 'string' && typeof right === 'string' && timingSafeEqual(left, right);
}

export function newSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function newPin() {
  const buffer = new Uint32Array(1);
  const ceiling = Math.floor(0x100000000 / 1000000) * 1000000;
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= ceiling);
  return String(100000 + (buffer[0] % 900000));
}

export function readCookie(request, name) {
  const header = request.headers.get('cookie') ?? '';
  if (!header || header.length > 8192) return null;
  const values = [];
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const at = trimmed.indexOf('=');
    if (at < 1) continue;
    if (trimmed.slice(0, at).trim() === name) values.push(trimmed.slice(at + 1));
  }
  if (values.length !== 1) return null;
  const token = values[0];
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

// Fallback for embedded previews where the browser drops third-party cookies.
export function readBearerToken(request) {
  const header = request.headers.get('authorization') ?? '';
  if (!header || header.length > 128) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header.trim());
  return match ? match[1] : null;
}

export function sessionCookie(name, token, maxAgeSeconds) {
  return `${name}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAgeSeconds}`;
}

export function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
}
