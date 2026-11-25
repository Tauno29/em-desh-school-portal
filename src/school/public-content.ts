// Only these already-public school reads may be exposed to external hosts.
const PUBLIC_CONTENT = new Set(["homepage", "gallery"]);

export function schoolContentRequest(request: Request, section: string): Request | null {
  if (request.method !== "GET" || !PUBLIC_CONTENT.has(section)) return null;
  const url = new URL(request.url);
  url.pathname = `/.netlify/functions/app/api/${section}`;
  url.search = "";
  return new Request(url, { method: "GET", headers: { accept: "application/json" } });
}