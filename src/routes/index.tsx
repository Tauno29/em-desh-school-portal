import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Home";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Em-Desh English Medium Private School · Okahao" },
      { name: "description", content: "Private English-medium school in Okahao, Omusati Region, Namibia." },
      { property: "og:title", content: "Em-Desh English Medium Private School · Okahao" },
      { property: "og:description", content: "Private English-medium school in Okahao, Omusati Region, Namibia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
