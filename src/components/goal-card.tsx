import { FolderKanban, NotebookPen, Target } from "lucide-react";
import { dueLabel, goalPace, goalProgress, kindLabel, PACE_LABELS, type Goal, type GoalVideo } from "@/lib/goals";
import type { Account } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";
import { GoalBar, GoalRing } from "./goal-meter";

const KIND_ICONS = { goal: Target, plan: NotebookPen, project: FolderKanban } as const;

export function GoalKindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = KIND_ICONS[kind as keyof typeof KIND_ICONS] ?? Target;
  return <Icon className={className} />;
}

const PACE_STYLES = {
  on_track: "bg-success-soft text-success",
  behind: "bg-warning-soft text-warning",
  overdue: "bg-destructive/10 text-destructive",
} as const;

export function GoalCard({ goal: g, channel, videos }: { goal: Goal; channel: Account | undefined; videos?: readonly GoalVideo[] | undefined }) {
  const openGoal = useUI((s) => s.openGoal);
  const { fraction, label } = goalProgress(g, channel, videos);
  const pace = goalPace(g, fraction);
  const due = g.status === "done" ? null : dueLabel(g.due_date);
  const ring = fraction !== null && g.display === "ring";

  return (
    <button
      type="button"
      onClick={() => openGoal(g.id)}
      className={cn(
        "calendar-enter flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card p-3.5 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none",
        g.status !== "active" && "opacity-70",
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <GoalKindIcon kind={g.kind} className="h-3 w-3" /> {kindLabel(g.kind)}
            {g.status === "paused" && <span>· Paused</span>}
            {g.status === "done" && <span className="text-success">· Done</span>}
          </span>
          <span className="mt-1 line-clamp-2 break-words text-sm font-medium leading-snug">{g.title}</span>
        </span>
        {ring && fraction !== null && <GoalRing fraction={fraction} />}
      </span>

      {g.notes && <span className="line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">{g.notes}</span>}
      {fraction !== null && !ring && <GoalBar fraction={fraction} display={g.display} />}

      <span className="mt-auto flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {label && <span className="tabular-nums">{label}</span>}
        <span className="ml-auto flex items-center gap-2">
          {pace && <span className={cn("rounded-full px-1.5 py-0.5 font-medium", PACE_STYLES[pace])}>{PACE_LABELS[pace]}</span>}
          {due && pace !== "overdue" && <span className={cn(due.startsWith("Overdue") && "text-destructive")}>{due}</span>}
        </span>
      </span>
    </button>
  );
}
