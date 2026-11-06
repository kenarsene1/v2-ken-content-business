import { useEffect, useRef, useState } from "react";
import { Check, Flame, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { periodLabel, timeLeftLabel, type Challenge, type ChallengeHistory, type ChallengeProgress } from "@/lib/challenges";
import { useStepChallenge } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Burst } from "./burst";

/** Largest goal still drawn as separate blocks; bigger goals use one bar. */
const MAX_SEGMENTS = 10;

/** Counts each time `done` turns true while the card is on screen. */
function useCelebration(done: boolean, title: string) {
  const previous = useRef(done);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (done && !previous.current) {
      setCount((n) => n + 1);
      toast.success(`Challenge complete: ${title}`);
    }
    previous.current = done;
  }, [done, title]);
  return count;
}

function Track({ kind, current, goal }: { kind: string; current: number; goal: number }) {
  const fill = kind === "time_limit" ? "bg-warning" : kind === "manual" ? "bg-primary" : "bg-success";
  if (kind !== "time_limit" && goal <= MAX_SEGMENTS) {
    return (
      <div className="mt-2.5 flex gap-1.5" role="img" aria-label={`${Math.min(current, goal)} of ${goal}`}>
        {Array.from({ length: goal }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 overflow-hidden rounded-md border border-dashed border-border bg-muted/60",
              goal <= 6 ? "h-5" : "h-2",
            )}
          >
            {i < current && <span className={cn("segment-fill block h-full w-full", fill)} style={{ animationDelay: `${i * 90}ms` }} />}
          </span>
        ))}
      </div>
    );
  }
  const percent = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  return (
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${current} of ${goal}`}>
      <div className={cn("momentum-bar h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function ChallengeCard({
  challenge: c,
  progress: p,
  history,
}: {
  challenge: Challenge;
  progress: ChallengeProgress;
  history: ChallengeHistory;
}) {
  const openChallenge = useUI((s) => s.openChallenge);
  const step = useStepChallenge();
  const celebrations = useCelebration(p.done, c.title);
  const archived = !!c.archived_at;

  return (
    <article
      className={cn(
        "group relative rounded-lg border bg-card px-3.5 py-3 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 motion-reduce:transform-none",
        p.done && "border-success/40",
        celebrations > 0 && "challenge-done",
        archived && "opacity-60",
      )}
    >
      {celebrations > 0 && <Burst key={celebrations} />}
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => openChallenge(c.id)}
          className="min-w-0 text-left text-sm font-medium leading-snug outline-none hover:text-primary focus-visible:text-primary"
        >
          <span className="break-words">{c.title}</span>
        </button>
        <span
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
            c.period === "month" ? "bg-warning-soft text-warning" : "bg-accent text-accent-foreground",
          )}
        >
          {periodLabel(c.period)} · {archived ? "Archived" : timeLeftLabel(c.period, new Date())}
        </span>
      </div>

      <Track kind={c.kind} current={p.current} goal={p.goal} />

      <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {p.done ? (
          <span key={celebrations} className="challenge-pop inline-flex items-center gap-1 rounded-full bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">
            <Check className="h-3 w-3" /> Completed
          </span>
        ) : null}
        <span className="min-w-0 flex-1">{p.summary}</span>
        {history.streak > 0 && (
          <span
            title={`Best streak: ${history.best} · ${history.wins} total win${history.wins === 1 ? "" : "s"}`}
            className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-warning"
          >
            <Flame className="flame-flicker h-3 w-3" /> {history.streak} {c.period === "month" ? "mo" : "wk"} streak
          </span>
        )}
        {c.kind === "manual" && !archived && (
          <span className="flex items-center gap-1">
            {p.current > 0 && (
              <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove one" title="Remove one" onClick={() => step(c, -1)}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-6 gap-0.5 px-2 text-xs" aria-label={`Add progress to ${c.title}`} onClick={() => step(c, 1)}>
              <Plus className="h-3 w-3" /> 1
            </Button>
          </span>
        )}
      </div>
    </article>
  );
}
