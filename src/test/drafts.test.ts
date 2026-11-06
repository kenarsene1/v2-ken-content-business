import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  deletes: [] as { table: string; id: string; updated_at: unknown }[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      const matching = () => (db.rows[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: matching(), error: null }),
        delete: () => {
          const d = {
            eq: (k: string, v: unknown) => { filters.push([k, v]); return d; },
            then: (resolve: (v: unknown) => void) => {
              const hit = matching();
              for (const r of hit) db.deletes.push({ table, id: String(r["id"]), updated_at: r["updated_at"] });
              db.rows[table] = (db.rows[table] ?? []).filter((r) => !hit.includes(r));
              resolve({ error: null, count: hit.length });
            },
          };
          return d;
        },
      };
      return q;
    },
  },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import { discardIfBlank } from "@/lib/queries";
import { clearDraft, draftTable, isBlankDraft, markDraft } from "@/lib/drafts";

const T = "2026-11-05T10:00:00.000Z";
const later = "2026-11-05T10:05:00.000Z";

describe("isBlankDraft", () => {
  it("revenue: zero amount with the default title is blank; a title or an amount keeps it", () => {
    expect(isBlankDraft("revenue_entries", { title: "New income", amount: 0, note: null })).toBe(true);
    expect(isBlankDraft("revenue_entries", { title: "New expense", amount: 0, note: "" })).toBe(true);
    expect(isBlankDraft("revenue_entries", { title: "Sponsor", amount: 0 })).toBe(false);
    expect(isBlankDraft("revenue_entries", { title: "New income", amount: 50 })).toBe(false);
  });

  it("deals, ideas and content: blank only while nothing was filled in", () => {
    expect(isBlankDraft("brand_deals", { title: "Untitled deal", brand: "New brand", value: 0 })).toBe(true);
    expect(isBlankDraft("brand_deals", { title: "Untitled deal", brand: "Notion", value: 0 })).toBe(false);
    expect(isBlankDraft("brand_deals", { title: "Untitled deal", brand: "", value: 500 })).toBe(false);
    expect(isBlankDraft("ideas", { title: "Untitled idea", note: null, tags: [] })).toBe(true);
    expect(isBlankDraft("ideas", { title: "Untitled idea", note: "hook", tags: [] })).toBe(false);
    expect(isBlankDraft("content_items", { title: "Untitled", notes: null, tags: [], title_options: [], workflow_done: [], resources: {}, minutes_logged: 0 })).toBe(true);
    expect(isBlankDraft("content_items", { title: "My video", notes: null, tags: [] })).toBe(false);
    expect(isBlankDraft("content_items", { title: "Untitled", script_url: "https://docs.google.com/x" })).toBe(false);
  });
});

describe("discardIfBlank", () => {
  let qc: QueryClient;
  beforeEach(() => {
    vi.useFakeTimers();
    qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    db.deletes = [];
    db.rows = {
      revenue_entries: [{ id: "r1", title: "New income", amount: 0, note: null, created_at: T, updated_at: T }],
      content_items: [{ id: "c1", title: "Untitled", notes: null, tags: [], created_at: T, updated_at: T }],
      content_checklist_items: [{ id: "k1", content_item_id: "c1", done: false, created_at: T, updated_at: T }],
    };
    qc.setQueryData(["revenue"], [{ id: "r1" }, { id: "keep" }]);
  });
  const run = async (id: string, openAgain = false) => {
    const done = discardIfBlank(qc, id, () => openAgain);
    await vi.runAllTimersAsync();
    return done;
  };

  it("removes an untouched new entry from the database and the screen", async () => {
    markDraft("revenue_entries", "r1");
    expect(await run("r1")).toBe(true);
    expect(db.deletes).toEqual([{ table: "revenue_entries", id: "r1", updated_at: T }]);
    expect(qc.getQueryData(["revenue"])).toEqual([{ id: "keep" }]);
    expect(draftTable("r1")).toBeUndefined();
  });

  it("keeps it once something was saved", async () => {
    markDraft("revenue_entries", "r1");
    db.rows["revenue_entries"]![0]!["amount"] = 120;
    expect(await run("r1")).toBe(false);
    expect(db.deletes).toEqual([]);
  });

  it("never touches rows that were not made by New", async () => {
    clearDraft("r1");
    expect(await run("r1")).toBe(false);
    expect(db.deletes).toEqual([]);
  });

  it("waits while the drawer is open again", async () => {
    markDraft("revenue_entries", "r1");
    expect(await run("r1", true)).toBe(false);
    expect(draftTable("r1")).toBe("revenue_entries");
    clearDraft("r1");
  });

  it("keeps new content when a checklist step was ticked", async () => {
    markDraft("content_items", "c1");
    db.rows["content_checklist_items"]![0]!["done"] = true;
    db.rows["content_checklist_items"]![0]!["updated_at"] = later;
    expect(await run("c1")).toBe(false);
    expect(db.deletes).toEqual([]);
  });

  it("removes new content whose checklist is untouched", async () => {
    markDraft("content_items", "c1");
    expect(await run("c1")).toBe(true);
    expect(db.deletes.map((d) => d.id)).toEqual(["c1"]);
  });
});
