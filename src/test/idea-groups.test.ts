import { describe, expect, it } from "vitest";
import { arrangeIdeas, cleanGroupName, countByGroup, groupsForIdea, sortGroups } from "@/lib/idea-groups";

const g = (id: string, over: Partial<{ pinned: boolean; created_at: string; account_id: string | null }> = {}) => ({
  id, pinned: false, created_at: `2026-01-0${id.length}T00:00:00Z`, account_id: null as string | null, ...over,
});

describe("idea groups", () => {
  it("lists pinned groups first, then in the order they were made", () => {
    const list = [g("c", { created_at: "2026-03-01" }), g("a", { created_at: "2026-01-01" }), g("b", { created_at: "2026-02-01", pinned: true })];
    expect(sortGroups(list).map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("cleans names: one line, trimmed, capped at 80 characters", () => {
    expect(cleanGroupName("  AI \n agents  ")).toBe("AI agents");
    expect(cleanGroupName("   ")).toBe("");
    expect(cleanGroupName("x".repeat(200))).toHaveLength(80);
  });

  it("top level shows loose ideas and ideas whose group is not on screen; a group shows only its own", () => {
    const rows = [
      { id: "1", group_id: null },
      { id: "2", group_id: "g1" },
      { id: "3", group_id: "elsewhere" },
      { id: "4" },
    ];
    const groups = [{ id: "g1" }];
    expect(arrangeIdeas(rows, groups, null).map((r) => r.id)).toEqual(["1", "3", "4"]);
    expect(arrangeIdeas(rows, groups, "g1").map((r) => r.id)).toEqual(["2"]);
  });

  it("counts ideas per group without archived ones", () => {
    const counts = countByGroup([
      { group_id: "g1", status: "new" },
      { group_id: "g1", status: "archived" },
      { group_id: "g1", status: "shortlisted" },
      { group_id: null, status: "new" },
      { status: "new" },
    ]);
    expect(counts.get("g1")).toBe(2);
    expect(counts.size).toBe(1);
  });

  it("offers an idea only the groups of its own profile", () => {
    const groups = [g("a", { account_id: "p1" }), g("b", { account_id: "p2" }), g("c", { account_id: null })];
    expect(groupsForIdea(groups, { account_id: "p1" }).map((x) => x.id)).toEqual(["a"]);
    expect(groupsForIdea(groups, { account_id: null }).map((x) => x.id)).toEqual(["c"]);
  });
});
