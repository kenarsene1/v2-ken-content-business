import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import type { BrandDeal, ContentItem } from './queries';

export type Reminder = { id: string; itemId: string; kind: 'content' | 'deal'; title: string; label: string; date: string | null; overdue: boolean; accountId: string | null };
/** Derived from saved records, not duplicated tasks; dates without times stay local. */
export function workspaceReminders(content: ContentItem[], deals: BrandDeal[], now = new Date()): Reminder[] {
  const today = format(now, 'yyyy-MM-dd');
  const horizon = format(addDays(now, 7), 'yyyy-MM-dd');
  const reminders: Reminder[] = [];
  const add = (id: string, itemId: string, kind: Reminder['kind'], title: string, label: string, date: string | null, accountId: string | null) => {
    if (date && date <= horizon) reminders.push({ id, itemId, kind, title, label, date, overdue: date < today, accountId });
  };
  for (const item of content) {
    if (item.stage === 'published') continue;
    add(`due:${item.id}`, item.id, 'content', item.title, 'Content deadline', item.due_date, item.account_id);
    const publishing = item.publish_at ? parseISO(item.publish_at) : null;
    if (publishing && isValid(publishing)) add(`publish:${item.id}`, item.id, 'content', item.title, 'Publishing', format(publishing, 'yyyy-MM-dd'), item.account_id);
    if ((item.priority === 'urgent' || item.priority === 'high') && !item.due_date && !item.publish_at) reminders.push({ id: `attention:${item.id}`, itemId: item.id, kind: 'content', title: item.title, label: `${item.priority === 'urgent' ? 'Urgent' : 'High priority'} · No date`, date: null, overdue: false, accountId: item.account_id });
  }
  for (const deal of deals) {
    if (deal.status === 'paid' || deal.status === 'lost') continue;
    if (deal.status !== 'delivered') add(`deal:${deal.id}`, deal.id, 'deal', deal.brand || deal.title, 'Deal deadline', deal.deadline, deal.account_id);
    add(`invoice:${deal.id}`, deal.id, 'deal', deal.brand || deal.title, 'Invoice due', deal.invoice_due, deal.account_id);
  }
  return reminders.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.id.localeCompare(b.id));
}

/** Short "when" text for a reminder: Overdue, Today, Tomorrow, a weekday this week, or the date. */
export function reminderWhen(reminder: Pick<Reminder, 'date' | 'overdue'>, now = new Date()): string {
  if (!reminder.date) return 'No date';
  if (reminder.overdue) return 'Overdue';
  const day = parseISO(reminder.date);
  if (!isValid(day)) return 'No date';
  const days = differenceInCalendarDays(day, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return days < 7 ? format(day, 'EEE') : format(day, 'MMM d');
}
