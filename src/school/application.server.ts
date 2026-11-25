
// Receives an online admission application (answers + passport photo), keeps a copy in
// school_application_forms and returns a long-lived photo link plus the Web3Forms key
// so the browser can forward the application to the school inbox.
const FORM_TYPES = ["nursery", "junior", "senior"] as const;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO = 5 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function handleApplication(request: Request): Promise<Response> {
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "invalid_request" }, 400);
        }
        if (String(form.get("website") ?? "")) return json({ ok: true, accessKey: null, photoUrl: null }); // honeypot
        const formType = String(form.get("formType") ?? "");
        if (!(FORM_TYPES as readonly string[]).includes(formType)) return json({ error: "form_type_invalid" }, 400);
        let entries: [string, string][];
        try {
          const parsed = JSON.parse(String(form.get("entries") ?? "[]"));
          if (!Array.isArray(parsed) || parsed.length > 150) throw new Error();
          entries = parsed.map((e) => [String(e[0]).slice(0, 200), String(e[1]).slice(0, 2000)] as [string, string]);
        } catch {
          return json({ error: "invalid_request" }, 400);
        }
        const childName = String(form.get("childName") ?? "").trim().slice(0, 200);
        if (!childName) return json({ error: "child_name_required" }, 400);
        const photo = form.get("photo");
        if (!(photo instanceof File) || !PHOTO_TYPES[photo.type]) return json({ error: "photo_required" }, 400);
        if (photo.size > MAX_PHOTO) return json({ error: "photo_too_large" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const path = `applications/${crypto.randomUUID()}.${PHOTO_TYPES[photo.type]}`;
        const bucket = supabaseAdmin.storage.from("gallery");
        const up = await bucket.upload(path, photo, { contentType: photo.type });
        if (up.error) {
          console.error("[application] photo upload", up.error);
          return json({ error: "storage_unavailable" }, 503);
        }
        const ins = await supabaseAdmin.from("school_application_forms").insert({
          form_type: formType,
          child_name: childName,
          wants_hostel: String(form.get("hostel") ?? "") === "Yes",
          details: Object.fromEntries(entries),
          photo_path: path,
        });
        if (ins.error) {
          console.error("[application] insert", ins.error);
          return json({ error: "database_unavailable" }, 503);
        }
        const signed = await bucket.createSignedUrl(path, 60 * 60 * 24 * 365);
        let photoUrl = signed.data?.signedUrl ?? null;
        const pub = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.replace(/\/+$/, "");
        const internal = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
        if (photoUrl && pub && internal && photoUrl.startsWith(internal)) photoUrl = pub + photoUrl.slice(internal.length);
        return json({ ok: true, photoUrl, accessKey: process.env["WEB3FORMS_ACCESS_KEY"] || null }, 201);
}
