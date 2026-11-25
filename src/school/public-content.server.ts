import { publicMediaPath, schoolContentRequest, stabilizeMediaUrls } from "./public-content";

const MEDIA_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];

// Shared by /api/public/school/* (Netlify proxy target) and same-origin /school-api/*.
export async function handlePublicSchoolContent(request: Request, splat: string): Promise<Response> {
  const mediaPath = request.method === "GET" ? publicMediaPath(splat) : null;
  if (mediaPath) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage.from("gallery").createSignedUrl(mediaPath, 300);
    if (error || !data) return new Response("Not found", { status: 404 });
    const range = request.headers.get("range");
    const upstream = await fetch(data.signedUrl, { headers: range ? { range } : {} });
    if (!upstream.ok) return new Response("Not found", { status: 404 });
    const headers = new Headers({ "cache-control": "public, max-age=86400, stale-while-revalidate=604800" });
    for (const h of MEDIA_HEADERS) { const v = upstream.headers.get(h); if (v) headers.set(h, v); }
    if (!headers.get("content-type") || headers.get("content-type") === "application/octet-stream") {
      headers.set("content-type", /video|\.mp4$/i.test(mediaPath) ? "video/mp4" : "image/jpeg");
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  }
  const publicRequest = schoolContentRequest(request, splat);
  if (!publicRequest) return Response.json({ error: "not_found" }, { status: 404 });
  const { handleSchoolApi } = await import("./runtime.server");
  const res = await handleSchoolApi(publicRequest);
  if (!res.ok) return res;
  return new Response(stabilizeMediaUrls(await res.text()), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "netlify-cdn-cache-control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
