import { describe, expect, it } from "vitest";
import { dueLabel, goalPace, goalProgress, goalVideos, parseSteps, sortGoals, videoLength, type Goal } from "@/lib/goals";

const now = new Date("2026-10-27T12:00:00");

const goal = (patch: Partial<Goal>): Goal => ({
  id: "g", user_id: "u", account_id: null, kind: "goal", title: "Goal", notes: "", status: "active", measure: "number", display: "ring",
  start_value: 0, current_value: 0, target_value: 100, unit: "", video_format: "any", steps: [], start_date: null, due_date: null,
  created_at: "2026-10-01T09:00:00", updated_at: "2026-10-01T09:00:00", ...patch,
});

describe("goal progress", () => {
  it("measures numbers from the starting value, including goals that go down", () => {
    expect(goalProgress(goal({ start_value: 1000, current_value: 5500, target_value: 10000, unit: "subscribers" }))).toEqual({
      fraction: 0.5, label: "5,500 / 10K subscribers",
    });
    expect(goalProgress(goal({ start_value: 10, current_value: 7.5, target_value: 5, unit: "h" })).fraction).toBe(0.5);
    expect(goalProgress(goal({ current_value: 150 })).fraction).toBe(1);
  });
  it("reads percentages and steps", () => {
    const pct = goalProgress(goal({ measure: "percent", current_value: 64.6 }));
    expect(pct.label).toBe("65%");
    expect(pct.fraction).toBeCloseTo(0.646);
    const steps = [{ id: "a", label: "Script", done: true }, { id: "b", label: "Film", done: false }];
    expect(goalProgress(goal({ measure: "steps", steps }))).toEqual({ fraction: 0.5, label: "1 of 2 steps" });
    expect(goalProgress(goal({ measure: "steps" })).fraction).toBeNull();
  });
  it("uses the channel's live followers with the platform's word", () => {
    const g = goal({ measure: "followers", start_value: 0, target_value: 20000 });
    expect(goalProgress(g, { followers: 15000, platform: "youtube" })).toEqual({ fraction: 0.75, label: "15K / 20K subscribers" });
    expect(goalProgress(g, null).fraction).toBeNull();
  });
  it("leaves untracked plans without a progress bar", () => {
    expect(goalProgress(goal({ measure: "none" })).fraction).toBeNull();
  });
});

describe("pace and dates", () => {
  const window = { start_date: "2026-10-01", due_date: "2026-11-30" }; // ~43% of the time used
  it("compares progress with time passed", () => {
    expect(goalPace(goal({ ...window, current_value: 50 }), 0.5, now)).toBe("on_track");
    expect(goalPace(goal({ ...window, current_value: 10 }), 0.1, now)).toBe("behind");
    expect(goalPace(goal({ due_date: "2026-10-20" }), 0.1, now)).toBe("overdue");
  });
  it("has no pace when finished, paused, untracked or undated", () => {
    expect(goalPace(goal(window), 1, now)).toBeNull();
    expect(goalPace(goal({ ...window, status: "paused" }), 0.1, now)).toBeNull();
    expect(goalPace(goal(window), null, now)).toBeNull();
    expect(goalPace(goal({}), 0.1, now)).toBeNull();
  });
  it("labels due dates", () => {
    expect(dueLabel(null, now)).toBeNull();
    expect(dueLabel("2026-10-27", now)).toBe("Due today");
    expect(dueLabel("2026-11-08", now)).toBe("12d left");
    expect(dueLabel("2026-12-31", now)).toBe("Dec 31");
    expect(dueLabel("2027-03-01", now)).toBe("Mar 1, 2027");
    expect(dueLabel("2026-10-02", now)).toBe("Overdue · Oct 2");
  });
});

describe("helpers", () => {
  it("ignores malformed steps", () => {
    expect(parseSteps([{ id: "a", label: "Ok", done: true }, { id: 1, label: "bad" }, "nope", null])).toEqual([{ id: "a", label: "Ok", done: true }]);
    expect(parseSteps({})).toEqual([]);
  });
  it("sorts active first, then by due date", () => {
    const rows = sortGoals([
      goal({ id: "done", status: "done", due_date: "2026-10-01" }),
      goal({ id: "later", due_date: "2026-12-01" }),
      goal({ id: "paused", status: "paused" }),
      goal({ id: "sooner", due_date: "2026-11-01" }),
      goal({ id: "undated" }),
    ]);
    expect(rows.map((g) => g.id)).toEqual(["sooner", "later", "undated", "paused", "done"]);
  });
});

describe("video goals", () => {
  const v = (id: string, format: string, publish_at: string | null, extra: Partial<{ stage: string; account_id: string | null }> = {}) =>
    ({ id, title: id, format, publish_at, stage: "published", account_id: "ch1", ...extra });
  const items = [
    v("long1", "long_video", "2026-10-05T10:00:00"),
    v("short1", "short", "2026-10-06T10:00:00"),
    v("reel1", "reel", "2026-10-20T10:00:00"),
    v("tiktok-other-channel", "tiktok", "2026-10-07T10:00:00", { account_id: "ch2" }),
    v("before-start", "long_video", "2026-09-20T10:00:00"),
    v("still-editing", "long_video", "2026-10-08T10:00:00", { stage: "editing" }),
    v("carousel", "carousel", "2026-10-09T10:00:00"),
    v("scheduled-later", "short", "2026-11-30T10:00:00"),
  ];

  it("tells long-form from short-form", () => {
    expect(videoLength("long_video")).toBe("long");
    expect(["short", "reel", "tiktok"].map(videoLength)).toEqual(["short", "short", "short"]);
    expect(videoLength("carousel")).toBeNull();
  });

  it("counts published videos on the goal's channel from the day it was made, newest first", () => {
    const g = goal({ measure: "videos", target_value: 10, account_id: "ch1" });
    expect(goalVideos(g, items, now).map((x) => x.id)).toEqual(["reel1", "short1", "long1"]);
  });

  it("filters by long- or short-form and respects start and due dates", () => {
    expect(goalVideos(goal({ measure: "videos", account_id: "ch1", video_format: "long" }), items, now).map((x) => x.id)).toEqual(["long1"]);
    expect(goalVideos(goal({ measure: "videos", account_id: "ch1", video_format: "short", due_date: "2026-10-10" }), items, now).map((x) => x.id)).toEqual(["short1"]);
    expect(goalVideos(goal({ measure: "videos", start_date: "2026-09-01" }), items, now)).toHaveLength(5);
  });

  it("shows progress against the target", () => {
    const g = goal({ measure: "videos", target_value: 10, account_id: "ch1", video_format: "short" });
    expect(goalProgress(g, null, items)).toEqual({ fraction: 0.2, label: "2 / 10 shorts" });
    expect(goalProgress(goal({ measure: "videos", target_value: 2, account_id: "ch1" }), null, items)).toEqual({ fraction: 1, label: "3 / 2 videos" });
    expect(goalProgress(goal({ measure: "videos", target_value: 5 }), null, [])).toEqual({ fraction: 0, label: "0 / 5 videos" });
  });
});
