/** Revenue & expenses: sources and pure analytics. Safe to unit test. */
export const INCOME_SOURCES = [
  { id: "brand_deals", label: "Brand deals", color: "var(--primary)" },
  { id: "adsense", label: "Ad revenue", color: "var(--chart-1)" },
  { id: "affiliate", label: "Affiliates", color: "var(--chart-2)" },
  { id: "products", label: "Products", color: "var(--chart-3)" },
  { id: "memberships", label: "Memberships", color: "var(--chart-4)" },
  { id: "other", label: "Other income", color: "var(--chart-5)" },
] as const;

export const EXPENSE_SOURCES = [
  { id: "equipment", label: "Equipment", color: "var(--chart-1)" },
  { id: "software", label: "Software", color: "var(--chart-2)" },
  { id: "freelancer", label: "Editors & designers", color: "var(--chart-3)" },
  { id: "ads", label: "Ads & promotion", color: "var(--chart-4)" },
  { id: "travel", label: "Travel", color: "var(--chart-5)" },
  { id: "other", label: "Other expense", color: "var(--muted-foreground)" },
] as const;

export type Kind = "income" | "expense";
export const sourcesFor = (kind: string) => (kind === "expense" ? EXPENSE_SOURCES : INCOME_SOURCES);
export const sourceMeta = (kind: string, id: string) =>
  sourcesFor(kind).find((s) => s.id === id) ?? (kind === 'expense' ? EXPENSE_SOURCES[5] : INCOME_SOURCES[5]);

export interface MoneyEntry {
  id: string;
  kind: string;
  source: string;
  title: string;
  amount: number;
  entry_date: string; // yyyy-mm-dd
  account_id: string | null;
  currency?: string;
  /** True for rows derived from paid brand deals (edit them on the deals page). */
  fromDeal?: boolean;
}

/** Paid brand deals count as income automatically, dated by deadline (or last update). */
export function dealsAsIncome(deals: { id: string; status: string; value: number; brand: string; deadline: string | null; updated_at: string; account_id: string | null; currency?: string; revenue_entry_id?: string | null; paid_on?: string | null }[]): MoneyEntry[] {
  return deals
    .filter((d) => d.status === "paid" && !d.revenue_entry_id)
    .map((d) => ({
      id: `deal-${d.id}`,
      kind: "income",
      source: "brand_deals",
      title: d.brand,
      amount: Number(d.value || 0),
      entry_date: d.paid_on ?? d.deadline ?? d.updated_at.slice(0, 10),
      account_id: d.account_id,
      currency: d.currency ?? 'USD',
      fromDeal: true,
    }));
}

export function totals(entries: MoneyEntry[]) {
  let income = 0, expenses = 0;
  for (const e of entries) e.kind === "expense" ? (expenses += Number(e.amount)) : (income += Number(e.amount));
  const profit = income - expenses;
  return { income, expenses, profit, margin: income ? Math.round((profit / income) * 100) : null, count: entries.length };
}

export const inMonth = (entries: MoneyEntry[], month: string) => entries.filter((e) => e.entry_date.startsWith(month));

/** One row per month (yyyy-MM) for the last `n` months ending at `end`, zero-filled. */
export function monthlySeries(entries: MoneyEntry[], end: string, n = 6) {
  const [y = 0, m = 1] = end.split("-").map(Number);
  const rows = Array.from({ length: n }, (_, i) => ({ month: new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1)).toISOString().slice(0, 7), income: 0, expenses: 0, profit: 0 }));
  // One pass over the entries, however many months are shown.
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  for (const e of entries) {
    const row = byMonth.get(e.entry_date.slice(0, 7));
    if (!row) continue;
    if (e.kind === "expense") row.expenses += Number(e.amount); else row.income += Number(e.amount);
  }
  for (const r of rows) r.profit = r.income - r.expenses;
  return rows;
}

export function bySource(entries: MoneyEntry[], kind: Kind) {
  const xs = entries.filter((e) => (kind === "expense") === (e.kind === "expense"));
  const total = xs.reduce((n, e) => n + Number(e.amount), 0);
  return sourcesFor(kind)
    .map((s) => {
      const value = xs.filter((e) => sourceMeta(kind, e.source).id === s.id).reduce((n, e) => n + Number(e.amount), 0);
      return { ...s, value, share: total ? Math.round((value / total) * 100) : 0 };
    })
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

/** % change vs previous value; null when there's nothing to compare. */
export const change = (now: number, before: number) => (before ? Math.round(((now - before) / Math.abs(before)) * 100) : null);

export const shiftMonth = (month: string, by: number) => {
  const [y = 0, m = 1] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
};
