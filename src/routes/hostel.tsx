import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/HostelPage";

export const Route = createFileRoute("/hostel")({
  head: () => ({
    meta: [
      { title: "Hostel · Em-Desh School" },
      { name: "description", content: "Safe, caring hostel boarding for Em-Desh learners." },
      { property: "og:title", content: "Hostel · Em-Desh School" },
      { property: "og:description", content: "Safe, caring hostel boarding for Em-Desh learners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
