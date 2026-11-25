import { createFileRoute } from "@tanstack/react-router";

// The original frontend calls /.netlify/functions/app/api/...; keep that path so its JS runs unchanged.
const handler = async ({ request }: { request: Request }) => {
  const { handleSchoolApi } = await import("@/school/runtime.server");
  return handleSchoolApi(request);
};

export const Route = createFileRoute("/.netlify/functions/app/$")({
  server: { handlers: { GET: handler, POST: handler, PATCH: handler, PUT: handler, DELETE: handler } },
});
