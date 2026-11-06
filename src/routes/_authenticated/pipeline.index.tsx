import { createFileRoute } from "@tanstack/react-router";
import { FocusWorkspace } from "@/components/focus-workspace";

export const Route = createFileRoute("/_authenticated/pipeline/")({
  head: () => ({
    meta: [
      { title: "Working on · My content B/S CRM" },
      { name: "description", content: "Focus on one video and finish it, one small task at a time." },
      { property: "og:title", content: "Working on · My content B/S CRM" },
      { property: "og:description", content: "Focus on one video and finish it, one small task at a time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FocusWorkspace,
});
