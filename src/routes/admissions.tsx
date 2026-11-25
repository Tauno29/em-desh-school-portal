import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/AdmissionsPage";

export const Route = createFileRoute("/admissions")({
  head: () => ({
    meta: [
      { title: "Admissions · Em-Desh School" },
      { name: "description", content: "Apply online for a place at Em-Desh English Medium Private School." },
      { property: "og:title", content: "Admissions · Em-Desh School" },
      { property: "og:description", content: "Apply online for a place at Em-Desh English Medium Private School." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
