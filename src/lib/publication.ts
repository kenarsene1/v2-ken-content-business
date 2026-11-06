import { format, isValid, parseISO } from 'date-fns';

type Publication = { stage: string; publish_at: string | null; account_id: string | null };

/** Persist the same date used by optimistic UI; preserve deliberate historical dates. */
export function publicationPatch<T extends { stage?: string; publish_at?: string | null }>(item: Pick<Publication, 'publish_at'> | undefined, patch: T, now = new Date()): T & { publish_at?: string | null } {
  if (patch.stage !== 'published') return patch;
  const value = patch.publish_at ?? item?.publish_at;
  const date = value ? parseISO(value) : null;
  return { ...patch, publish_at: value && date && isValid(date) && date <= now ? value : now.toISOString() };
}

export function publishedThisMonth<T extends Publication>(items: T[], now: Date, accountId: string | null = null): T[] {
  const month = format(now, 'yyyy-MM');
  return items.filter(item => {
    if (item.stage !== 'published' || !item.publish_at || (accountId && item.account_id !== accountId)) return false;
    const date = parseISO(item.publish_at);
    return isValid(date) && date <= now && format(date, 'yyyy-MM') === month;
  });
}