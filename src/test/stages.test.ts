import { describe, expect, it } from "vitest";
import { addStage, columnFor, DEFAULT_STAGES, isCoreStage, normalizeStages, parseStages, removeStage, renameStage, stageLabel } from "@/lib/stages";
import { activeRuns, stageIndex } from "@/lib/runs";
import { stageForWorkflow, WORKFLOW } from "@/lib/workflow";

const ids = (list: readonly { id: string }[]) => list.map((s) => s.id);

describe("pipeline columns", () => {
  it("keeps Idea first and Scheduled, Published last", () => {
    const list = normalizeStages([{ id: "published" }, { id: "edit", label: "Edit" }, { id: "idea", label: "Spark" }, { id: "edit" }]);
    expect(ids(list)).toEqual(["idea", "edit", "scheduled", "published"]);
    expect(list[0]!.label).toBe("Spark");
    expect(list[2]!.label).toBe("Scheduled");
  });

  it("reads saved columns, or null for none", () => {
    expect(parseStages([])).toBeNull();
    expect(parseStages("x")).toBeNull();
    expect(ids(parseStages([{ id: "idea" }, { id: "x", label: "  Hook  " }, 5])!)).toEqual(["idea", "x", "scheduled", "published"]);
    expect(parseStages([{ id: "x", label: "  Hook  " }])![1]!.label).toBe("Hook");
  });

  it("renames, adds before Scheduled at most, and removes custom columns", () => {
    expect(stageLabel("filming", renameStage(DEFAULT_STAGES, "filming", "Record"))).toBe("Record");
    expect(renameStage(DEFAULT_STAGES, "filming", "   ")[3]!.label).toBe("Filming");

    const added = addStage(DEFAULT_STAGES, "filming");
    expect(ids(added.stages).indexOf(added.id!)).toBe(4);
    const late = addStage(DEFAULT_STAGES, "published");
    expect(ids(late.stages).slice(-3)).toEqual([late.id, "scheduled", "published"]);

    expect(removeStage(added.stages, added.id!)).toEqual({ stages: [...DEFAULT_STAGES], moveTo: "filming" });
    expect(removeStage(DEFAULT_STAGES, "scheduled").moveTo).toBeNull();
    expect(isCoreStage("idea")).toBe(true);
  });

  it("shows videos from removed columns under Idea, and orders by your columns", () => {
    const custom = normalizeStages([{ id: "idea" }, { id: "edit" }, { id: "hook" }]);
    expect(columnFor("filming", custom)).toBe("idea");
    expect(stageIndex("hook", custom)).toBe(2);
    const runs = activeRuns([{ id: "a", stage: "edit", due_date: null }, { id: "b", stage: "hook", due_date: null }], custom);
    expect(runs.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("leaves the stage alone when a workflow step points at a removed column", () => {
    const noFilming = DEFAULT_STAGES.filter((s) => s.id !== "filming");
    const planDone = ["topic", "outline", "assets"];
    expect(stageForWorkflow("researching", planDone, WORKFLOW, DEFAULT_STAGES)).toBe("filming");
    expect(stageForWorkflow("researching", planDone, WORKFLOW, noFilming)).toBeNull();
  });
});
