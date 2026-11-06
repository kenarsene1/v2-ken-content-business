import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { eachDayOfInterval, format, isToday, parseISO, startOfMonth } from "date-fns";
import { publishedThisMonth } from "@/lib/publication";
import { ArrowRight, Sparkles, CircleCheck, Plus } from "lucide-react";
import { useScopedContent, useCreateIdea, useScopedMoney, useActiveAccounts } from "@/lib/queries";
import { inMonth, totals } from "@/lib/revenue";
import { CountUp } from "@/components/count-up";
import { useUI } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformBadge } from "@/components/bits";
import { ProfileAvatar } from "@/components/profile-avatar";
import { hasPlatformIcon, PlatformIcon } from "@/components/platform-icon";
import { getPlatform } from "@/lib/platforms";
import { ActiveRuns } from "@/components/active-runs";
import { DashboardChallenges } from "@/components/challenges-section";
import { DashboardDealTasks } from "@/components/deal-tasks";
import { toast } from "sonner";

/** Fixed rate for the dashboard's RWF view (no live FX). */
const USD_TO_RWF = 1478.41;

const nf = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Dashboard · My content B/S CRM" },
      { name: "description", content: "Your monthly earnings, published videos and what's due today." },
      { property: "og:title", content: "Dashboard · My content B/S CRM" },
      { property: "og:description", content: "Your monthly earnings, published videos and what's due today." },
    ],
  }),
  component: Dashboard,
});

function ProfilesRow() {
  const { accountId, setAccountId } = useUI();
  const { data: accounts } = useActiveAccounts();
  if (accountId || !accounts) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium">Your profiles</h2>
      <div className="py-3">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-5">
          {accounts.map((a, i) => (
            <Button
              variant="ghost"
              key={a.id}
              onClick={() => setAccountId(a.id)}
              title={a.name}
              aria-label={`${a.name} (${getPlatform(a.platform).label}) — view only this profile`}
              className="group relative h-auto flex-col gap-0 rounded-full px-1 py-1 outline-hidden hover:bg-transparent"
            >
              <span
                className="relative block transition-transform duration-200 ease-out group-hover:-translate-y-1 group-focus-visible:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
                style={{ zIndex: accounts.length - i }}
              >
                <ProfileAvatar
                  account={a}
                  className="h-11 w-11 border-2 border-card text-xs shadow-sm ring-2 ring-card transition-shadow group-hover:shadow-md"
                />
                {hasPlatformIcon(a.platform) && (
                  <span className="absolute bottom-0 right-0 flex h-[7px] w-[7px] items-center justify-center rounded-full bg-card ring-1 ring-card" data-platform={a.platform}>
                    <PlatformIcon platform={a.platform} aria-hidden className="h-1 w-1" />
                  </span>
                )}
              </span>
              <span className="mt-1.5 block text-[11px] leading-none tabular-nums text-muted-foreground">
                {nf.format(a.followers)}
              </span>
              <span className="pointer-events-none absolute -top-7 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-0.5 text-[11px] font-medium text-popover-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                {a.name}
              </span>
            </Button>
          ))}
          <Button asChild variant="ghost" size="icon" className="mb-4 h-11 w-11 shrink-0 rounded-full border border-dashed text-muted-foreground" title="Add profile" aria-label="Add profile">
            <Link to="/settings/profiles" onClick={() => useUI.getState().setAddProfile({})}><Plus className="h-5 w-5" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Dashboard() {
  const { accountId, openContent } = useUI();
  const { data, isLoading } = useScopedContent();
  const create = useCreateIdea();
  const money = useScopedMoney();
  const [idea, setIdea] = useState("");
  const items = data ?? [];
  const now = new Date();
  const month = format(now, "yyyy-MM");
  const monthlyIncome = inMonth(money.data ?? [], month).filter(e => e.kind === "income" && e.entry_date <= format(now, "yyyy-MM-dd"));
  const currencies = Array.from(new Set(monthlyIncome.map(e => e.currency ?? "USD"))).sort();
  const earnings = (currencies.length ? currencies : ["USD"]).map(currency => ({ currency, value: totals(monthlyIncome.filter(e => (e.currency ?? "USD") === currency)).income }));
  const published = publishedThisMonth(items, now);
  const publishedDays = new Set(published.map(c => format(parseISO(c.publish_at ?? ""), "yyyy-MM-dd")));
  const elapsedDays = eachDayOfInterval({ start: startOfMonth(now), end: now });
  const today = items.filter(
    (c) => (c.due_date && isToday(parseISO(c.due_date)) && c.stage !== "published") || (c.publish_at && isToday(new Date(c.publish_at))),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="dashboard-greeting font-display font-medium">Good to see you</h1>
        <p className="text-sm text-muted-foreground">{format(now, "MMMM")} · Your creative momentum</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/revenue" className="calendar-enter group min-w-0 rounded-lg border bg-card p-6 transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:transform-none">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" /> This month’s earnings</p>
          {money.isLoading || !money.data ? <Skeleton aria-label="Loading monthly earnings" className="mt-3 h-9 w-32 motion-reduce:animate-none" /> : earnings.map(e => (
            <div key={`${accountId}:${e.currency}`} className="mt-2">
              <CountUp value={e.value} currency={e.currency} className="block break-all text-3xl font-semibold tabular-nums" />
              {e.currency === "USD" && (
                <span className="mt-0.5 flex items-baseline gap-1 text-xs text-muted-foreground tabular-nums">
                  ≈ <CountUp value={e.value * USD_TO_RWF} currency="RWF" className="break-all" />
                </span>
              )}
            </div>
          ))}
          <p className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{format(now, "MMMM yyyy")}</span><ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></p>
        </Link>
        <Link to="/calendar" className="calendar-enter group min-w-0 rounded-lg border bg-card p-6 transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:transform-none">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CircleCheck className="h-3.5 w-3.5 text-success" /> Published videos</p>
          {isLoading || !data ? <Skeleton aria-label="Loading published videos" className="mt-3 h-9 w-20 motion-reduce:animate-none" /> : <CountUp key={accountId ?? "all"} value={published.length} variant="number" className="mt-2 block text-3xl font-semibold tabular-nums" />}
          <div className="mt-3 flex flex-wrap gap-1" aria-label="Publishing days this month">
            {elapsedDays.map(day => <span key={format(day, "yyyy-MM-dd")} title={`${format(day, "MMM d")}: ${publishedDays.has(format(day, "yyyy-MM-dd")) ? "Published" : "No publication"}`} className={`h-2 w-2 rounded-sm ${publishedDays.has(format(day, "yyyy-MM-dd")) ? "bg-success calendar-enter" : "bg-muted"}`} />)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{format(now, "MMMM")} · {published.length > 0 ? "Keep creating" : "A fresh month to create"}</p>
        </Link>
      </div>

      <ProfilesRow />

      <Input
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key === "Enter" && idea.trim() && !create.isPending) {
            create.mutate({ title: idea.trim(), account_id: accountId }, { onSuccess: () => {
              toast.success("Idea saved to Ideas");
              setIdea("");
            } });
          }
        }}
        placeholder="Capture an idea and press Enter…"
        className="h-14 w-full rounded-full border bg-card px-5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
      />

      <section>
        <h2 className="mb-3 text-sm font-medium">Today</h2>
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : today.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Nothing due or publishing today. Nice.</p>
        ) : (
          <div className="divide-y divide-border">
            {today.map((c) => (
              <Button variant="ghost" key={c.id} onClick={() => openContent(c.id)} className="grid h-auto w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-4 py-3 text-left sm:flex hover:bg-muted/50">
                <span className="flex-1 truncate text-sm">{c.title}</span>
                {c.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
                <span className="text-xs text-muted-foreground">{c.stage === "scheduled" ? "Publishing" : "Due"}</span>
              </Button>
            ))}
          </div>
        )}
      </section>

      <div className="space-y-6">
        <ActiveRuns items={items} isLoading={isLoading} />
        {/* Same width as before (half the page), centred with space on both sides. */}
        <div className="mx-auto w-full md:w-[calc(50%-0.5rem)]">
          <DashboardChallenges />
        </div>
      </div>

      <div className="pt-6">
        <DashboardDealTasks />
      </div>
    </div>
  );
}
