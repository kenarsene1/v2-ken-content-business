import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import type { Database, Json } from "@/integrations/supabase/types";
import { getPlatform } from "./platforms";

export type Goal = Database["public"]["Tables"]["goals"]["Row"];
type GoalInsert = Database["public"]["Tables"]["goals"]["Insert"];
export type GoalKind = "goal" | "plan" | "project";
export type GoalStep = { id: string; label: string; done: boolean };
export type GoalProgress = { fraction: number | null; label: string };
export type GoalPace = "on_track" | "behind" | "overdue";
type ContentRow = Database["public"]["Tables"]["content_items"]["Row"];
/** The content fields a video goal needs. */
export type GoalVideo = Pick<ContentRow, "id" | "title" | "stage" | "publish_at" | "format" | "account_id">;
export type VideoLength = "long" | "short";

export const GOAL_KINDS = [
  { id: "goal", label: "Goal", plural: "Goals" },
  { id: "plan", label: "Plan", plural: "Plans" },
  { id: "project", label: "Project", plural: "Projects" },
] as const;

export const GOAL_STATUSES = [
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
  { id: "done", label: "Done" },
] as const;

export const GOAL_MEASURES = [
  { id: "number", label: "A number", hint: "Track any number, like 10,000 subscribers or $5,000 a month." },
  { id: "percent", label: "Percentage", hint: "Set how far along it is yourself, from 0 to 100%." },
  { id: "steps", label: "Steps", hint: "Break it into steps and tick them off." },
  { id: "followers", label: "Channel followers", hint: "Reads the channel's follower count from Profiles automatically." },
  { id: "videos", label: "Videos published", hint: "Counts each video you mark Published between the start and due dates, on the goal's channel (or all channels)." },
  { id: "none", label: "No tracking", hint: "Just the written plan, no progress bar." },
] as const;

export const GOAL_DISPLAYS = [
  { id: "ring", label: "Circle" },
  { id: "bar", label: "Bar" },
  { id: "blocks", label: "Blocks" },
] as const;

export const VIDEO_FORMATS = [
  { id: "any", label: "Any video" },
  { id: "long", label: "Long-form only" },
  { id: "short", label: "Short-form only" },
] as const;

const SHORT_FORMATS = new Set(["short", "reel", "tiktok"]);

/** Long video → long-form; Short, Reel and TikTok → short-form; anything else (e.g. carousels) is not a video. */
export function videoLength(format: string): VideoLength | null {
  if (format === "long_video") return "long";
  return SHORT_FORMATS.has(format) ? "short" : null;
}

const localDay = (iso: string) => {
  const d = parseISO(iso);
  return isValid(d) ? format(d, "yyyy-MM-dd") : null;
};

/**
 * Published videos that count toward a video goal, newest first.
 * Window: start date (or the day the goal was made) through the due date, never in the future.
 */
export function goalVideos<T extends GoalVideo>(g: Goal, items: readonly T[], now = new Date()): T[] {
  const from = g.start_date ?? localDay(g.created_at) ?? "0000-01-01";
  const until = g.due_date ?? "9999-12-31";
  const want = g.video_format === "long" || g.video_format === "short" ? g.video_format : null;
  return items
    .filter((c) => {
      if (c.stage !== "published" || !c.publish_at) return false;
      if (g.account_id && c.account_id !== g.account_id) return false;
      const length = videoLength(c.format);
      if (!length || (want && length !== want)) return false;
      const at = parseISO(c.publish_at);
      if (!isValid(at) || at > now) return false;
      const day = format(at, "yyyy-MM-dd");
      return day >= from && day <= until;
    })
    .sort((a, b) => (b.publish_at ?? "").localeCompare(a.publish_at ?? ""));
}

const videoNoun = (g: Goal) => (g.video_format === "long" ? "long videos" : g.video_format === "short" ? "shorts" : "videos");

/** Sensible starting points for the New buttons. */
export const GOAL_DEFAULTS: Record<GoalKind, GoalInsert> = {
  goal: { kind: "goal", title: "New goal", measure: "number", display: "ring", target_value: 100 },
  plan: { kind: "plan", title: "New plan", measure: "none", display: "bar" },
  project: { kind: "project", title: "New project", measure: "steps", display: "bar" },
};

export const kindLabel = (kind: string) => GOAL_KINDS.find((k) => k.id === kind)?.label ?? "Goal";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function formatGoalNumber(n: number) {
  return Math.abs(n) >= 10_000 ? compact.format(n) : n.toLocaleString("en", { maximumFractionDigits: 2 });
}

/** Steps saved as JSON, ignoring anything malformed. */
export function parseSteps(value: Json): GoalStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return [];
    const { id, label, done } = v;
    return typeof id === "string" && typeof label === "string" ? [{ id, label, done: done === true }] : [];
  });
}

export function newStep(label: string): GoalStep {
  return { id: crypto.randomUUID(), label, done: false };
}

/**
 * How far along a goal is (0-1, or null when it isn't tracked) and a short label.
 * Number goals can go down too (e.g. edit time from 10h to 5h).
 */
export function goalProgress(g: Goal, channel?: { followers: number; platform: string } | null, videos?: readonly GoalVideo[]): GoalProgress {
  if (g.measure === "videos") {
    const count = goalVideos(g, videos ?? []).length;
    const target = Math.max(0, Math.round(g.target_value));
    return { fraction: target ? clamp(count / target, 0, 1) : Number(count > 0), label: `${count} / ${target} ${videoNoun(g)}` };
  }
  if (g.measure === "percent") {
    const pct = clamp(g.current_value, 0, 100);
    return { fraction: pct / 100, label: `${Math.round(pct)}%` };
  }
  if (g.measure === "steps") {
    const steps = parseSteps(g.steps);
    if (!steps.length) return { fraction: null, label: "No steps yet" };
    const done = steps.filter((s) => s.done).length;
    return { fraction: done / steps.length, label: `${done} of ${steps.length} steps` };
  }
  if (g.measure === "number" || g.measure === "followers") {
    const isFollowers = g.measure === "followers";
    if (isFollowers && !channel) return { fraction: null, label: "Pick a channel to track followers" };
    const current = isFollowers && channel ? channel.followers : g.current_value;
    const unit = g.unit || (isFollowers && channel ? getPlatform(channel.platform).audienceLabel : "");
    const span = g.target_value - g.start_value;
    const fraction = span === 0 ? Number(current === g.target_value) : clamp((current - g.start_value) / span, 0, 1);
    return { fraction, label: `${formatGoalNumber(current)} / ${formatGoalNumber(g.target_value)}${unit ? ` ${unit}` : ""}` };
  }
  return { fraction: null, label: g.status === "done" ? "Done" : "" };
}

/** Compares progress with time passed between the start and due dates. */
export function goalPace(g: Goal, fraction: number | null, now = new Date()): GoalPace | null {
  if (fraction === null || fraction >= 1 || g.status !== "active" || !g.due_date) return null;
  const due = parseISO(g.due_date);
  const start = parseISO(g.start_date ?? g.created_at);
  if (!isValid(due) || !isValid(start)) return null;
  if (differenceInCalendarDays(due, now) < 0) return "overdue";
  const total = differenceInCalendarDays(due, start);
  if (total <= 0) return null;
  const expected = clamp(differenceInCalendarDays(now, start) / total, 0, 1);
  return fraction + 0.05 >= expected ? "on_track" : "behind";
}

export const PACE_LABELS: Record<GoalPace, string> = { on_track: "On track", behind: "Behind", overdue: "Overdue" };

/** "Due today", "12d left", "Mar 3", "Overdue · Oct 2". */
export function dueLabel(dueDate: string | null, now = new Date()) {
  if (!dueDate) return null;
  const due = parseISO(dueDate);
  if (!isValid(due)) return null;
  const days = differenceInCalendarDays(due, now);
  if (days < 0) return `Overdue · ${format(due, "MMM d")}`;
  if (days === 0) return "Due today";
  if (days <= 30) return `${days}d left`;
  return format(due, due.getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy");
}

/** Active first, then paused, then done; soonest due date first inside each. */
export function sortGoals(goals: Goal[]) {
  const rank = (s: string) => GOAL_STATUSES.findIndex((x) => x.id === s);
  return [...goals].sort(
    (a, b) => rank(a.status) - rank(b.status) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.created_at.localeCompare(b.created_at),
  );
}
