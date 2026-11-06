import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useActiveAccounts } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { getPlatform } from "@/lib/platforms";
import { ProfileAvatar } from "@/components/profile-avatar";
import { YouTubeAnalytics } from "@/components/youtube-analytics";
import { EmptyState } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics · My content B/S CRM" },
      { name: "description", content: "Real public YouTube channel stats and latest video performance for your profiles." },
      { property: "og:title", content: "Analytics · My content B/S CRM" },
      { property: "og:description", content: "Real public YouTube channel stats and latest video performance for your profiles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

const nf = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function AnalyticsPage() {
  const { data: accounts, isLoading } = useActiveAccounts();
  const { accountId, openAccount } = useUI();
  const scoped = (accounts ?? []).filter((a) => !accountId || a.id === accountId);
  const youtube = scoped.filter((a) => a.platform === "youtube");
  const manual = scoped.filter((a) => a.platform !== "youtube");
  const [picked, setSelected] = useState<string | null>(null);
  const current = youtube.find((a) => a.id === picked) ?? youtube[0];
  const selected = current?.id ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Live public stats from YouTube. Other platforms use the numbers you enter.</p>
      </header>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !youtube.length ? (
        <EmptyState
          title="No YouTube profile here"
          hint="Add a YouTube profile with its channel link or @handle to see real channel stats."
          action={<Button size="sm" asChild><Link to="/settings/profiles">Manage profiles</Link></Button>}
        />
      ) : (
        <section className="space-y-4">
          {youtube.length > 1 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="YouTube profiles">
              {youtube.map((a) => (
                <Button
                  variant="outline"
                  key={a.id}
                  role="tab"
                  aria-selected={a.id === selected}
                  onClick={() => setSelected(a.id)}
                  className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors", a.id === selected ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted")}
                >
                  <ProfileAvatar account={a} className="h-5 w-5" /> {a.name}
                </Button>
              ))}
            </div>
          )}
          {current && <div className="py-2"><YouTubeAnalytics key={current.id} account={current} /></div>}
        </section>
      )}

      {manual.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Other profiles <span className="font-normal text-muted-foreground">· entered by hand</span></h2>
          <div className="divide-y rounded-lg border bg-card">
            {manual.map((a) => (
              <button key={a.id} onClick={() => openAccount(a.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
                <ProfileAvatar account={a} className="h-8 w-8" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{nf.format(a.followers)} {getPlatform(a.platform).audienceLabel}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
