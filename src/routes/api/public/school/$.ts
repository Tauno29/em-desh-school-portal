import { createFileRoute } from "@tanstack/react-router";
import { handlePublicSchoolContent } from "@/school/public-content.server";

export const Route = createFileRoute("/api/public/school/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => handlePublicSchoolContent(request, params._splat ?? ""),
    },
  },
});