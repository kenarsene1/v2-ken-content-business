import { describe, expect, it } from 'vitest';
import { csvForRows, WORKSPACE_TABLES } from '@/lib/workspace-data';
import { workspaceReminders } from '@/lib/reminders';
import type { BrandDeal, ContentItem } from '@/lib/queries';

describe('workspace exports', () => {
  it('includes all persisted CRM collections', () => expect(WORKSPACE_TABLES).toHaveLength(16));
  it('quotes cells and neutralizes spreadsheet formulas', () => {
    const csv = csvForRows([{ title: '=HYPERLINK("bad")', note: 'line\n"quote"', amount: 12 }]);
    expect(csv).toContain("\"'=HYPERLINK(\"\"bad\"\")\"");
    expect(csv).toContain('"line\n""quote"""');
    expect(csv).toContain('"12"');
  });
});
describe('real attention reminders', () => {
  const content = (patch: Partial<ContentItem>) => ({ id: 'video', title: 'Video', stage: 'editing', due_date: null, publish_at: null, priority: 'normal', account_id: 'profile', ...patch } as ContentItem);
  const deal = (patch: Partial<BrandDeal>) => ({ id: 'deal', brand: 'Brand', status: 'active', deadline: null, invoice_due: null, account_id: 'profile', ...patch } as BrandDeal);
  const now = new Date('2026-10-13T12:00:00');
  it('ignores completed content and paid/lost deals', () => {
    expect(workspaceReminders([content({ stage: 'published', due_date: '2026-10-10' })], [deal({ status: 'paid', invoice_due: '2026-10-10' })], now)).toEqual([]);
  });
  it('includes overdue, upcoming and undated priorities, not distant deadlines', () => {
    const rows = workspaceReminders([content({ due_date: '2026-10-12' }), content({ id: 'urgent', priority: 'urgent' }), content({ id: 'future', due_date: '2026-11-01' })], [deal({ invoice_due: '2026-10-16' })], now);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.overdue).toBe(true);
    expect(rows[1]?.label).toBe('Invoice due');
    expect(rows[2]?.date).toBeNull();
  });
});