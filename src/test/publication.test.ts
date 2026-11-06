import { describe, expect, it } from 'vitest';
import { publicationPatch, publishedThisMonth } from '@/lib/publication';

const now = new Date('2026-10-27T10:00:00Z');
describe('Published dashboard updates', () => {
  it('persists the date even after the optimistic cache already says published', () => {
    const optimistic = publicationPatch({ publish_at: null }, { stage: 'published' }, now);
    expect(publicationPatch({ publish_at: optimistic.publish_at ?? null }, { stage: 'published' }, now).publish_at).toBe(now.toISOString());
  });
  it('replaces a future scheduled date when marked uploaded', () => {
    expect(publicationPatch({ publish_at: '2026-11-01T12:00:00Z' }, { stage: 'published' }, now).publish_at).toBe(now.toISOString());
  });
  it('preserves an actual historical publication date', () => {
    expect(publicationPatch({ publish_at: '2026-10-02T12:00:00Z' }, { stage: 'published' }, now).publish_at).toBe('2026-10-02T12:00:00Z');
  });
  it('counts both profiles together and isolates each profile', () => {
    const rows = ['a', 'b'].map(account_id => ({ account_id, stage: 'published', publish_at: '2026-10-26T12:00:00Z' }));
    expect(publishedThisMonth(rows, now)).toHaveLength(2);
    expect(publishedThisMonth(rows, now, 'a')).toEqual([rows[0]]);
    expect(publishedThisMonth(rows, now, 'b')).toEqual([rows[1]]);
  });
  it('excludes scheduled, future, invalid and other-month publications', () => {
    const rows = [
      { stage: 'scheduled', publish_at: '2026-10-26T12:00:00Z', account_id: null },
      ...['2026-10-28T12:00:00Z', 'bad', '2026-09-26T12:00:00Z'].map(publish_at => ({ stage: 'published', publish_at, account_id: null })),
    ];
    expect(publishedThisMonth(rows, now)).toEqual([]);
  });
});