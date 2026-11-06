import { describe, expect, it } from "vitest";
import {
  addStep, addTask, focusCandidates, formatClock, formatSpan, parseWorkflow, pickFocus, removeStep, removeTask, stageForWorkflow,
  toggleTask, TOTAL_TASKS, updateStep, updateTask, WORKFLOW, workflowProgress,
} from "@/lib/workflow";

const ids = (stepId: string) => WORKFLOW.find((s) => s.id === stepId)!.tasks.map((t) => t.id);

describe("workflow", () => {
  it("has unique task ids and a short, timed task list", () => {
    const all = WORKFLOW.flatMap((s) => s.tasks.map((t) => t.id));
    expect(new Set(all).size).toBe(all.length);
    expect(TOTAL_TASKS).toBe(all.length);
    expect(WORKFLOW.every((s) => s.tasks.every((t) => t.minutes > 0 && t.tip))).toBe(true);
  });

  it("tracks progress, the current step and the next task", () => {
    const p = workflowProgress([...ids("plan"), "record", "made-up"]);
    expect(p.done).toBe(4);
    expect(p.steps[0]!.complete).toBe(true);
    expect(p.currentStep?.id).toBe("record");
    expect(p.nextTask?.id).toBe("cut");
    expect(workflowProgress(WORKFLOW.flatMap((s) => s.tasks.map((t) => t.id))).currentStep).toBeNull();
    expect(workflowProgress(null).minutesLeft).toBe(WORKFLOW.flatMap((s) => s.tasks).reduce((n, t) => n + t.minutes, 0));
  });

  it("toggles tasks and drops unknown ids", () => {
    expect(toggleTask(["topic", "gone"], "outline")).toEqual(["topic", "outline"]);
    expect(toggleTask(["topic", "outline"], "topic")).toEqual(["outline"]);
  });

  it("moves the pipeline stage forward only", () => {
    expect(stageForWorkflow("idea", [])).toBe("researching");
    expect(stageForWorkflow("researching", ids("plan"))).toBe("filming");
    // Script & voice maps to scripting, which sits before filming: stay put.
    expect(stageForWorkflow("filming", [...ids("plan"), ...ids("record")])).toBeNull();
    expect(stageForWorkflow("filming", [...ids("plan"), ...ids("record"), ...ids("voice")])).toBe("editing");
    expect(stageForWorkflow("editing", WORKFLOW.flatMap((s) => s.tasks.map((t) => t.id)))).toBe("scheduled");
    expect(stageForWorkflow("published", [])).toBeNull();
  });

  it("formats durations and live clocks", () => {
    expect(formatSpan(42 * 60_000)).toBe("42m");
    expect(formatSpan(190 * 60_000)).toBe("3h 10m");
    expect(formatSpan(52 * 3_600_000)).toBe("2d 4h");
    expect(formatClock(245_000)).toBe("4:05");
    expect(formatClock(3_723_000)).toBe("1:02:03");
  });

  it("picks one focus video: your pick, else the one being created, else the soonest run", () => {
    const v = (id: string, stage: string, patch = {}) => ({ id, stage, due_date: null as string | null, ...patch });
    const items = [
      v("idea", "idea"),
      v("soon", "editing", { due_date: "2026-11-01" }),
      v("live", "filming", { creation_started_at: "2026-10-27T09:00:00Z" }),
      v("out", "published"),
    ];
    expect(focusCandidates(items).map((i) => i.id)).toEqual(["live", "soon", "idea"]);
    expect(pickFocus(items, null)?.id).toBe("live");
    expect(pickFocus(items, "soon")?.id).toBe("soon");
    expect(pickFocus(items, "out")?.id).toBe("live");
    expect(pickFocus([], null)).toBeNull();
  });
});

describe("editing your workflow", () => {
  const plan = () => WORKFLOW.find((s) => s.id === "plan")!;

  it("edits a task, keeping a name and clamping the time", () => {
    const next = updateTask(WORKFLOW, "topic", { label: "  Pick the idea ", tip: "From the bank", minutes: 9999 });
    const task = next[0]!.tasks[0]!;
    expect(task).toEqual({ id: "topic", label: "Pick the idea", tip: "From the bank", minutes: 600 });
    expect(updateTask(WORKFLOW, "topic", { label: "   " })[0]!.tasks[0]!.label).toBe("Lock the topic or collab");
    expect(updateTask(WORKFLOW, "topic", { minutes: 0 })[0]!.tasks[0]!.minutes).toBe(1);
    expect(WORKFLOW[0]!.tasks[0]!.label).toBe("Lock the topic or collab"); // original untouched
  });

  it("adds and removes tasks, keeping at least one per step", () => {
    const { steps, id } = addTask(WORKFLOW, "plan", "topic");
    expect(steps[0]!.tasks.map((t) => t.id)).toEqual(["topic", id, "outline", "assets"]);
    const removed = removeTask(steps, id!);
    expect(removed[0]!.tasks.map((t) => t.id)).toEqual(ids("plan"));
    const single = [{ ...plan(), tasks: [plan().tasks[0]!] }];
    expect(removeTask(single, "topic")[0]!.tasks).toHaveLength(1);
  });

  it("renames steps, changes their stage, adds and removes steps", () => {
    expect(updateStep(WORKFLOW, "plan", { label: "Prep", stage: "scripting" })[0]).toMatchObject({ label: "Prep", stage: "scripting" });
    expect(updateStep(WORKFLOW, "plan", { stage: "published" })[0]!.stage).toBe("researching");
    const { steps, id } = addStep(WORKFLOW, "plan");
    expect(steps[1]).toMatchObject({ id, label: "New step", stage: "researching" });
    expect(steps[1]!.tasks).toHaveLength(1);
    expect(removeStep(steps, id!)).toHaveLength(WORKFLOW.length);
    expect(removeStep([plan()], "plan")).toHaveLength(1);
  });

  it("tracks progress and stages on a custom workflow, ignoring removed tasks", () => {
    const custom = removeTask(WORKFLOW, "outline");
    const p = workflowProgress(["topic", "outline", "assets"], custom);
    expect(p.total).toBe(TOTAL_TASKS - 1);
    expect(p.done).toBe(2);
    expect(p.currentStep?.id).toBe("record");
    expect(stageForWorkflow("researching", ["topic", "assets"], custom)).toBe("filming");
    expect(toggleTask(["outline"], "topic", custom)).toEqual(["topic"]);
  });

  it("reads saved workflows safely", () => {
    expect(parseWorkflow(null)).toBeNull();
    expect(parseWorkflow([])).toBeNull();
    expect(parseWorkflow(JSON.parse(JSON.stringify(WORKFLOW)))).toEqual(WORKFLOW);
    const messy = [
      { id: "a", label: "", stage: 5, tasks: [{ id: "t1", label: "Do it", minutes: "20" }, { id: "t1", label: "dupe" }, "junk"] },
      { id: "b", tasks: [] },
      "junk",
    ];
    expect(parseWorkflow(messy)).toEqual([{ id: "a", label: "Step", stage: "researching", tasks: [{ id: "t1", label: "Do it", tip: "", minutes: 20 }] }]);
  });
});
