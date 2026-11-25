import { createFileRoute } from "@tanstack/react-router";
import { handlePublicSchoolContent } from "@/school/public-content.server";

// Local/Lovable counterpart of Netlify's same-origin public-content proxy.
export const Route = createFileRoute("/school-api/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => handlePublicSchoolContent(request, params._splat ?? ""),
    },
  },
});