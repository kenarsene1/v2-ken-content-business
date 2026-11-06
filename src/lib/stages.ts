import { STAGES } from "./constants";

/**
 * Pipeline board columns. Users can rename any column and add or remove their own.
 * "idea", "scheduled" and "published" always exist: ideas land in "idea", and the calendar,
 * publishing dates and stats rely on "scheduled" and "published". They also keep their places
 * (idea first; scheduled then published last), so stage order still means "further along".
 */
export type Stage = { id: string; label: string };
export type StageList = readonly Stage[];

export const DEFAULT_STAGES: StageList = STAGES;
const CORE = ["idea", "scheduled", "published"] as const;
export const isCoreStage = (id: string) => (CORE as readonly string[]).includes(id);
export const STAGE_LIMITS = { label: 40, stages: 14 } as const;

const defaultLabel = (id: string) => STAGES.find((s) => s.id === id)?.label ?? id;
const clean = (label: unknown, fallback: string) =>
  (typeof label === "string" ? label.trim().slice(0, STAGE_LIMITS.label) : "") || fallback;

/** Puts core columns in their places and drops duplicates. Always returns a usable list. */
export function normalizeStages(list: readonly { id: string; label?: unknown }[]): Stage[] {
  const seen = new Set<string>();
  const byId = new Map<string, Stage>();
  for (const s of list) {
    if (!s.id || s.id.length > STAGE_LIMITS.label || seen.has(s.id)) continue;
    seen.add(s.id);
    byId.set(s.id, { id: s.id, label: clean(s.label, defaultLabel(s.id)) });
  }
  const core = (id: string) => byId.get(id) ?? { id, label: defaultLabel(id) };
  const middle = [...byId.values()].filter((s) => !isCoreStage(s.id)).slice(0, STAGE_LIMITS.stages - CORE.length);
  return [core("idea"), ...middle, core("scheduled"), core("published")];
}

/** Reads saved columns; null when nothing is saved (use the defaults). */
export function parseStages(value: unknown): Stage[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const rows = value.flatMap((v) =>
    v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string"
      ? [{ id: (v as { id: string }).id, label: (v as { label?: unknown }).label }]
      : [],
  );
  return rows.length ? normalizeStages(rows) : null;
}

export function renameStage(stages: StageList, id: string, label: string): Stage[] {
  return stages.map((s) => (s.id === id ? { ...s, label: clean(label, s.label) } : s));
}

/** Adds a column after `afterId` (never after Scheduled/Published). Returns the list and the new id (null if full). */
export function addStage(stages: StageList, afterId: string) {
  if (stages.length >= STAGE_LIMITS.stages) return { stages: [...stages], id: null };
  const id = `stage-${crypto.randomUUID().slice(0, 8)}`;
  const next = [...stages];
  const scheduled = next.findIndex((s) => s.id === "scheduled");
  const after = next.findIndex((s) => s.id === afterId);
  const at = after < 0 || after >= scheduled ? scheduled : after + 1;
  next.splice(at, 0, { id, label: "New stage" });
  return { stages: normalizeStages(next), id };
}

/**
 * Removes a column. Core columns can't be removed.
 * `moveTo` is where its videos should go: the column before it.
 */
export function removeStage(stages: StageList, id: string) {
  const at = stages.findIndex((s) => s.id === id);
  if (at <= 0 || isCoreStage(id)) return { stages: [...stages], moveTo: null };
  return { stages: stages.filter((s) => s.id !== id), moveTo: stages[at - 1]!.id };
}

export function stageLabel(stage: string, stages: StageList = DEFAULT_STAGES) {
  return stages.find((s) => s.id === stage)?.label ?? defaultLabel(stage);
}

/** Column a video shows in: its own stage, or Idea if that column was removed. */
export function columnFor(stage: string, stages: StageList) {
  return stages.some((s) => s.id === stage) ? stage : "idea";
}
