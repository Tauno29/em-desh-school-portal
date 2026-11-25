import { createFileRoute } from "@tanstack/react-router";
import html from "../../public/index.html?raw";

// The school's homepage is the original static index.html; the other pages are served from public/.
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Em-Desh English Medium Private School — Okahao" },
    { name: "description", content: "English-medium Kindergarten, Pre-Primary and Grades 1–7 in Okahao, Namibia, with on-site hostel facilities." },
    { property: "og:title", content: "Em-Desh English Medium Private School — Okahao" },
    { property: "og:description", content: "English-medium learning from Kindergarten to Grade 7, with on-site boarding in Okahao, Namibia." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  server: {
    handlers: {
      GET: () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }),
    },
  },
});
