import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/FeesPage";

export const Route = createFileRoute("/fees")({
  head: () => ({
    meta: [
      { title: "Fees · Em-Desh School" },
      { name: "description", content: "Current school fees for kindergarten, pre-primary, grades 1 to 3 and hostel." },
      { property: "og:title", content: "Fees · Em-Desh School" },
      { property: "og:description", content: "Current school fees for kindergarten, pre-primary, grades 1 to 3 and hostel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
