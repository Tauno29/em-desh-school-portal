// Adapts the original school API (src/school/routes.mjs, kept verbatim) to Lovable Cloud.
import { application } from "./routes.mjs";

class BackendError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const BUCKET = "gallery";
// The original code uses bare table names; on Cloud they live under a school_ prefix.
const prefixed = (table: string) => `school_${table}`;

// Signed URLs from the server client may point at the internal runtime host; browsers need the public one.
function publicize(url: string): string {
  const pub = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.replace(/\/+$/, "");
  const internal = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
  let out = url;
  if (pub && internal && out.startsWith(internal)) out = pub + out.slice(internal.length);
  if (pub && out.startsWith("/")) out = pub + "/storage/v1" + out;
  return out;
}

export async function handleSchoolApi(request: Request): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as { from: (t: string) => unknown; storage: any };
  const db = { from: (table: string) => admin.from(prefixed(table)) };
  const bucket = () => admin.storage.from(BUCKET);
  const storage = {
    async createSignedUploadUrl(path: string) {
      const { data, error } = await bucket().createSignedUploadUrl(path);
      if (error || !data) throw error ?? new Error("sign_failed");
      return { signedUrl: publicize(data.signedUrl) };
    },
    async createSignedUrl(path: string, expiresIn = 3600) {
      const { data, error } = await bucket().createSignedUrl(path, expiresIn);
      if (error || !data) throw error ?? new Error("sign_failed");
      return { signedUrl: publicize(data.signedUrl) };
    },
    async download(path: string) {
      const { data, error } = await bucket().download(path);
      if (error || !data) throw error ?? new Error("storage_object_not_found");
      return new Response(data, { headers: { "content-type": data.type || "application/octet-stream" } });
    },
    async remove(paths: string[]) {
      if (!paths?.length) return { removed: 0 };
      await bucket().remove(paths);
      return { removed: paths.length };
    },
  };
  // Learner portal and the old short application form were retired; keep their endpoints closed.
  const apiPath = new URL(request.url).pathname;
  if (/\/api\/(portal\/|apply$)/.test(apiPath)) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } });
  }
  const handle = application({ db, storage, BackendError, env: { get: (name: string) => process.env[name] } });
  try {
    return await handle({ request });
  } catch (error) {
    const e = error as { status?: number; code?: string };
    const status = Number(e?.status) || 500;
    if (status >= 500) console.error("[school-api]", error);
    return new Response(JSON.stringify({ error: e?.code || "request_failed" }), {
      status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
}
