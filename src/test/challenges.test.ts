import { describe, expect, it } from "vitest";
import {
  autoTitle, challengeHistory, challengeProgress, periodKey, timeLeftLabel, type Challenge, type ChallengeVideo,
} from "@/lib/challenges";
import { activeRuns } from "@/lib/runs";
import { formatMinutes, parseDuration } from "@/lib/time";

// Tuesday 27 Oct 2026, local time. Weeks start on Monday.
const now = new Date("2026-10-27T12:00:00");

const challenge = (patch: Partial<Challenge>): Challenge => ({
  id: "c", user_id: "u", account_id: null, title: "Challenge", kind: "publish", period: "week", target: 4, format: null,
  progress: 0, progress_period: null, archived_at: null, created_at: "2026-10-01T09:00:00", updated_at: "2026-10-01T09:00:00",
  ...patch,
});
const video = (publishAt: string | null, patch: Partial<ChallengeVideo> = {}): ChallengeVideo => ({
  stage: "published", publish_at: publishAt, account_id: "a", format: "long_video", minutes_logged: 0, ...patch,
});

describe("publish challenges", () => {
  it("counts only videos published this week", () => {
    const videos = [video("2026-10-26T10:00:00"), video("2026-10-25T10:00:00"), video("2026-10-27T09:00:00", { stage: "editing" })];
    const p = challengeProgress(challenge({}), videos, now);
    expect(p).toMatchObject({ current: 1, goal: 4, done: false });
    expect(p.summary).toBe("1 of 4 videos published this week");
  });
  it("respects the profile and format filters", () => {
    const videos = [video("2026-10-26T10:00:00", { format: "short" }), video("2026-10-26T11:00:00", { format: "short", account_id: "b" })];
    expect(challengeProgress(challenge({ format: "short", account_id: "a", target: 1 }), videos, now).done).toBe(true);
    expect(challengeProgress(challenge({ format: "reel", target: 1 }), videos, now).done).toBe(false);
  });
  it("ignores scheduled publish times in the future", () => {
    expect(challengeProgress(challenge({ target: 1 }), [video("2026-10-29T10:00:00")], now).current).toBe(0);
  });
});

describe("time limit challenges", () => {
  const c = challenge({ kind: "time_limit", period: "month", target: 5 });
  it("counts videos logged within the limit and flags unlogged ones", () => {
    const videos = [video("2026-10-05T10:00:00", { minutes_logged: 250 }), video("2026-10-12T10:00:00", { minutes_logged: 301 }), video("2026-10-20T10:00:00")];
    const p = challengeProgress(c, videos, now);
    expect(p).toMatchObject({ current: 1, goal: 3, done: false });
    expect(p.summary).toBe("1 of 3 videos hit the target · 1 without time logged");
  });
  it("is done only when every published video is under the limit", () => {
    expect(challengeProgress(c, [video("2026-10-05T10:00:00", { minutes_logged: 300 })], now).done).toBe(true);
    expect(challengeProgress(c, [], now).done).toBe(false);
  });
});

describe("manual challenges", () => {
  it("only counts progress saved in the current period", () => {
    const thisWeek = challenge({ kind: "manual", target: 5, progress: 3, progress_period: periodKey("week", now) });
    expect(challengeProgress(thisWeek, [], now)).toMatchObject({ current: 3, done: false, summary: "3 of 5 done" });
    expect(challengeProgress({ ...thisWeek, progress_period: "2026-10-19" }, [], now).current).toBe(0);
  });
});

describe("history", () => {
  it("builds streaks from past weeks without breaking on an unfinished current week", () => {
    const c = challenge({ target: 1, created_at: "2026-10-05T09:00:00" });
    // Weeks of Oct 5 (miss), Oct 12 (win), Oct 19 (win), Oct 26 (current, not yet).
    const videos = [video("2026-10-14T10:00:00"), video("2026-10-21T10:00:00")];
    expect(challengeHistory(c, videos, now)).toEqual({ streak: 2, best: 2, wins: 2 });
  });
  it("has no history for manual challenges", () => {
    expect(challengeHistory(challenge({ kind: "manual" }), [], now)).toEqual({ streak: 0, best: 0, wins: 0 });
  });
});

describe("labels", () => {
  it("titles challenges from their settings", () => {
    expect(autoTitle(challenge({ target: 1 }))).toBe("Publish 1 video");
    expect(autoTitle(challenge({ target: 3, format: "short" }))).toBe("Publish 3 Shorts");
    expect(autoTitle(challenge({ kind: "time_limit", target: 5 }))).toBe("Every video under 5 hours");
    expect(autoTitle(challenge({ kind: "manual", title: "Mine" }))).toBe("Mine");
  });
  it("counts the days left in the period", () => {
    expect(timeLeftLabel("week", now)).toBe("5 days left");
    expect(timeLeftLabel("week", new Date("2026-11-01T20:00:00"))).toBe("Last day");
    expect(timeLeftLabel("month", now)).toBe("4 days left");
  });
});

describe("active runs", () => {
  it("lists in-progress videos by deadline, then by stage", () => {
    const rows = activeRuns([
      { id: "idea", stage: "idea", due_date: "2026-10-28" },
      { id: "done", stage: "published", due_date: "2026-10-20" },
      { id: "late", stage: "researching", due_date: "2026-11-03" },
      { id: "soon", stage: "scripting", due_date: "2026-10-30" },
      { id: "undated", stage: "editing", due_date: null },
      { id: "soon-further", stage: "filming", due_date: "2026-10-30" },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["soon-further", "soon", "late", "undated"]);
  });
});

describe("time logging", () => {
  it("formats and reads durations", () => {
    expect(formatMinutes(250)).toBe("4h 10m");
    expect(formatMinutes(45)).toBe("0h 45m");
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("1.5h")).toBe(90);
    expect(parseDuration("2h 15m")).toBe(135);
    expect(parseDuration("45 min")).toBe(45);
    expect(parseDuration("")).toBe(0);
    expect(parseDuration("soon")).toBeNull();
  });
});
