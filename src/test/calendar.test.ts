import { describe, expect, it } from "vitest";
import { format, parseISO } from "date-fns";
import { calendarDays, contentEvents, localDateTime, moveEventPatch, publishedStreak } from "@/lib/calendar";
import type { ContentItem } from "@/lib/queries";

const item = (patch: Partial<ContentItem> = {}): ContentItem => ({ id: "one", title: "My next video", stage: "idea", account_id: "profile-one", publish_at: null, due_date: null, created_at: "2026-10-01", updated_at: "2026-10-01", user_id: "user", format: "long_video", notes: null, parent_id: null, platforms: ["youtube"], position: 0, priority: "medium", script_url: null, tags: [], thumbnail_concepts: null, title_options: [], minutes_logged: 0, creation_started_at: null, creation_finished_at: null, workflow_done: [], ref_url: null, resources: [], thumbnail_path: null, thumbnail_url: null, ...patch });

describe("Creator calendar", () => {
  it("reads both shared publishing and deadline dates, ignoring malformed dates", () => {
    const events = contentEvents([item({ publish_at: "2026-10-15T12:00:00Z", due_date: "2026-10-13" }), item({ id: "bad", due_date: "invalid" })]);
    expect(events.map((e) => e.kind)).toEqual(["due", "publish"]);
    expect(contentEvents([item({ due_date: "2026-10-13" })], "publish")).toEqual([]);
  });
  it("renders complete Monday-first weeks", () => {
    const days = calendarDays(parseISO("2026-10-13"), "month");
    expect(days[0]?.getDay()).toBe(1);
    expect(days.at(-1)?.getDay()).toBe(0);
    expect(days.length % 7).toBe(0);
    expect(calendarDays(parseISO("2026-10-13"), "week")).toHaveLength(7);
  });
  it("moves publishing days without changing local time or unrelated fields", () => {
    const source = item({ publish_at: new Date(2026, 9, 13, 16, 35).toISOString(), stage: "editing" });
    const patch = moveEventPatch(source, "publish", new Date(2026, 9, 21));
    expect(format(parseISO(patch.publish_at ?? ""), "yyyy-MM-dd HH:mm")).toBe("2026-10-21 16:35");
    expect(patch.stage).toBe("editing");
    expect(patch).not.toHaveProperty("account_id");
  });
  it("keeps deadlines date-only and schedules an idea", () => {
    expect(moveEventPatch(item(), "due", new Date(2026, 9, 21))).toEqual({ due_date: "2026-10-21" });
    expect(moveEventPatch(item(), "publish", new Date(2026, 9, 21)).stage).toBe("scheduled");
  });
  it("counts only consecutive actually published days", () => {
    const rows = [item({ publish_at: "2026-10-13T12:00:00", stage: "published" }), item({ id: "two", publish_at: "2026-10-12T12:00:00", stage: "published" }), item({ id: "three", publish_at: "2026-10-11T12:00:00", stage: "scheduled" })];
    expect(publishedStreak(rows, new Date(2026, 9, 13))).toBe(2);
    expect(publishedStreak(rows, new Date(2026, 9, 16))).toBe(0);
  });
  it("round-trips timestamps as local editor values", () => {
    const date = new Date(2026, 9, 13, 16, 30);
    expect(localDateTime(date.toISOString())).toBe("2026-10-13T16:30");
    expect(localDateTime(null)).toBe("");
  });
});