// Only these already-public school reads may be exposed to external hosts.
const PUBLIC_CONTENT = new Set(["homepage", "gallery"]);

export function schoolContentRequest(request: Request, section: string): Request | null {
  if (request.method !== "GET" || !PUBLIC_CONTENT.has(section)) return null;
  const url = new URL(request.url);
  url.pathname = `/.netlify/functions/app/api/${section}`;
  url.search = "";
  return new Request(url, { method: "GET", headers: { accept: "application/json" } });
}

// Only public homepage/gallery media may be streamed; application photos (applications/) stay private.
export function publicMediaPath(splat: string): string | null {
  if (!splat.startsWith("media/")) return null;
  const path = decodeURIComponent(splat.slice(6));
  if (path.includes("..") || !/^(homepage|gallery)\/[\w./-]+$/.test(path)) return null;
  return path;
}

// Replace expiring signed storage links with stable, cacheable /school-api/media/ links.
export function stabilizeMediaUrls(json: string): string {
  return json.replace(/https?:\/\/[^"]*\/storage\/v1\/object\/sign\/gallery\/([^"?]+)\?[^"]*/g, (all, path: string) => {
    const decoded = decodeURIComponent(path);
    return publicMediaPath("media/" + decoded) ? "/school-api/media/" + decoded : all;
  });
}
