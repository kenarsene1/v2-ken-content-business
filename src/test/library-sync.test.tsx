import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { id: string; account_id: string | null; project_id: string | null; title: string; updated_at: string; pinned: boolean };
const db = vi.hoisted(() => ({
  items: [] as Record<string, unknown>[],
  insertGate: null as Promise<void> | null,
  deleteGate: null as Promise<void> | null,
  deletes: 0,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const list = { order: () => list, range: async () => ({ data: table === "library_items" ? [...db.items] : [], error: null }) };
      return {
        select: () => list,
        insert: (row: Record<string, unknown>) => ({
          select: () => ({ single: async () => { await db.insertGate; db.items.push(row); return { data: row, error: null }; } }),
        }),
        delete: () => ({
          eq: async (_col: string, id: string) => { db.deletes++; await db.deleteGate; db.items = db.items.filter((i) => i["id"] !== id); return { error: null }; },
        }),
      };
    },
    auth: { getSession: async () => ({ data: { session: { user: { id: "u1" } } } }) },
    storage: { from: () => ({ remove: async () => ({ error: null }) }) },
  },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import { useCreateLibraryItem, useLibraryItems, useRemoveLibraryItem, useScopedLibraryItems, type LibraryItem } from "@/lib/queries";
import { useUI } from "@/lib/store";

const row = (id: string, account_id: string | null = null): Row => ({ id, account_id, project_id: null, title: id, updated_at: "2026-01-01T00:00:00Z", pinned: false });

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const ids = (list: { data?: Pick<LibraryItem, "id">[] | undefined }) => (list.data ?? []).map((i) => i.id);
const refetch = () => act(async () => { await qc.refetchQueries({ queryKey: ["library_items"] }); });

describe("Library stays in step with the database", () => {
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    db.items = [row("old")];
    db.insertGate = null;
    db.deleteGate = null;
    db.deletes = 0;
    useUI.setState({ accountId: null });
  });

  it("shows a new note at once and keeps it when a refetch lands before the database has it", async () => {
    const { result } = renderHook(() => ({ list: useLibraryItems(), create: useCreateLibraryItem() }), { wrapper });
    await waitFor(() => expect(ids(result.current.list)).toEqual(["old"]));

    let release!: () => void;
    db.insertGate = new Promise<void>((resolve) => { release = resolve; });
    act(() => { result.current.create.mutate({ id: "new", title: "New note", account_id: null }); });

    await waitFor(() => expect(ids(result.current.list)).toContain("new"));
    await refetch();
    expect(ids(result.current.list)).toEqual(["new", "old"]);

    release();
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    await waitFor(() => expect(db.items.map((i) => i["id"])).toContain("new"));
    expect(ids(result.current.list).filter((id) => id === "new")).toHaveLength(1);
  });

  it("hides a removed item at once and does not bring it back when a refetch lands before the delete finishes", async () => {
    const { result } = renderHook(() => ({ list: useLibraryItems(), remove: useRemoveLibraryItem() }), { wrapper });
    await waitFor(() => expect(ids(result.current.list)).toEqual(["old"]));
    const item = result.current.list.data?.[0] as LibraryItem;

    let release!: () => void;
    db.deleteGate = new Promise<void>((resolve) => { release = resolve; });
    act(() => { result.current.remove(item); });

    await waitFor(() => expect(ids(result.current.list)).toEqual([]));
    await waitFor(() => expect(db.deletes).toBe(1)); // sent right away, not after the undo window
    await refetch(); // the database still has the row here
    expect(ids(result.current.list)).toEqual([]);

    release();
    await waitFor(() => expect(db.items).toHaveLength(0));
    await refetch();
    expect(ids(result.current.list)).toEqual([]);
  });

  it("shows only the selected profile's items, and everything under All accounts", async () => {
    db.items = [row("a1", "a"), row("b1", "b"), row("none", null)];
    const { result } = renderHook(() => useScopedLibraryItems(), { wrapper });
    await waitFor(() => expect(ids(result.current)).toHaveLength(3));
    act(() => useUI.setState({ accountId: "a" }));
    expect(ids(result.current)).toEqual(["a1"]);
    act(() => useUI.setState({ accountId: "b" }));
    expect(ids(result.current)).toEqual(["b1"]);
  });
});
