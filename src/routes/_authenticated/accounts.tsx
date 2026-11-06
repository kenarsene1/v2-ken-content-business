import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old URL — profiles now live in Settings. */
export const Route = createFileRoute("/_authenticated/accounts")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/profiles", replace: true });
  },
});
