import {
  addMonths, addWeeks, differenceInCalendarDays, endOfMonth, endOfWeek, format, isValid, parseISO, startOfMonth, startOfWeek,
} from "date-fns";
import type { Database } from "@/integrations/supabase/types";

export type Challenge = Database["public"]["Tables"]["challenges"]["Row"];
export type ChallengeKind = "publish" | "time_limit" | "manual";
export type ChallengeTemplate = { kind: ChallengeKind; period: "week" | "month"; target: number; format: string | null; title?: string };

export const CHALLENGE_KINDS = [
  { id: "publish", label: "Publish videos", hint: "Counts videos you move to Published." },
  { id: "time_limit", label: "Every video under a time limit", hint: "Uses the time logged on each published video." },
  { id: "manual", label: "Track it myself", hint: "Tap +1 whenever you make progress." },
] as const;

export const CHALLENGE_PERIODS = [
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
] as const;

/** Ready-made challenges for one-tap adding. */
export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  { kind: "publish", period: "week", target: 4, format: null },
  { kind: "publish", period: "week", target: 3, format: "short" },
  { kind: "time_limit", period: "month", target: 5, format: null },
  { kind: "manual", period: "week", target: 5, format: null, title: "Reply to comments 5 days" },
];

/** A blank challenge, used by the New button. */
export const DEFAULT_CHALLENGE: ChallengeTemplate = { kind: "publish", period: "week", target: 4, format: null };

/** A new challenge row from a template, for the profile picked in the sidebar. */
export function challengeFromTemplate(t: ChallengeTemplate, accountId: string | null): Database["public"]["Tables"]["challenges"]["Insert"] {
  const title = t.title ?? autoTitle({ ...t, title: "New challenge" });
  return { kind: t.kind, period: t.period, target: t.target, format: t.format, title, account_id: accountId };
}

/** The content fields a challenge reads. */
export type ChallengeVideo = {
  stage: string;
  publish_at: string | null;
  account_id: string | null;
  format: string;
  minutes_logged?: number | null;
};

export type ChallengeProgress = { current: number; goal: number; done: boolean; summary: string };
export type ChallengeHistory = { streak: number; best: number; wins: number };

const WEEK = { weekStartsOn: 1 } as const;

const FORMAT_NOUNS: Record<string, [string, string]> = {
  long_video: ["long video", "long videos"],
  short: ["Short", "Shorts"],
  reel: ["Reel", "Reels"],
  tiktok: ["TikTok", "TikToks"],
  carousel: ["carousel", "carousels"],
};

function noun(formatId: string | null, count: number) {
  const [one, many] = (formatId && FORMAT_NOUNS[formatId]) || ["video", "videos"];
  return count === 1 ? one : many;
}

export function periodRange(period: string, date: Date) {
  return period === "month"
    ? { start: startOfMonth(date), end: endOfMonth(date) }
    : { start: startOfWeek(date, WEEK), end: endOfWeek(date, WEEK) };
}

/** Start date of the period, used to tie manual progress to one week or month. */
export function periodKey(period: string, date: Date) {
  return format(periodRange(period, date).start, "yyyy-MM-dd");
}

export function periodLabel(period: string) {
  return CHALLENGE_PERIODS.find((p) => p.id === period)?.label ?? "Weekly";
}

export function timeLeftLabel(period: string, now: Date) {
  const days = differenceInCalendarDays(periodRange(period, now).end, now);
  return days <= 0 ? "Last day" : `${days} day${days === 1 ? "" : "s"} left`;
}

/** The title a challenge gets from its settings. Custom titles are kept. */
export function autoTitle(c: Pick<Challenge, "kind" | "target" | "format" | "title">) {
  if (c.kind === "publish") return `Publish ${c.target} ${noun(c.format, c.target)}`;
  if (c.kind === "time_limit") return `Every video under ${c.target} hour${c.target === 1 ? "" : "s"}`;
  return c.title;
}

function publishedIn(c: Challenge, videos: ChallengeVideo[], start: Date, end: Date) {
  return videos.filter((v) => {
    if (v.stage !== "published" || !v.publish_at) return false;
    if (c.account_id && v.account_id !== c.account_id) return false;
    if (c.kind === "publish" && c.format && v.format !== c.format) return false;
    const date = parseISO(v.publish_at);
    return isValid(date) && date >= start && date <= end;
  });
}

/** Where a challenge stands in the period that contains `now`. */
export function challengeProgress(c: Challenge, videos: ChallengeVideo[], now = new Date()): ChallengeProgress {
  const { start } = periodRange(c.period, now);
  const span = c.period === "month" ? "this month" : "this week";

  if (c.kind === "manual") {
    const current = c.progress_period === periodKey(c.period, now) ? c.progress : 0;
    return { current, goal: c.target, done: current >= c.target, summary: `${Math.min(current, c.target)} of ${c.target} done` };
  }

  const published = publishedIn(c, videos, start, now);

  if (c.kind === "time_limit") {
    const limit = c.target * 60;
    const hits = published.filter((v) => (v.minutes_logged ?? 0) > 0 && (v.minutes_logged ?? 0) <= limit).length;
    const unlogged = published.filter((v) => !v.minutes_logged).length;
    const summary = published.length
      ? `${hits} of ${published.length} ${noun(null, published.length)} hit the target${unlogged ? ` · ${unlogged} without time logged` : ""}`
      : `No videos published ${span} yet`;
    return { current: hits, goal: published.length, done: published.length > 0 && hits === published.length, summary };
  }

  return {
    current: published.length,
    goal: c.target,
    done: published.length >= c.target,
    summary: `${Math.min(published.length, c.target)} of ${c.target} ${noun(c.format, c.target)} published ${span}`,
  };
}

/**
 * Streak, best streak and total wins, worked out from real published videos
 * since the challenge was created. An unfinished current period never breaks
 * the streak. Manual challenges only know their current period.
 */
export function challengeHistory(c: Challenge, videos: ChallengeVideo[], now = new Date()): ChallengeHistory {
  if (c.kind === "manual") return { streak: 0, best: 0, wins: 0 };
  const created = parseISO(c.created_at);
  const step = c.period === "month" ? addMonths : addWeeks;
  const results: boolean[] = [];
  for (let at = periodRange(c.period, isValid(created) ? created : now).start; at <= now && results.length < 520; at = step(at, 1)) {
    const { end } = periodRange(c.period, at);
    results.push(challengeProgress(c, videos, end < now ? end : now).done);
  }

  let best = 0;
  let run = 0;
  for (const done of results) {
    run = done ? run + 1 : 0;
    best = Math.max(best, run);
  }
  let streak = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i]) streak++;
    else if (i === results.length - 1) continue;
    else break;
  }
  return { streak, best, wins: results.filter(Boolean).length };
}

/** Open challenges first, then oldest first so the list stays stable. */
export function sortChallenges<T extends { challenge: Challenge; progress: ChallengeProgress }>(rows: T[]) {
  return [...rows].sort(
    (a, b) => Number(a.progress.done) - Number(b.progress.done) || a.challenge.created_at.localeCompare(b.challenge.created_at),
  );
}
