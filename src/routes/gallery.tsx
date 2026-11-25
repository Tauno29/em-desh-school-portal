import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/GalleryPage";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery · Em-Desh School" },
      { name: "description", content: "Photos from school life at Em-Desh English Medium Private School." },
      { property: "og:title", content: "Gallery · Em-Desh School" },
      { property: "og:description", content: "Photos from school life at Em-Desh English Medium Private School." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
