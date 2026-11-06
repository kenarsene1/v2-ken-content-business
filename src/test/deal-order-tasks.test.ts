import { describe, expect, it } from "vitest";
import { byManualOrder, moveBefore, moveToTop, orderPatches } from "@/lib/deal-order";
import { dueState, fromLocalInput, sortTasks, toLocalInput } from "@/lib/deal-tasks";

describe("deal order", () => {
  it("moves a card up to just before the target", () => expect(moveBefore(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]));
  it("moves a card down to just after the target", () => expect(moveBefore(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]));
  it("ignores unknown ids and self-drops", () => {
    expect(moveBefore(["a", "b"], "a", "a")).toEqual(["a", "b"]);
    expect(moveBefore(["a", "b"], "x", "a")).toEqual(["a", "b"]);
  });
  it("moves to top and keeps the rest in order", () => expect(moveToTop(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]));
  it("sorts by manual order, then newest", () => {
    const rows = [
      { id: "old", sort_order: 0, created_at: "2026-01-01" },
      { id: "new", sort_order: 0, created_at: "2026-02-01" },
      { id: "first", sort_order: -1, created_at: "2025-01-01" },
    ];
    expect(rows.sort(byManualOrder).map((r) => r.id)).toEqual(["first", "new", "old"]);
  });
  it("writes rows that moved even when they all started at the same order", () => {
    const before = new Map([["a", 0], ["b", 0], ["c", 0]]);
    expect(orderPatches(before, ["c", "a", "b"])).toEqual([{ id: "a", sort_order: 1 }, { id: "b", sort_order: 2 }]);
  });
  it("writes nothing when the saved order already matches", () => {
    expect(orderPatches(new Map([["a", 0], ["b", 1]]), ["a", "b"])).toEqual([]);
  });
  it("writes a deal the database has never ordered", () => {
    expect(orderPatches(new Map(), ["a"])).toEqual([{ id: "a", sort_order: 0 }]);
  });
});

describe("deal tasks", () => {
  const now = new Date("2026-11-03T12:00:00");
  const t = (due_at: string | null, done_at: string | null = null) => ({ due_at, done_at, sort_order: 0, created_at: "2026-11-01" });
  it("classifies urgency", () => {
    expect(dueState(t("2026-11-03T09:00:00"), now)).toBe("overdue");
    expect(dueState(t("2026-11-03T18:00:00"), now)).toBe("today");
    expect(dueState(t("2026-11-05T09:00:00"), now)).toBe("soon");
    expect(dueState(t("2026-12-01T09:00:00"), now)).toBe("later");
    expect(dueState(t(null), now)).toBe("none");
    expect(dueState(t("2026-11-01T09:00:00", "2026-11-02T00:00:00"), now)).toBe("none");
  });
  it("sorts open timed tasks first, done last", () => {
    const sorted = sortTasks([t(null, "x"), t(null), t("2026-11-09T00:00:00"), t("2026-11-04T00:00:00")]);
    expect(sorted.map((s) => s.due_at ?? (s.done_at ? "done" : "untimed"))).toEqual(["2026-11-04T00:00:00", "2026-11-09T00:00:00", "untimed", "done"]);
  });
  it("round-trips local datetime values", () => {
    const iso = fromLocalInput("2026-11-03T09:30");
    expect(toLocalInput(iso)).toBe("2026-11-03T09:30");
    expect(fromLocalInput("")).toBeNull();
    expect(toLocalInput(null)).toBe("");
  });
});
