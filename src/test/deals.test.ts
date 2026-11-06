import { describe, expect, it } from "vitest";
import { DEAL_PHASES, DEAL_STATUSES, dealLinkChanges, dealStats, linkableDeals, sponsorsByVideo, statusBreakdown } from "@/lib/deals";

const d = (status: string, value: number, deadline: string | null = "2026-10-05") => ({ status, value, deadline, group_id: null });

describe("deal analytics", () => {
  it("totals exclude lost deals and compute win rate", () => {
    const s = dealStats([d("paid", 100), d("active", 50), d("lost", 999), d("lead", 10)]);
    expect(s.totalValue).toBe(160);
    expect(s.paid).toBe(100);
    expect(s.outstanding).toBe(50);
    expect(s.pipeline).toBe(10);
    expect(s.winRate).toBe(50);
  });
  it("lists every stage in order with count, value and share", () => {
    const b = statusBreakdown([d("paid", 5), d("lead", 3), d("lead", 2), d("lost", 9)]);
    expect(b.map((x) => x.id)).toEqual(DEAL_STATUSES.map((x) => x.id));
    expect(b.find((x) => x.id === "lead")).toMatchObject({ count: 2, value: 5, share: 0.5 });
    expect(b.find((x) => x.id === "negotiating")).toMatchObject({ count: 0, value: 0, share: 0 });
    expect(DEAL_PHASES.flatMap((p) => p.stages)).toEqual(DEAL_STATUSES.map((x) => x.id));
  });
});

describe("linking deals to a video", () => {
  const deal = (id: string, account_id: string | null, content_item_id: string | null) => ({ id, account_id, content_item_id });
  const deals = [deal("a", "p1", "v1"), deal("b", "p1", null), deal("c", "p2", null), deal("d", null, "v2")];

  it("offers deals from the same profile, unassigned ones, and the current link", () => {
    expect(linkableDeals(deals, { id: "v1", account_id: "p1" }).map((d) => d.id)).toEqual(["a", "b", "d"]);
    expect(linkableDeals(deals, { id: "v9", account_id: null }).map((d) => d.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("moves the link to the chosen deal and unlinks the old one", () => {
    expect(dealLinkChanges(deals, "v1", "b")).toEqual([{ id: "a", content_item_id: null }, { id: "b", content_item_id: "v1" }]);
    expect(dealLinkChanges(deals, "v1", null)).toEqual([{ id: "a", content_item_id: null }]);
    expect(dealLinkChanges(deals, "v1", "a")).toEqual([]);
    expect(dealLinkChanges(deals, "v1", "d")).toEqual([{ id: "a", content_item_id: null }, { id: "d", content_item_id: "v1" }]);
  });
});

describe("sponsored videos", () => {
  const deal = (id: string, content_item_id: string | null, status = "active", brand = "Notion") => ({ id, account_id: null, content_item_id, status, brand });

  it("maps each linked video to its brand, ignoring lost and unlinked deals", () => {
    const map = sponsorsByVideo([deal("a", "v1"), deal("b", "v2", "lost"), deal("c", null), deal("d", "v1", "paid", "Figma"), deal("e", "v3", "lead", "  ")]);
    expect([...map]).toEqual([["v1", "Notion"], ["v3", "a brand"]]);
  });
});
