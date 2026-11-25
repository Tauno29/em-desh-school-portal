import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequestHeader, useSession, clearSession, updateSession } from "@tanstack/react-start/server";
import { hashAccessCode, hasValidLearnerCredentials } from "./hash";
import { sendAdmissionsEmail } from "./emailjs.server";

type Handler = (input: unknown) => Promise<unknown>;

async function getDb(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) {
    console.error("[db]", res.error);
    throw new Error("The school database could not complete that request.");
  }
  return res.data;
}

const now = () => new Date().toISOString();

function learnerSession() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "emdesh_learner_session",
    maxAge: 60 * 60 * 8,
    cookie: { sameSite: "none" as const, secure: true, httpOnly: true, path: "/" },
  };
}

async function getAdmin(): Promise<{ id: string; email: string | null } | null> {
  const header = getRequestHeader("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const db = await getDb();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const roles = must(await db.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin"));
  if (!roles || roles.length === 0) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

function admin(fn: Handler): Handler {
  return async (input) => {
    if (!(await getAdmin())) throw new Error("Please sign in as an administrator.");
    return fn(input);
  };
}

const learnerFields = 'id, "fullName", surname, "studentId", teacher, subjects, "className", "classId", "parentAccountId", "createdAt", "updatedAt"';
const emptyRecord = (learnerId: number) => ({ learnerId, behaviorNotes: "", term1Report: "", term2Report: "", term3Report: "", updatedAt: now() });

const id = z.object({ id: z.number().int().positive() });
const learnerBase = {
  fullName: z.string().min(2).max(160),
  surname: z.string().trim().min(1, "Surname is required.").max(120),
  studentId: z.string().min(1).max(80),
  teacher: z.string().max(160).optional(),
  subjects: z.string().max(2000).optional(),
  className: z.string().min(1).max(80),
  classId: z.number().int().positive().optional(),
};
export const learnerCreateInput = z.object({ ...learnerBase, parentPin: z.string().regex(/^\d{4}$/, "Parent PIN must be exactly four digits.") });
export const learnerUpdateInput = z.object({ ...learnerBase, id: z.number().int().positive(), parentPin: z.string().regex(/^\d{4}$/, "Parent PIN must be exactly four digits.").optional() });
const performanceBase = { learnerId: z.number().int().positive(), activityName: z.string().min(1).max(160), activityType: z.string().min(1).max(60), marks: z.number().int().min(0), totalMarks: z.number().int().positive() };
const marksRule = (v: { marks: number; totalMarks: number }) => v.marks <= v.totalMarks;
const marksMsg = { message: "Marks cannot exceed the total marks." };
const alertInput = z.object({ enabled: z.boolean(), message: z.string().min(1), buttonLabel: z.string().min(1).max(80), destination: z.string().min(1).max(255) });
const feeInput = z.object({ academicYear: z.string().min(1).max(20), kindergarten: z.string().min(1).max(80), prePrimary: z.string().min(1).max(80), grade1to3: z.string().min(1).max(80), developmentFund: z.string().min(1).max(80), hostelBoarding: z.string().min(1).max(80), registrationFee: z.string().min(1).max(80) });
const contactInput = z.object({ phone: z.string().min(1).max(80), whatsapp: z.string().min(1).max(80), email: z.union([z.string().email(), z.literal("Email to be confirmed")]), location: z.string().min(1).max(180), postalBox: z.string().min(1).max(180), registrationNumber: z.string().min(1).max(80), nextTermDate: z.string().min(1).max(80) });
const galleryUploadInput = z.object({ title: z.string().min(1).max(180), category: z.string().min(1).max(80), filename: z.string().min(1).max(180), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]), dataUrl: z.string().min(1).max(14_000_000) });

async function first<T>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T | null> {
  const rows = must(await q);
  return rows?.[0] ?? null;
}

const handlers: Record<string, Handler> = {
  // ---------- session ----------
  "auth.me": async () => {
    const user = await getAdmin();
    return user ? { email: user.email, name: user.email, role: "admin" } : null;
  },
  "admin.setupStatus": async () => {
    const db = await getDb();
    const rows = must(await db.from("user_roles").select("id").eq("role", "admin").limit(1));
    return { needsSetup: !rows || rows.length === 0 };
  },
  "admin.bootstrap": async (raw) => {
    const input = z.object({ email: z.string().email(), password: z.string().min(8, "Use at least 8 characters for the password.") }).parse(raw);
    const db = await getDb();
    const existing = must(await db.from("user_roles").select("id").eq("role", "admin").limit(1));
    if (existing && existing.length > 0) throw new Error("An administrator account already exists. Please sign in.");
    const created = await db.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "Could not create the administrator account.");
    must(await db.from("user_roles").insert({ user_id: created.data.user.id, role: "admin" }));
    return { success: true };
  },

  // ---------- public site ----------
  "content.get": async (raw) => {
    const { contentKey } = z.object({ contentKey: z.string().min(1).max(100) }).parse(raw);
    const db = await getDb();
    return first(db.from("site_content").select("*").eq("contentKey", contentKey).limit(1));
  },
  "publicSite.alert": async () => first((await getDb()).from("site_alert_config").select("*").limit(1)),
  "publicSite.fees": async () => first((await getDb()).from("fee_structures").select("*").order("updatedAt", { ascending: false }).limit(1)),
  "publicSite.contact": async () => first((await getDb()).from("school_contact_info").select("*").limit(1)),
  "publicSite.gallery": async () => must(await (await getDb()).from("gallery_media").select("*").order("createdAt", { ascending: false })) ?? [],
  "publicSite.galleryHidden": async () => (must(await (await getDb()).from("gallery_asset_visibility").select('"imageUrl"')) ?? []).map((r: { imageUrl: string }) => r.imageUrl),
  "admissions.submit": async (raw) => {
    const { application } = z.object({ application: z.record(z.string(), z.string().max(5000)).refine((v) => Object.keys(v).length > 0 && Object.keys(v).length < 80) }).parse(raw);
    const result = await sendAdmissionsEmail(application);
    return { success: true, recipient: result.recipient };
  },

  // ---------- learner portal ----------
  "learner.login": async (raw) => {
    const input = z.object({ studentId: z.string().min(1).max(80), pin: z.string().regex(/^\d{4}$/, "PIN must be exactly four digits.") }).parse(raw);
    const db = await getDb();
    const learner = await first<{ id: number; fullName: string; surname: string; studentId: string | null; parentPinHash: string | null }>(
      db.from("learners").select('id, "fullName", surname, "studentId", "parentPinHash"').eq("studentId", input.studentId.trim()).limit(1),
    );
    if (!learner || !(await hasValidLearnerCredentials(learner, input.studentId, input.pin))) throw new Error("The Student ID or PIN is incorrect.");
    await updateSession(learnerSession(), { learnerId: learner.id });
    return { success: true, learner: { id: learner.id, fullName: learner.fullName, surname: learner.surname } };
  },
  "learner.logout": async () => {
    await clearSession(learnerSession());
    return { success: true };
  },
  "learner.portal": async () => {
    const session = await useSession<{ learnerId?: number }>(learnerSession());
    const learnerId = session.data.learnerId;
    if (!learnerId) throw new Error("Please sign in to the learner portal.");
    const db = await getDb();
    const [learner, performance, record] = await Promise.all([
      first(db.from("learners").select(learnerFields).eq("id", learnerId).limit(1)),
      db.from("performance_entries").select("*").eq("learnerId", learnerId).order("performedAt", { ascending: false }),
      first(db.from("learner_portal_records").select("*").eq("learnerId", learnerId).limit(1)),
    ]);
    return { learner, performance: must(performance) ?? [], portalRecord: record ?? emptyRecord(learnerId) };
  },

  // ---------- admin ----------
  "admin.classes.list": admin(async () => must(await (await getDb()).from("classes").select("*").order("name"))),
  "admin.classes.create": admin(async (raw) => {
    const input = z.object({ name: z.string().min(1).max(80) }).parse(raw);
    must(await (await getDb()).from("classes").insert(input));
    return { success: true };
  }),
  "admin.learners.list": admin(async () =>
    must(await (await getDb()).from("learners").select(learnerFields).order("className").order("surname").order("fullName")),
  ),
  "admin.learners.detail": admin(async (raw) => {
    const { id: learnerId } = id.parse(raw);
    const db = await getDb();
    const [learner, performance, attendance, record] = await Promise.all([
      first(db.from("learners").select(learnerFields).eq("id", learnerId).limit(1)),
      db.from("performance_entries").select("*").eq("learnerId", learnerId).order("performedAt", { ascending: false }),
      db.from("attendance_records").select("*").eq("learnerId", learnerId).order("attendanceDate", { ascending: false }),
      first(db.from("learner_portal_records").select("*").eq("learnerId", learnerId).limit(1)),
    ]);
    if (!learner) throw new Error("Learner record not found.");
    return { learner, performance: must(performance) ?? [], attendance: must(attendance) ?? [], portalRecord: record ?? emptyRecord(learnerId) };
  }),
  "admin.learners.portalRecord.save": admin(async (raw) => {
    const input = z.object({ learnerId: z.number().int().positive(), behaviorNotes: z.string().max(5000), term1Report: z.string().max(5000), term2Report: z.string().max(5000), term3Report: z.string().max(5000) }).parse(raw);
    must(await (await getDb()).from("learner_portal_records").upsert({ ...input, updatedAt: now() }, { onConflict: "learnerId" }));
    return { success: true };
  }),
  "admin.learners.create": admin(async (raw) => {
    const { parentPin, ...rest } = learnerCreateInput.parse(raw);
    must(await (await getDb()).from("learners").insert({ ...rest, parentPinHash: await hashAccessCode(parentPin) }));
    return { success: true };
  }),
  "admin.learners.update": admin(async (raw) => {
    const { id: learnerId, parentPin, ...rest } = learnerUpdateInput.parse(raw);
    const patch: Record<string, unknown> = { ...rest, updatedAt: now() };
    if (parentPin) patch["parentPinHash"] = await hashAccessCode(parentPin);
    must(await (await getDb()).from("learners").update(patch).eq("id", learnerId));
    return { success: true };
  }),
  "admin.learners.remove": admin(async (raw) => {
    must(await (await getDb()).from("learners").delete().eq("id", id.parse(raw).id));
    return { success: true };
  }),
  "admin.performance.create": admin(async (raw) => {
    const input = z.object(performanceBase).refine(marksRule, marksMsg).parse(raw);
    must(await (await getDb()).from("performance_entries").insert(input));
    return { success: true, percentage: Math.round((input.marks / input.totalMarks) * 100) };
  }),
  "admin.performance.update": admin(async (raw) => {
    const { id: entryId, learnerId, ...values } = z.object({ ...performanceBase, id: z.number().int().positive() }).refine(marksRule, marksMsg).parse(raw);
    must(await (await getDb()).from("performance_entries").update(values).eq("id", entryId).eq("learnerId", learnerId));
    return { success: true };
  }),
  "admin.performance.remove": admin(async (raw) => {
    const input = z.object({ id: z.number().int().positive(), learnerId: z.number().int().positive() }).parse(raw);
    must(await (await getDb()).from("performance_entries").delete().eq("id", input.id).eq("learnerId", input.learnerId));
    return { success: true };
  }),
  "admin.gallery.list": admin(async () => must(await (await getDb()).from("gallery_media").select("*").order("createdAt", { ascending: false }))),
  "admin.gallery.upload": admin(async (raw) => {
    const input = galleryUploadInput.parse(raw);
    const encoded = input.dataUrl.split(",", 2)[1];
    if (!encoded) throw new Error("Invalid image data.");
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const path = `${Date.now()}-${input.filename.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const db = await getDb();
    const up = await db.storage.from("gallery").upload(path, bytes, { contentType: input.mimeType });
    if (up.error) throw new Error(up.error.message);
    const signed = await db.storage.from("gallery").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signed.error || !signed.data) throw new Error("The image was stored but its link could not be created.");
    must(await db.from("gallery_media").insert({ title: input.title, category: input.category, imageUrl: signed.data.signedUrl }));
    return { success: true, url: signed.data.signedUrl };
  }),
  "admin.gallery.remove": admin(async (raw) => {
    const { id: mediaId } = id.parse(raw);
    const db = await getDb();
    const existing = await first<{ imageUrl: string }>(db.from("gallery_media").select('"imageUrl"').eq("id", mediaId).limit(1));
    const match = existing?.imageUrl.match(/\/object\/sign\/gallery\/([^?]+)/);
    if (match?.[1]) await db.storage.from("gallery").remove([decodeURIComponent(match[1])]);
    must(await db.from("gallery_media").delete().eq("id", mediaId));
    return { success: true };
  }),
  "admin.alert.get": admin(async () => first((await getDb()).from("site_alert_config").select("*").limit(1))),
  "admin.alert.save": admin(async (raw) => {
    const input = alertInput.parse(raw);
    const db = await getDb();
    const row = { enabled: input.enabled ? 1 : 0, message: input.message, buttonLabel: input.buttonLabel, destination: input.destination, updatedAt: now() };
    const existing = await first<{ id: number }>(db.from("site_alert_config").select("id").limit(1));
    must(existing ? await db.from("site_alert_config").update(row).eq("id", existing.id) : await db.from("site_alert_config").insert(row));
    return { success: true };
  }),
  "admin.fees.get": admin(async () => first((await getDb()).from("fee_structures").select("*").order("updatedAt", { ascending: false }).limit(1))),
  "admin.fees.save": admin(async (raw) => {
    const input = feeInput.parse(raw);
    must(await (await getDb()).from("fee_structures").upsert({ ...input, updatedAt: now() }, { onConflict: "academicYear" }));
    return { success: true };
  }),
  "admin.schoolInfo.get": admin(async () => first((await getDb()).from("school_contact_info").select("*").limit(1))),
  "admin.schoolInfo.save": admin(async (raw) => {
    const input = contactInput.parse(raw);
    const db = await getDb();
    const existing = await first<{ id: number }>(db.from("school_contact_info").select("id").limit(1));
    must(existing ? await db.from("school_contact_info").update({ ...input, updatedAt: now() }).eq("id", existing.id) : await db.from("school_contact_info").insert(input));
    return { success: true };
  }),
};

export async function dispatch(path: string, input: unknown): Promise<unknown> {
  const handler = handlers[path];
  if (!handler) throw new Error(`Unknown action: ${path}`);
  try {
    return await handler(input);
  } catch (error) {
    if (error instanceof z.ZodError) throw new Error(error.issues[0]?.message ?? "Please check the form and try again.");
    throw error;
  }
}
