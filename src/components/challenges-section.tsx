import { Link } from "@tanstack/react-router";
import { Check, DatabaseZap, Flame, Plus, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { periodLabel, sortChallenges, timeLeftLabel } from "@/lib/challenges";
import { isMissingTableError, useChallengeRows } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";

const SHOWN = 3;

/** Shown until the challenges database update has been applied. */
export function ChallengesSetupNotice() {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed px-6 py-8 text-center">
      <DatabaseZap className="mb-2 h-5 w-5 text-primary/60" />
      <p className="text-sm font-medium">Challenges need a quick database update</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        In Lovable, ask it to apply the latest database migration, then reload this page.
      </p>
    </div>
  );
}

/** Dashboard card: open challenges first, in warm "quest" colours to invite action. */
export function DashboardChallenges() {
  const openChallenge = useUI((s) => s.openChallenge);
  const { rows, isLoading, error, refetch } = useChallengeRows();
  const active = sortChallenges((rows ?? []).filter((r) => !r.challenge.archived_at));
  const done = active.filter((r) => r.progress.done).length;
  const streak = Math.max(0, ...active.map((r) => r.history.streak));
  const wins = (rows ?? []).reduce((sum, r) => sum + r.history.wins, 0);
  const now = new Date();

  return (
    <section aria-label="Challenges" className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-quest/30 bg-quest-soft p-5">
      <span aria-hidden className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-gradient-to-br from-quest to-quest-2 opacity-20 blur-2xl" />
      <div className="relative mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-quest to-quest-2 text-quest-foreground shadow-sm">
            <Trophy className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Challenges</h2>
            <p className="text-xs text-muted-foreground">
              {active.length ? (done === active.length ? "All cleared. Legendary." : `${done} of ${active.length} cleared`) : "Pick a quest and start a streak"}
            </p>
          </div>
        </div>
        {active.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium">
            <span title="Best current streak" className="flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-quest"><Flame className="h-3.5 w-3.5" />{streak}</span>
            <span title="Total wins" className="flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-quest-2"><Trophy className="h-3 w-3" />{wins}</span>
          </div>
        )}
      </div>

      <div className="relative flex-1">
        {isMissingTableError(error) ? (
          <ChallengesSetupNotice />
        ) : error ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">Challenges couldn't load.</p>
            <Button variant="ghost" onClick={refetch}>Try again</Button>
          </div>
        ) : isLoading || !rows ? (
          <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : active.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Publish 4 videos this week? Every win builds your streak.</p>
        ) : (
          <ul className="space-y-2">
            {active.slice(0, SHOWN).map(({ challenge: c, progress: p }) => {
              const percent = p.done ? 100 : p.goal > 0 ? Math.min(100, (p.current / p.goal) * 100) : 0;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => openChallenge(c.id)} className="group w-full rounded-xl bg-background/70 px-3 py-2.5 text-left transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transform-none">
                    <span className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{c.title}</span>
                      {p.done
                        ? <span className="flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success"><Check className="h-3 w-3" /> Cleared</span>
                        : <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{Math.min(p.current, p.goal)}/{p.goal}</span>}
                    </span>
                    <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={p.summary}>
                      <span className={cn("momentum-bar block h-full rounded-full", p.done ? "bg-success" : "bg-gradient-to-r from-quest to-quest-2")} style={{ width: `${percent}%` }} />
                    </span>
                    <span className="mt-1.5 block text-[11px] text-muted-foreground">{periodLabel(c.period)} · {timeLeftLabel(c.period, now)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-2">
        <Button asChild size="sm" className="h-8 gap-1 rounded-full border-0 bg-gradient-to-r from-quest to-quest-2 px-3.5 text-xs text-quest-foreground shadow-sm hover:opacity-90">
          <Link to="/goals" search={{ view: "challenges" }}>{active.length ? <><Zap className="h-3.5 w-3.5" /> New challenge</> : <><Plus className="h-3.5 w-3.5" /> Start a challenge</>}</Link>
        </Button>
        {active.length > SHOWN && <Link to="/goals" search={{ view: "challenges" }} className="text-xs font-medium text-quest hover:underline">+{active.length - SHOWN} more</Link>}
      </div>
    </section>
  );
}
