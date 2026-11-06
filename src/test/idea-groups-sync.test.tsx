import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  groups: [] as Record<string, unknown>[],
  ideas: [] as Record<string, unknown>[],
  insertGate: null as Promise<void> | null,
  deleteGate: null as Promise<void> | null,
  deletes: 0,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const rows = () => (table === "idea_groups" ? db.groups : table === "ideas" ? db.ideas : []);
      const list = { order: () => list, range: async () => ({ data: [...rows()], error: null }) };
      return {
        select: () => list,
        insert: (row: Record<string, unknown>) => ({
          select: () => ({ single: async () => { await db.insertGate; db.groups.push(row); return { data: row, error: null }; } }),
        }),
        delete: () => ({
          eq: async (_col: string, id: string) => {
            db.deletes++;
            await db.deleteGate;
            db.groups = db.groups.filter((g) => g["id"] !== id);
            db.ideas = db.ideas.map((i) => (i["group_id"] === id ? { ...i, group_id: null } : i));
            return { error: null };
          },
        }),
      };
    },
  },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import { useCreateIdeaGroup, useIdeaGroups, useIdeas, useRemoveIdeaGroup, useScopedIdeaGroups, type IdeaGroup } from "@/lib/queries";
import { useUI } from "@/lib/store";

const group = (id: string, account_id: string | null = null) => ({ id, user_id: "u", account_id, name: id, pinned: false, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" });
const idea = (id: string, group_id: string | null) => ({ id, user_id: "u", account_id: null, group_id, title: id, status: "new", tags: [], created_at: "2026-01-01T00:00:00Z" });

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const ids = (q: { data?: { id: string }[] | undefined }) => (q.data ?? []).map((r) => r.id);
const refetch = (key: string) => act(async () => { await qc.refetchQueries({ queryKey: [key] }); });

describe("Idea groups stay in step with the database", () => {
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    db.groups = [group("old")];
    db.ideas = [];
    db.insertGate = null;
    db.deleteGate = null;
    db.deletes = 0;
    useUI.setState({ accountId: null });
  });

  it("shows a new group at once and keeps it when a refetch lands before the database has it", async () => {
    const { result } = renderHook(() => ({ list: useIdeaGroups(), create: useCreateIdeaGroup() }), { wrapper });
    await waitFor(() => expect(ids(result.current.list)).toEqual(["old"]));

    let release!: () => void;
    db.insertGate = new Promise<void>((resolve) => { release = resolve; });
    act(() => { result.current.create.mutate({ id: "new", name: "No code", account_id: null }); });

    await waitFor(() => expect(ids(result.current.list)).toContain("new"));
    await refetch("idea_groups");
    expect(ids(result.current.list)).toContain("new");

    release();
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    await waitFor(() => expect(db.groups.map((g) => g["id"])).toContain("new"));
    expect(ids(result.current.list).filter((id) => id === "new")).toHaveLength(1);
  });

  it("removes a group at once, frees its ideas, and does not bring it back while the delete is running", async () => {
    db.groups = [group("g1")];
    db.ideas = [idea("a", "g1"), idea("b", null)];
    const { result } = renderHook(() => ({ groups: useIdeaGroups(), ideas: useIdeas(), remove: useRemoveIdeaGroup() }), { wrapper });
    await waitFor(() => expect(ids(result.current.groups)).toEqual(["g1"]));
    await waitFor(() => expect(ids(result.current.ideas)).toHaveLength(2));
    const target = result.current.groups.data?.[0] as IdeaGroup;

    let release!: () => void;
    db.deleteGate = new Promise<void>((resolve) => { release = resolve; });
    act(() => { result.current.remove(target); });

    await waitFor(() => expect(ids(result.current.groups)).toEqual([]));
    expect(result.current.ideas.data?.find((i) => i.id === "a")?.group_id).toBeNull();
    await waitFor(() => expect(db.deletes).toBe(1)); // sent right away
    await refetch("idea_groups"); // the database still has it here
    expect(ids(result.current.groups)).toEqual([]);

    release();
    await waitFor(() => expect(db.groups).toHaveLength(0));
    await refetch("idea_groups");
    expect(ids(result.current.groups)).toEqual([]);
  });

  it("shows only the selected profile's groups, and everything under All accounts", async () => {
    db.groups = [group("a1", "a"), group("b1", "b"), group("none", null)];
    const { result } = renderHook(() => useScopedIdeaGroups(), { wrapper });
    await waitFor(() => expect(ids(result.current)).toHaveLength(3));
    act(() => useUI.setState({ accountId: "a" }));
    expect(ids(result.current)).toEqual(["a1"]);
  });
});
