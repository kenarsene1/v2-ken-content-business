import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { Check, Columns3, DatabaseZap, Flag, Play, Plus, RotateCcw, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaveWorkflow, useScopedContent, useStages, useUpdateContent, useWorkflow, type ContentItem } from "@/lib/queries";
import { stageLabel, type StageList } from "@/lib/stages";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  addStep, addTask, focusCandidates, formatClock, formatSpan, pickFocus, removeStep, removeTask, stageForWorkflow, stepStages,
  toggleTask, updateStep, updateTask, workflowProgress, type StepProgress, type TaskPatch, type WorkflowStep, type WorkflowTask,
} from "@/lib/workflow";
import { useNewContent } from "./app-shell";
import { Burst } from "./burst";
import { SponsoredTag } from "./sponsored-tag";
import { RefLink } from "./ref-link";
import { InlineEdit, StepMenu, TaskMenu, type EditTarget } from "./workflow-editing";
import { useNow } from "@/hooks/use-now";

const ms = (iso: string | null | undefined) => {
  const d = iso ? parseISO(iso) : null;
  return d && isValid(d) ? d.getTime() : null;
};

/** Working on: one video at a time, as a small step-by-step diagram on a dotted canvas. */
export function FocusWorkspace() {
  const { data: items, isLoading } = useScopedContent();
  const { focusId, setFocusId } = useUI();
  const { stages } = useStages();
  const newContent = useNewContent();
  const video = pickFocus(items ?? [], focusId);
  const candidates = focusCandidates(items ?? []);

  return (
    <div className="mx-auto max-w-2xl space-y-3 calendar-enter">
      <div className="flex items-center gap-2">
        <Target className="h-3.5 w-3.5 shrink-0 text-primary" />
        <h1 className="sr-only">Working on</h1>
        {candidates.length > 1 && video ? (
          <Select value={video.id} onValueChange={setFocusId}>
            <SelectTrigger aria-label="Switch video" className="h-7 w-auto min-w-0 max-w-[65%] gap-1.5 border-0 bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.title} <span className="text-muted-foreground">· {stageLabel(c.stage, stages)}</span>
                  <SponsoredTag videoId={c.id} className="ml-1.5" />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">Working on</span>
        )}
        <Button asChild variant="outline" size="sm" className="ml-auto h-7 gap-1.5 px-2.5 text-xs">
          <Link to="/pipeline/board">
            <Columns3 className="h-3.5 w-3.5" /> Pipeline
          </Link>
        </Button>
      </div>

      <div className="canvas-dots rounded-xl border p-3 sm:p-5">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-40" />
          </div>
        ) : !video ? (
          <div className="mx-auto my-8 max-w-xs rounded-lg border bg-card px-5 py-6 text-center shadow-sm">
            <p className="text-sm font-medium">Nothing in progress</p>
            <p className="mt-1 text-xs text-muted-foreground">Pick one small video and take it all the way.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => void newContent("Untitled", "researching")}>
                <Plus className="h-3.5 w-3.5" /> New video
              </Button>
              <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                <Link to="/pipeline/board">Open pipeline</Link>
              </Button>
            </div>
          </div>
        ) : !Array.isArray(video.workflow_done) ? (
          <div className="mx-auto my-8 max-w-sm rounded-lg border bg-card px-5 py-6 text-center">
            <DatabaseZap className="mx-auto mb-2 h-5 w-5 text-primary/60" />
            <p className="text-sm font-medium">Working on needs a quick database update</p>
            <p className="mt-1 text-xs text-muted-foreground">In Lovable, ask it to apply the latest database migration, then reload.</p>
          </div>
        ) : (
          <Workflow key={video.id} video={video} />
        )}
      </div>
    </div>
  );
}

function Workflow({ video }: { video: ContentItem }) {
  const update = useUpdateContent();
  const { openContent, setFocusId } = useUI();
  const { steps, custom, editable } = useWorkflow();
  const { stages } = useStages();
  const saveWorkflow = useSaveWorkflow();
  const progress = workflowProgress(video.workflow_done, steps);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pop, setPop] = useState<{ id: string; n: number } | null>(null);
  const [stepPop, setStepPop] = useState<{ id: string; n: number } | null>(null);
  const [finishBurst, setFinishBurst] = useState(0);

  const started = ms(video.creation_started_at);
  const finished = ms(video.creation_finished_at);

  const start = () => {
    setFocusId(video.id);
    update.mutate({
      id: video.id,
      patch: {
        creation_started_at: new Date().toISOString(),
        creation_finished_at: null,
        // Starting moves an idea into the first working column.
        ...(video.stage === "idea" && stages[1] ? { stage: stages[1].id } : {}),
      },
    });
    toast("Clock started. One task at a time.");
  };

  const finish = () => {
    const now = new Date();
    update.mutate({ id: video.id, patch: { creation_finished_at: now.toISOString() } });
    setFinishBurst((n) => n + 1);
    const left = progress.total - progress.done;
    toast.success(`Video created in ${formatSpan(now.getTime() - (started ?? now.getTime()))}`, {
      description: left ? `${left} task${left === 1 ? "" : "s"} left unchecked.` : "Every step done. Great work.",
    });
  };

  const reset = () => update.mutate({ id: video.id, patch: { creation_started_at: null, creation_finished_at: null } });

  // Workflow edits apply to every video; each video keeps its own ticks by task id.
  const edit = (next: WorkflowStep[]) => saveWorkflow.mutate(next);
  const stopEditing = () => setEditing(null);
  const open = (stepId: string) => setExpanded((e) => ({ ...e, [stepId]: true }));
  const resetWorkflow = () => {
    saveWorkflow.mutate([]);
    toast("Workflow reset to default");
  };
  const newTask = (stepId: string, afterTaskId: string | null) => {
    const added = addTask(steps, stepId, afterTaskId);
    if (!added.id) {
      toast("This step is full");
      return;
    }
    edit(added.steps);
    open(stepId);
    setEditing({ kind: "task-label", id: added.id });
  };
  const newStep = (afterStepId: string) => {
    const added = addStep(steps, afterStepId);
    if (!added.id) {
      toast("That's the most steps a workflow can have");
      return;
    }
    edit(added.steps);
    open(added.id);
    setEditing({ kind: "step-label", id: added.id });
  };

  const toggle = (step: StepProgress, task: WorkflowTask) => {
    const next = toggleTask(video.workflow_done, task.id, steps);
    const checking = next.includes(task.id);
    const stage = stageForWorkflow(video.stage, next, steps, stages);
    const autoStart = checking && started === null;
    update.mutate({
      id: video.id,
      patch: {
        workflow_done: next,
        ...(stage ? { stage } : {}),
        ...(autoStart ? { creation_started_at: new Date().toISOString() } : {}),
      },
    });
    if (!checking) return;
    setPop((p) => ({ id: task.id, n: (p?.n ?? 0) + 1 }));
    const after = workflowProgress(next, steps);
    if (autoStart) toast("Clock started");
    if (step.done + 1 === step.step.tasks.length) {
      setExpanded((e) => ({ ...e, [step.step.id]: false }));
      setStepPop((p) => ({ id: step.step.id, n: (p?.n ?? 0) + 1 }));
      toast.success(`${step.step.label} done`, {
        description: after.nextTask ? `Next: ${after.nextTask.label}` : "All done. Press Finish to stop the clock.",
      });
    }
  };

  const percent = Math.round((progress.done / progress.total) * 100);

  return (
    <div className="space-y-4">
      <div className="relative rounded-lg border bg-card p-3.5 shadow-sm">
        {finishBurst > 0 && <Burst key={finishBurst} count={20} spread={60} />}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-[15px] font-medium leading-snug">
              <button type="button" onClick={() => openContent(video.id)} className="text-left hover:underline" title="Open details">
                {video.title}
              </button>
              <SponsoredTag videoId={video.id} className="ml-1.5" />
              <RefLink url={video.ref_url} className="ml-1" />
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {stageLabel(video.stage, stages)}
              {video.due_date && isValid(parseISO(video.due_date)) ? ` · due ${format(parseISO(video.due_date), "MMM d")}` : ""}
              {progress.minutesLeft ? ` · ~${formatSpan(progress.minutesLeft * 60_000)} left` : ""}
            </p>
          </div>
          <Clock started={started} finished={finished} allDone={!progress.nextTask} onStart={start} onFinish={finish} onReset={reset} />
        </div>
        <div className="mt-3 flex items-center gap-2.5">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">{progress.done}/{progress.total}</span>
        </div>
      </div>

      <ol aria-label="Workflow">
        {progress.steps.map((s, i) => {
          const isCurrent = s.step.id === progress.currentStep?.id;
          const isOpen = expanded[s.step.id] ?? isCurrent;
          const last = i === progress.steps.length - 1;
          return (
            <li key={s.step.id} className="relative grid grid-cols-[28px_1fr] gap-x-3 pb-3 last:pb-0">
              {!last && (
                <span aria-hidden className="absolute bottom-0 left-[13.5px] top-8 w-px overflow-hidden bg-border">
                  <span className={cn("connector-fill block h-full w-full bg-success", s.complete ? "scale-y-100" : "scale-y-0")} />
                </span>
              )}
              <Node index={i} step={s} current={isCurrent} burstKey={stepPop?.id === s.step.id ? stepPop.n : 0} />
              <div className={cn("min-w-0 rounded-lg border bg-card transition-colors", isCurrent ? "border-primary/40 shadow-sm" : "opacity-90")}>
                <StepMenu
                  disabled={!editable}
                  canRemove={steps.length > 1}
                  custom={custom}
                  onRename={() => setEditing({ kind: "step-label", id: s.step.id })}
                  onAddTask={() => newTask(s.step.id, null)}
                  onAddStep={() => newStep(s.step.id)}
                  onRemove={() => edit(removeStep(steps, s.step.id))}
                  onReset={resetWorkflow}
                >
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    {editing?.kind === "step-label" && editing.id === s.step.id ? (
                      <InlineEdit
                        label="Step name"
                        value={s.step.label}
                        className="flex-1 text-[13px] font-medium"
                        onSave={(label) => edit(updateStep(steps, s.step.id, { label }))}
                        onDone={stopEditing}
                      />
                    ) : (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setExpanded((e) => ({ ...e, [s.step.id]: !isOpen }))}
                        className={cn("min-w-0 flex-1 truncate py-0.5 text-left text-[13px] font-medium", s.complete && "text-muted-foreground")}
                      >
                        {s.step.label}
                      </button>
                    )}
                    <StageSelect stage={s.step.stage} step={s.step.label} options={stages} disabled={!editable} onChange={(stage) => edit(updateStep(steps, s.step.id, { stage }))} />
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {s.done}/{s.step.tasks.length} · ~{formatSpan(s.step.tasks.reduce((sum, t) => sum + t.minutes, 0) * 60_000)}
                    </span>
                  </div>
                </StepMenu>
                {isOpen && (
                  <ul className="calendar-enter border-t px-1.5 py-1">
                    {s.step.tasks.map((task) => (
                      <Task
                        key={task.id}
                        task={task}
                        diamond={!!s.step.diamond}
                        done={video.workflow_done.includes(task.id)}
                        next={progress.nextTask?.id === task.id}
                        popKey={pop?.id === task.id ? pop.n : 0}
                        onToggle={() => toggle(s, task)}
                        editing={editing?.id === task.id ? editing.kind : null}
                        onEdit={(kind) => setEditing({ kind, id: task.id })}
                        onSave={(patch) => edit(updateTask(steps, task.id, patch))}
                        onDone={stopEditing}
                        menu={{
                          disabled: !editable,
                          canRemove: s.step.tasks.length > 1,
                          custom,
                          onAdd: () => newTask(s.step.id, task.id),
                          onRemove: () => edit(removeTask(steps, task.id)),
                          onReset: resetWorkflow,
                        }}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {editable && (
        <p className="text-center text-[10px] text-muted-foreground/80">
          <span className="hidden sm:inline">Right-click</span><span className="sm:hidden">Long-press</span> a task or step to edit · tap a time or stage to change it
        </p>
      )}
    </div>
  );
}

/** Tiny picker for the pipeline stage a step moves the video to. */
function StageSelect({ stage, step, options, disabled, onChange }: {
  stage: string; step: string; options: StageList; disabled: boolean; onChange: (stage: string) => void;
}) {
  return (
    <Select value={stage} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label={`Pipeline stage for ${step}`}
        title="Pipeline stage this step moves the video to"
        className="h-5 w-auto shrink-0 gap-0.5 rounded-[4px] border-0 bg-transparent px-1 text-[10px] text-muted-foreground shadow-none hover:bg-muted disabled:opacity-100 [&_svg]:size-3"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {stepStages(options).map((x) => <SelectItem key={x.id} value={x.id} className="text-xs">{x.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Node({ index, step, current, burstKey }: { index: number; step: StepProgress; current: boolean; burstKey: number }) {
  return (
    <span className="relative mt-1 flex h-7 w-7 items-center justify-center">
      <span
        key={step.complete ? `done-${burstKey}` : "open"}
        className={cn(
          "flex h-6 w-6 items-center justify-center border text-[11px] font-medium",
          step.step.diamond ? "rotate-45 rounded-[5px]" : "rounded-md",
          step.complete
            ? cn("border-success", burstKey > 0 && "challenge-pop", "bg-success text-background")
            : current
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground",
        )}
      >
        <span className={cn(step.step.diamond && "-rotate-45")}>{step.complete ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
      </span>
      {step.complete && burstKey > 0 && <Burst key={burstKey} count={10} spread={18} />}
    </span>
  );
}

type TaskEditKind = "task-label" | "task-tip" | "task-minutes";

function Task({ task, diamond, done, next, popKey, onToggle, editing, onEdit, onSave, onDone, menu }: {
  task: WorkflowTask;
  diamond: boolean;
  done: boolean;
  next: boolean;
  popKey: number;
  onToggle: () => void;
  editing: NonNullable<EditTarget>["kind"] | null;
  onEdit: (kind: TaskEditKind) => void;
  onSave: (patch: TaskPatch) => void;
  onDone: () => void;
  menu: { disabled: boolean; canRemove: boolean; custom: boolean; onAdd: () => void; onRemove: () => void; onReset: () => void };
}) {
  return (
    <TaskMenu
      {...menu}
      onEdit={() => onEdit("task-label")}
      onTip={() => onEdit("task-tip")}
      onTime={() => onEdit("task-minutes")}
    >
      <li className="group rounded-md px-1.5 py-1.5 hover:bg-muted/60">
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={task.label}
            onClick={onToggle}
            className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              key={done ? `on-${popKey}` : "off"}
              className={cn(
                "flex h-3.5 w-3.5 items-center justify-center border transition-colors",
                diamond ? "rotate-45 rounded-[3px]" : "rounded-[4px]",
                done ? "challenge-pop border-success bg-success text-background" : "border-muted-foreground/40 group-hover:border-primary",
              )}
            >
              {done && <Check className={cn("h-2.5 w-2.5", diamond && "-rotate-45")} strokeWidth={3} />}
            </span>
            {done && popKey > 0 && (
              <>
                <Burst key={`b-${popKey}`} count={8} spread={14} />
                <span key={`x-${popKey}`} aria-hidden className="xp-float pointer-events-none absolute -top-3 left-4 text-[10px] font-semibold text-success">
                  +1
                </span>
              </>
            )}
          </button>
          <div className="min-w-0 flex-1">
            {editing === "task-label" ? (
              <InlineEdit label="Task name" value={task.label} className="w-full text-[13px]" onSave={(label) => onSave({ label })} onDone={onDone} />
            ) : (
              // Clicking the label ticks the task too, like a normal checkbox label.
              <span
                onClick={onToggle}
                className={cn("flex cursor-pointer items-center gap-1.5 text-[13px] leading-snug", done && "text-muted-foreground line-through")}
              >
                {task.label}
                {next && <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary no-underline">next</span>}
              </span>
            )}
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] leading-snug text-muted-foreground">
              {editing === "task-minutes" ? (
                <InlineEdit
                  type="number"
                  label="Minutes"
                  value={String(task.minutes)}
                  className="h-4 text-[11px]"
                  onSave={(v) => onSave({ minutes: Number(v) })}
                  onDone={onDone}
                />
              ) : (
                <button
                  type="button"
                  title={menu.disabled ? undefined : "Change time"}
                  disabled={menu.disabled}
                  onClick={() => onEdit("task-minutes")}
                  className="shrink-0 rounded-[3px] tabular-nums enabled:hover:bg-muted enabled:hover:text-foreground"
                >
                  ~{formatSpan(task.minutes * 60_000)}
                </button>
              )}
              {editing === "task-tip" ? (
                <>
                  <span aria-hidden>·</span>
                  <InlineEdit label="Tip" value={task.tip} placeholder="Short tip" className="h-4 flex-1 text-[11px]" onSave={(tip) => onSave({ tip })} onDone={onDone} />
                </>
              ) : (
                task.tip && <span className="truncate">· {task.tip}</span>
              )}
            </span>
          </div>
        </div>
      </li>
    </TaskMenu>
  );
}

function Clock({ started, finished, allDone, onStart, onFinish, onReset }: {
  started: number | null; finished: number | null; allDone: boolean; onStart: () => void; onFinish: () => void; onReset: () => void;
}) {
  const running = started !== null && finished === null;
  const now = useNow(running);
  if (started === null) {
    return (
      <Button size="sm" className="h-7 shrink-0 gap-1 px-2.5 text-xs" onClick={onStart}>
        <Play className="h-3 w-3 fill-current" /> Start creation
      </Button>
    );
  }
  if (finished !== null) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <span className="challenge-pop inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
          <Flag className="h-3 w-3" /> Created in {formatSpan(finished - started)}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" title="Reset clock" aria-label="Reset clock" onClick={onReset}>
          <RotateCcw className="h-3 w-3" />
        </Button>
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="flex items-center gap-1.5 font-mono text-xs tabular-nums" aria-label="Time creating">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-success" />
        {formatClock(now - started)}
      </span>
      <Button variant={allDone ? "default" : "outline"} size="sm" className={cn("h-7 gap-1 px-2.5 text-xs", allDone && "challenge-pop")} onClick={onFinish}>
        <Flag className="h-3 w-3" /> Finish
      </Button>
    </span>
  );
}
