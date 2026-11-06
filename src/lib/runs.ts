import { DEFAULT_STAGES, type StageList } from "./stages";

/** 0-based position of a stage in the pipeline (unknown or removed stages count as the first). */
export function stageIndex(stage: string, stages: StageList = DEFAULT_STAGES) {
  return Math.max(0, stages.findIndex((s) => s.id === stage));
}

/**
 * Videos being worked on: past the idea stage and not yet published.
 * Soonest deadline first (undated last), then the furthest along.
 */
export function activeRuns<T extends { stage: string; due_date: string | null }>(items: T[], stages: StageList = DEFAULT_STAGES) {
  return items
    .filter((i) => i.stage !== "idea" && i.stage !== "published")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || stageIndex(b.stage, stages) - stageIndex(a.stage, stages));
}
