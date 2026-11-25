import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/application")({
  server: {
    handlers: {
      POST: async ({ request }) => (await import("@/school/application.server")).handleApplication(request),
    },
  },
});
