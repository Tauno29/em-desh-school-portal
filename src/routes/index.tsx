import { createFileRoute } from "@tanstack/react-router";
import html from "../../public/index.html?raw";

// The school's homepage is the original static index.html; the other pages are served from public/.
export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }),
    },
  },
});
