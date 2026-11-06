import { describe, expect, it } from "vitest";
import { bySource, change, dealsAsIncome, monthlySeries, shiftMonth, totals } from "@/lib/revenue";

const e = (kind: string, source: string, amount: number, entry_date: string) => ({ id: Math.random() + "", kind, source, title: "", amount, entry_date, account_id: null });

describe("revenue analytics", () => {
  const xs = [e("income", "adsense", 100, "2026-10-02"), e("expense", "software", 30, "2026-10-05"), e("income", "affiliate", 50, "2026-09-01")];
  it("totals profit and margin", () => {
    expect(totals(xs)).toMatchObject({ income: 150, expenses: 30, profit: 120, margin: 80 });
  });
  it("builds zero-filled monthly series", () => {
    expect(monthlySeries(xs, "2026-10", 3)).toEqual([
      { month: "2026-08", income: 0, expenses: 0, profit: 0 },
      { month: "2026-09", income: 50, expenses: 0, profit: 50 },
      { month: "2026-10", income: 100, expenses: 30, profit: 70 },
    ]);
  });
  it("groups by source and maps paid deals", () => {
    expect(bySource(xs, "income").map((s) => s.id)).toEqual(["adsense", "affiliate"]);
    const d = dealsAsIncome([{ id: "1", status: "paid", value: 500, brand: "Acme", deadline: null, updated_at: "2026-10-09T00:00:00Z", account_id: null }, { id: "2", status: "lead", value: 9, brand: "X", deadline: null, updated_at: "2026-10-09", account_id: null }]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ entry_date: "2026-10-09", source: "brand_deals", fromDeal: true });
  });
  it("month helpers", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(change(150, 100)).toBe(50);
    expect(change(5, 0)).toBeNull();
  });
  it('counts mirrored brand-deal income exactly once', () => {
    const manual = e('income', 'brand_deals', 250, '2026-10-27');
    const mirrored = { id: 'deal', status: 'paid', value: 250, brand: 'Sponsor', deadline: null, updated_at: '2026-10-27', account_id: null, revenue_entry_id: manual.id };
    expect(dealsAsIncome([mirrored])).toEqual([]);
    expect(totals([manual, ...dealsAsIncome([mirrored])]).income).toBe(250);
  });
  it('uses a recorded payment date rather than a campaign deadline', () => {
    expect(dealsAsIncome([{ id: 'd', status: 'paid', value: 75, brand: 'Sponsor', deadline: '2026-09-01', paid_on: '2026-10-27', updated_at: '2026-11-01', account_id: 'a' }])[0]).toMatchObject({ entry_date: '2026-10-27', amount: 75, account_id: 'a' });
  });
});
