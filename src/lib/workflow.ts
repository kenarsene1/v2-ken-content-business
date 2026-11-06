import { stageIndex } from "./runs";
import { DEFAULT_STAGES, type StageList } from "./stages";

/**
 * The focus workflow for one video: a short, fixed set of steps and tasks.
 * Task ids are stored in content_items.workflow_done, so never rename an id.
 */
export type WorkflowTask = { id: string; label: string; tip: string; minutes: number };
export type WorkflowStep = { id: string; label: string; stage: string; diamond?: boolean; tasks: WorkflowTask[] };

export const WORKFLOW: WorkflowStep[] = [
  {
    id: "plan",
    label: "Plan",
    stage: "researching",
    tasks: [
      { id: "topic", label: "Lock the topic or collab", tip: "Pick from the idea bank", minutes: 10 },
      { id: "outline", label: "Outline talking points", tip: "Follow your usual format", minutes: 30 },
      { id: "assets", label: "Prepare tools, clips & prompts", tip: "Open every tool first", minutes: 20 },
    ],
  },
  {
    id: "record",
    label: "Record",
    stage: "filming",
    tasks: [
      { id: "record", label: "Record the tool walkthrough", tip: "No voiceover, one tidy folder", minutes: 45 },
      { id: "cut", label: "Cut the long recording", tip: "Drop dead time only", minutes: 20 },
    ],
  },
  {
    id: "voice",
    label: "Script & voice",
    stage: "scripting",
    tasks: [
      { id: "script", label: "Write the voiceover script", tip: "Talk it, transcribe, polish with AI", minutes: 30 },
      { id: "voiceover", label: "Generate the voiceover", tip: "ElevenLabs or Fish Audio", minutes: 15 },
      { id: "merge", label: "Merge voice with the cut", tip: "Rough final cut", minutes: 15 },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    stage: "editing",
    diamond: true,
    tasks: [
      { id: "edit-1", label: "Avatar & assets in editor", tip: "Phase 1", minutes: 30 },
      { id: "edit-2", label: "Intro & motion graphics", tip: "Phase 2 · first 30s matter most", minutes: 60 },
      { id: "edit-3", label: "Color, music & final tweaks", tip: "Phase 3", minutes: 45 },
    ],
  },
  {
    id: "ship",
    label: "Ship",
    stage: "scheduled",
    tasks: [
      { id: "package", label: "Title & thumbnail", tip: "Pick your strongest option", minutes: 20 },
      { id: "schedule", label: "Upload & schedule", tip: "Set the publish date", minutes: 10 },
    ],
  },
];

export type Workflow = readonly WorkflowStep[];

/** Task ids per workflow, cached so progress checks stay cheap on every render. */
const idCache = new WeakMap<Workflow, Set<string>>();
function taskIds(steps: Workflow) {
  let ids = idCache.get(steps);
  if (!ids) idCache.set(steps, (ids = new Set(steps.flatMap((s) => s.tasks.map((t) => t.id)))));
  return ids;
}
export const TOTAL_TASKS = taskIds(WORKFLOW).size;

export type StepProgress = { step: WorkflowStep; done: number; complete: boolean };
export type WorkflowProgress = {
  done: number;
  total: number;
  steps: StepProgress[];
  /** First step with work left, or null when everything is done. */
  currentStep: WorkflowStep | null;
  /** First unchecked task: the one small thing to do next. */
  nextTask: WorkflowTask | null;
  minutesLeft: number;
};

/** Progress for a video, ignoring task ids that are no longer in the workflow. */
export function workflowProgress(doneIds: readonly string[] | null | undefined, steps: Workflow = WORKFLOW): WorkflowProgress {
  const ids = taskIds(steps);
  const done = new Set((doneIds ?? []).filter((id) => ids.has(id)));
  const progress = steps.map((step) => {
    const count = step.tasks.filter((t) => done.has(t.id)).length;
    return { step, done: count, complete: count === step.tasks.length };
  });
  const remaining = steps.flatMap((s) => s.tasks).filter((t) => !done.has(t.id));
  return {
    done: done.size,
    total: ids.size,
    steps: progress,
    currentStep: progress.find((s) => !s.complete)?.step ?? null,
    nextTask: remaining[0] ?? null,
    minutesLeft: remaining.reduce((sum, t) => sum + t.minutes, 0),
  };
}

export function toggleTask(doneIds: readonly string[] | null | undefined, id: string, steps: Workflow = WORKFLOW): string[] {
  const ids = taskIds(steps);
  const list = (doneIds ?? []).filter((x) => ids.has(x));
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * Pipeline stage that matches the workflow, moving forward only.
 * Returns null when the stage should stay as it is.
 */
export function stageForWorkflow(
  stage: string,
  doneIds: readonly string[],
  steps: Workflow = WORKFLOW,
  stages: StageList = DEFAULT_STAGES,
): string | null {
  if (stage === "published") return null;
  const { currentStep } = workflowProgress(doneIds, steps);
  const target = currentStep?.stage ?? "scheduled";
  // A step may point at a column that was removed since: then leave the stage alone.
  if (!stages.some((s) => s.id === target)) return null;
  return stageIndex(target, stages) > stageIndex(stage, stages) ? target : null;
}

/* ---------- Editing your workflow (pure: every edit returns a new list) ---------- */

export const LIMITS = { label: 80, tip: 80, minutes: 600, steps: 12, tasks: 20 } as const;
/** Stages a step can move a video to. Publishing stays a deliberate action in the pipeline. */
export const stepStages = (stages: StageList = DEFAULT_STAGES) => stages.filter((s) => s.id !== "published");

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
export const clampMinutes = (n: number) => Math.min(LIMITS.minutes, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));
// Any column id except Published (columns are user-editable, so the list isn't fixed here).
const isStepStage = (id: unknown): id is string => typeof id === "string" && !!id && id.length <= 40 && id !== "published";

export type TaskPatch = Partial<Pick<WorkflowTask, "label" | "tip" | "minutes">>;
export type StepPatch = Partial<Pick<WorkflowStep, "label" | "stage">>;

export function updateTask(steps: Workflow, taskId: string, patch: TaskPatch): WorkflowStep[] {
  return steps.map((s) => ({
    ...s,
    tasks: s.tasks.map((t) =>
      t.id !== taskId
        ? t
        : {
            ...t,
            ...(patch.label !== undefined ? { label: text(patch.label, LIMITS.label) || t.label } : {}),
            ...(patch.tip !== undefined ? { tip: text(patch.tip, LIMITS.tip) } : {}),
            ...(patch.minutes !== undefined ? { minutes: clampMinutes(patch.minutes) } : {}),
          },
    ),
  }));
}

/** Adds a task after `afterTaskId` (or at the end of the step). Returns the new list and the new task id (null if full). */
export function addTask(steps: Workflow, stepId: string, afterTaskId: string | null = null) {
  const task: WorkflowTask = { id: newId("t"), label: "New task", tip: "", minutes: 15 };
  let added = false;
  const next = steps.map((s) => {
    if (s.id !== stepId || s.tasks.length >= LIMITS.tasks) return s;
    const after = afterTaskId ? s.tasks.findIndex((t) => t.id === afterTaskId) : -1;
    const tasks = [...s.tasks];
    tasks.splice(after >= 0 ? after + 1 : tasks.length, 0, task);
    added = true;
    return { ...s, tasks };
  });
  return { steps: next, id: added ? task.id : null };
}

/** Removes a task. A step keeps at least one task (remove the step instead). */
export function removeTask(steps: Workflow, taskId: string): WorkflowStep[] {
  return steps.map((s) => (s.tasks.length > 1 ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) } : s));
}

export function updateStep(steps: Workflow, stepId: string, patch: StepPatch): WorkflowStep[] {
  return steps.map((s) =>
    s.id !== stepId
      ? s
      : {
          ...s,
          ...(patch.label !== undefined ? { label: text(patch.label, LIMITS.label) || s.label } : {}),
          ...(isStepStage(patch.stage) ? { stage: patch.stage } : {}),
        },
  );
}

/** Adds a step (with one starter task) after `afterStepId`. Returns the new list and the new step id (null if full). */
export function addStep(steps: Workflow, afterStepId: string) {
  if (steps.length >= LIMITS.steps) return { steps: [...steps], id: null };
  const after = steps.findIndex((s) => s.id === afterStepId);
  const at = after >= 0 ? after + 1 : steps.length;
  const step: WorkflowStep = {
    id: newId("s"),
    label: "New step",
    stage: steps[at - 1]?.stage ?? "researching",
    tasks: [{ id: newId("t"), label: "New task", tip: "", minutes: 15 }],
  };
  const next = [...steps];
  next.splice(at, 0, step);
  return { steps: next, id: step.id };
}

/** Removes a step. The workflow keeps at least one step. */
export function removeStep(steps: Workflow, stepId: string): WorkflowStep[] {
  return steps.length > 1 ? steps.filter((s) => s.id !== stepId) : [...steps];
}

/** Loose shape of a saved step or task, before checking each field. */
type Raw = { id?: unknown; label?: unknown; tip?: unknown; minutes?: unknown; stage?: unknown; diamond?: unknown; tasks?: unknown };
const asRaw = (v: unknown): Raw | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null);

/** Reads a saved workflow. Malformed parts are dropped; returns null when nothing usable is saved. */
export function parseWorkflow(value: unknown): WorkflowStep[] | null {
  if (!Array.isArray(value)) return null;
  // Step ids and task ids are checked separately: a step and a task may share an id (e.g. "record").
  const unique = (seen: Set<string>) => (id: unknown): id is string => {
    if (typeof id !== "string" || !id || id.length > 64 || seen.has(id)) return false;
    seen.add(id);
    return true;
  };
  const freshStepId = unique(new Set());
  const freshTaskId = unique(new Set());
  const steps: WorkflowStep[] = [];
  for (const item of value.slice(0, LIMITS.steps)) {
    const s = asRaw(item);
    if (!s || !freshStepId(s.id) || !Array.isArray(s.tasks)) continue;
    const tasks: WorkflowTask[] = [];
    for (const taskItem of s.tasks.slice(0, LIMITS.tasks)) {
      const t = asRaw(taskItem);
      if (!t || !freshTaskId(t.id)) continue;
      tasks.push({ id: t.id, label: text(t.label, LIMITS.label) || "Task", tip: text(t.tip, LIMITS.tip), minutes: clampMinutes(Number(t.minutes)) });
    }
    if (!tasks.length) continue;
    steps.push({
      id: s.id,
      label: text(s.label, LIMITS.label) || "Step",
      stage: isStepStage(s.stage) ? s.stage : "researching",
      ...(s.diamond === true ? { diamond: true } : {}),
      tasks,
    });
  }
  return steps.length ? steps : null;
}

/** Short duration: "42m", "3h 10m", "2d 4h". */
export function formatSpan(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`;
}

/** Live clock: "4:05" under an hour, "1:02:03" after, "2d 4h" after a day. */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total >= 86_400) return formatSpan(ms);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

type Focusable = {
  id: string;
  stage: string;
  due_date: string | null;
  creation_started_at?: string | null;
  creation_finished_at?: string | null;
};

const isCreating = (i: Focusable) => !!i.creation_started_at && !i.creation_finished_at;

/** Videos you can focus on: in creation first, then in-progress runs, then pipeline ideas. */
export function focusCandidates<T extends Focusable>(items: T[]): T[] {
  const open = items.filter((i) => i.stage !== "published");
  const rank = (i: T) => (isCreating(i) ? 0 : i.stage === "idea" ? 2 : 1);
  return open.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      stageIndex(b.stage) - stageIndex(a.stage),
  );
}

/** The one video to work on: your pick if it is still open, otherwise the top candidate. */
export function pickFocus<T extends Focusable>(items: T[], focusId: string | null): T | null {
  const candidates = focusCandidates(items);
  return candidates.find((i) => i.id === focusId) ?? candidates[0] ?? null;
}
