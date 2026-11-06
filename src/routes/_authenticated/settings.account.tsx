import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignOutButton } from "@/components/sign-out-button";

export const Route = createFileRoute("/_authenticated/settings/account")({
  head: () => ({ meta: [{ title: "Your account · Settings · My content B/S CRM" }, { name: "description", content: "Manage your private My content B/S CRM account and sign-in session." }, { property: "og:title", content: "Your account · Settings · My content B/S CRM" }, { property: "og:description", content: "Manage your private My content B/S CRM account and sign-in session." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AccountSettings,
});

function AccountSettings() {
  const [email, setEmail] = useState<string>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? undefined));
  }, []);
  return (
    <section className="space-y-3">
      <h2 className="font-medium">Your account</h2>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="break-all text-sm font-medium">{email ?? "…"}</p>
        </div>
        <SignOutButton size="sm" className="gap-1.5" />
      </div>
    </section>
  );
}
