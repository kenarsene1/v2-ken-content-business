import { createFileRoute, redirect } from "@tanstack/react-router";

/** Challenges now live inside Goals & plans. Old links and bookmarks land there. */
export const Route = createFileRoute("/_authenticated/challenges")({
  beforeLoad: () => {
    throw redirect({ to: "/goals", search: { view: "challenges" }, replace: true });
  },
});
