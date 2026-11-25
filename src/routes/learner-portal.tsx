import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/LearnerPortalPage";

export const Route = createFileRoute("/learner-portal")({
  head: () => ({
    meta: [
      { title: "Learner Portal · Em-Desh School" },
      { name: "description", content: "Learners and parents sign in to see marks, behaviour notes and term reports." },
      { property: "og:title", content: "Learner Portal · Em-Desh School" },
      { property: "og:description", content: "Learners and parents sign in to see marks, behaviour notes and term reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
