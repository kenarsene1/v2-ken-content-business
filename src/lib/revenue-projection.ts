import { INCOME_SOURCES, type MoneyEntry } from './revenue';

export type PublishedInput = { stage: string; publish_at: string | null; due_date: string | null };
export function projectionHistory(entries: MoneyEntry[], content: PublishedInput[], month: string, currency: string, asOfMonth = new Date().toISOString().slice(0,7)) {
  const cutoff = month < asOfMonth ? month : asOfMonth;
  const income = entries.filter(e => e.kind === 'income' && (e.currency ?? 'USD') === currency && e.entry_date < `${cutoff}-01`);
  const first = income.map(e => e.entry_date.slice(0, 7)).sort()[0];
  const months = first ? Math.max(1, (Number(cutoff.slice(0,4)) - Number(first.slice(0,4))) * 12 + Number(cutoff.slice(5,7)) - Number(first.slice(5,7))) : 0;
  const videos = content.filter(c => c.stage === 'published' && Boolean(c.publish_at ?? c.due_date) && (c.publish_at ?? c.due_date ?? '') < `${cutoff}-01` && (c.publish_at ?? c.due_date ?? '').slice(0,7) >= (first ?? cutoff)).length;
  const rows = INCOME_SOURCES.map(s => {
    const items = income.filter(e => e.source === s.id);
    const total = items.reduce((sum,e) => sum + e.amount, 0);
    const videoBased = s.id === 'adsense';
    const units = videoBased ? videos : items.length;
    return { id: s.id, label: s.label, total, units, rate: units ? total / units : 0, baseline: months ? units / months : 0,
      unitLabel: videoBased ? 'videos' : s.id === 'brand_deals' ? 'paid deals / payments' : 'income payments',
      assumption: videoBased ? 'Ad income per published video is an association, not attributed earnings.' : 'One recorded payment is one input; product sales quantities are not tracked.' };
  }).filter(r => r.total > 0);
  return { rows, months, income, videos };
}
export function forecast(rows: { id: string; rate: number; baseline: number }[], targets: Record<string, number>) {
  const expected = rows.reduce((sum,r) => sum + r.rate * Math.max(0, targets[r.id] ?? r.baseline), 0);
  return { low: expected * .7, expected, high: expected * 1.3 };
}