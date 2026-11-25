import { createFileRoute } from "@tanstack/react-router";
import { handlePublicSchoolContent } from "@/school/public-content.server";

export const Route = createFileRoute("/api/public/school/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => handlePublicSchoolContent(request, params._splat ?? ""),
      HEAD: async ({ request, params }) => { const r = await handlePublicSchoolContent(new Request(request.url, { headers: request.headers }), params._splat ?? ""); return new Response(null, { status: r.status, headers: r.headers }); },
    },
  },
});