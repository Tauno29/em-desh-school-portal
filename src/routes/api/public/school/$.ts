import { createFileRoute } from "@tanstack/react-router";
import { schoolContentRequest } from "@/school/public-content";

export const Route = createFileRoute("/api/public/school/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const publicRequest = schoolContentRequest(request, params._splat ?? "");
        if (!publicRequest) return Response.json({ error: "not_found" }, { status: 404 });
        const { handleSchoolApi } = await import("@/school/runtime.server");
        return handleSchoolApi(publicRequest);
      },
    },
  },
});