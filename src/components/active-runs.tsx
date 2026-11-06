import { Link, useNavigate } from "@tanstack/react-router";
import { format, isBefore, isValid, parseISO, startOfToday } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useStages, useWorkflow, type ContentItem } from "@/lib/queries";
import type { StageList } from "@/lib/stages";
import { activeRuns, stageIndex } from "@/lib/runs";
import { formatMinutes } from "@/lib/time";
import { formatClock, pickFocus, workflowProgress, type Workflow } from "@/lib/workflow";
import { useNow } from "@/hooks/use-now";
import { SponsoredTag } from "./sponsored-tag";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";

const SHOWN = 3;

function deadline(item: ContentItem) {
  const due = item.due_date ? parseISO(item.due_date) : null;
  if (due && isValid(due)) {
    const overdue = isBefore(due, startOfToday());
    return { text: `${overdue ? "overdue" : "due"} ${format(due, "MMM d")}`, overdue };
  }
  const publish = item.publish_at ? parseISO(item.publish_at) : null;
  if (publish && isValid(publish)) return { text: `publishes ${format(publish, "MMM d")}`, overdue: false };
  return { text: "no due date", overdue: false };
}

function RunCard({ item, focus, steps, stages }: { item: ContentItem; focus: boolean; steps: Workflow; stages: StageList }) {
  const setFocusId = useUI((s) => s.setFocusId);
  const navigate = useNavigate();
  const current = stageIndex(item.stage, stages);
  const due = deadline(item);
  const started = item.creation_started_at ? Date.parse(item.creation_started_at) : NaN;
  const creating = !Number.isNaN(started) && !item.creation_finished_at;
  const now = useNow(creating);
  const tasks = Array.isArray(item.workflow_done) ? workflowProgress(item.workflow_done, steps) : null;
  return (
    <button
      type="button"
      onClick={() => {
        setFocusId(item.id);
        void navigate({ to: "/pipeline" });
      }}
      className="calendar-enter block w-full rounded-lg border bg-card px-4 py-3.5 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 break-words text-[15px] font-medium leading-snug">
          {focus && <span className="mr-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] font-medium text-primary">Focus</span>}
          {item.title}
          <SponsoredTag videoId={item.id} className="ml-1.5" />
        </span>
        <span className={cn("shrink-0 whitespace-nowrap font-mono text-xs", due.overdue ? "text-destructive" : "text-muted-foreground")}>
          {due.text}
        </span>
      </span>
      <span className="mt-3 flex gap-1.5" aria-hidden>
        {stages.map((stage, i) => (
          <span key={stage.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            {i <= current && (
              <span
                className={cn("segment-fill block h-full w-full", i < current ? "bg-primary" : "bg-primary/40")}
                style={{ animationDelay: `${i * 60}ms` }}
              />
            )}
          </span>
        ))}
      </span>
      <span className="mt-2.5 flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span>
          Stage {current + 1} · {stages[current]?.label}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-xs">
          {creating ? (
            <>
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-success" />
              {formatClock(now - started)}
            </>
          ) : tasks && tasks.done ? (
            `${tasks.done}/${tasks.total} tasks`
          ) : item.minutes_logged ? (
            `${formatMinutes(item.minutes_logged)} logged`
          ) : (
            "not started"
          )}
        </span>
      </span>
    </button>
  );
}

/** In-progress videos from Working on, soonest deadline first. Updates live with the pipeline. */
export function ActiveRuns({ items, isLoading }: { items: ContentItem[]; isLoading: boolean }) {
  const focus = pickFocus(items, useUI((s) => s.focusId));
  const { steps } = useWorkflow();
  const { stages } = useStages();
  const others = activeRuns(items, stages).filter((i) => i.id !== focus?.id);
  const runs = focus ? [focus, ...others] : others;
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-sm">Continue working on</h2>
        <Link to="/pipeline/board" className="text-xs font-medium text-primary hover:underline">
          All runs{runs.length > SHOWN ? ` (${runs.length})` : ""}
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-[88px]" />
          <Skeleton className="h-[88px]" />
        </div>
      ) : runs.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
          No videos in progress. Move an idea forward in{" "}
          <Link to="/pipeline" className="font-medium text-primary hover:underline">
            Working on
          </Link>{" "}
          to start a run.
        </p>
      ) : (
        <div className="space-y-2.5">
          {runs.slice(0, SHOWN).map((item) => (
            <RunCard key={item.id} item={item} focus={item.id === focus?.id} steps={steps} stages={stages} />
          ))}
        </div>
      )}
    </section>
  );
}
