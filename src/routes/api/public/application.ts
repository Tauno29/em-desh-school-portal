import { createFileRoute } from "@tanstack/react-router";

// Application form endpoint for the Netlify copy of the site (cross-origin).
const ALLOWED = new Set(["https://emdeshprivateschool.netlify.app", "https://em-desh-school-connect.lovable.app"]);
const cors = (origin: string | null): Record<string, string> =>
  origin && ALLOWED.has(origin)
    ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "Origin" }
    : {};

export const Route = createFileRoute("/api/public/application")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: cors(request.headers.get("origin")) }),
      POST: async ({ request }) => {
        const res = await (await import("@/school/application.server")).handleApplication(request);
        const headers = new Headers(res.headers);
        for (const [k, v] of Object.entries(cors(request.headers.get("origin")))) headers.set(k, v);
        return new Response(res.body, { status: res.status, headers });
      },
    },
  },
});
