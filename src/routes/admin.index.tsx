import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/AdminPortalPage";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console · Em-Desh School" },
      { name: "description", content: "School administration console." },
      { property: "og:title", content: "Admin Console · Em-Desh School" },
      { property: "og:description", content: "School administration console." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
