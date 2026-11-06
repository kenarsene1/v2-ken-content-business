import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, format, differenceInCalendarDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getYouTubeAnalytics, type YouTubeVideo } from '@/lib/youtube.functions';
import type { Account } from '@/lib/queries';

const nf = new Intl.NumberFormat('en');
const pf = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 2 });
const show = (n: number | null) => (n == null ? 'Not available' : nf.format(n));

/** ISO 8601 (PT1H2M3S) → 1:02:03 */
export function formatDuration(iso: string | null) {
  const m = iso?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return '—';
  const h = Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0);
  const min = Number(m[3] ?? 0), s = Number(m[4] ?? 0);
  const pad = (x: number) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(min)}:${pad(s)}` : `${min}:${pad(s)}`;
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

/** Stats over loaded videos only; videos with hidden counts are excluded rather than counted as 0. */
export function videoInsights(videos: YouTubeVideo[], now = new Date()) {
  const withViews = videos.filter((v) => v.views != null);
  const views = withViews.map((v) => v.views!);
  const totalViews = views.reduce((a, b) => a + b, 0);
  const engaged = withViews.filter((v) => v.likes != null && v.comments != null && v.views! > 0);
  const engViews = engaged.reduce((a, v) => a + v.views!, 0);
  const engagement = engViews ? engaged.reduce((a, v) => a + v.likes! + v.comments!, 0) / engViews : null;
  const dates = videos.map((v) => new Date(v.publishedAt)).filter((d) => !isNaN(+d)).sort((a, b) => +a - +b);
  const span = dates.length > 1 ? differenceInCalendarDays(dates[dates.length - 1]!, dates[0]!) : 0;
  const daysPerUpload = dates.length > 1 && span > 0 ? span / (dates.length - 1) : null;
  const sinceLast = dates.length ? differenceInCalendarDays(now, dates[dates.length - 1]!) : null;
  return {
    count: withViews.length,
    avg: withViews.length ? Math.round(totalViews / withViews.length) : null,
    median: median(views),
    engagement,
    daysPerUpload,
    sinceLast,
  };
}

export function YouTubeAnalytics({ account }: { account: Account }) {
  const fetchFn = useServerFn(getYouTubeAnalytics);
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ['youtube', account.id, account.url, account.handle],
    queryFn: ({ pageParam }) => fetchFn({ data: { accountId: account.id, pageToken: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextPageToken ?? undefined,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    maxPages: 10,
  });
  const first = q.data?.pages[0];
  const channel = first?.channel;
  const videos = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages ?? []).flatMap((p) => p.videos).filter((v) => !seen.has(v.id) && seen.add(v.id));
  }, [q.data]);
  const insights = useMemo(() => videoInsights(videos), [videos]);

  const refresh = async () => {
    // Reset to page one so a refresh re-reads the channel and costs minimal quota.
    await qc.resetQueries({ queryKey: ['youtube', account.id], exact: false });
    qc.invalidateQueries({ queryKey: ['accounts'] });
  };

  // First successful load saved the subscriber count; keep profile lists in sync.
  const syncedAt = first?.syncedAt;
  useEffect(() => {
    if (syncedAt) qc.invalidateQueries({ queryKey: ['accounts'] });
  }, [syncedAt, qc]);

  const stat = (label: string, value: string, hint?: string) => (
    <div key={label} className="rounded-lg border p-2.5" title={hint}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );

  return (
    <section className="space-y-3" aria-label="YouTube public stats">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">YouTube public stats</h3>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={refresh} disabled={q.isFetching} aria-label="Refresh YouTube stats">
          <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {q.isLoading ? (
        <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-24" /></div>
      ) : q.isError ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{(q.error as Error).message}</p>
      ) : channel ? (
        <>
          <div className="flex gap-3 rounded-lg border p-3">
            {channel.thumbnail && <img src={channel.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-full" />}
            <div className="min-w-0">
              <a href={`https://youtube.com/channel/${channel.id}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">{channel.title}</a>
              <p className="truncate font-mono text-[11px] text-muted-foreground">{channel.id}</p>
              {channel.description && (
                <button onClick={() => setExpanded(!expanded)} className={`mt-1 text-left text-xs text-muted-foreground ${expanded ? 'whitespace-pre-line' : 'line-clamp-2'}`}>
                  {channel.description}
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stat('Subscribers', show(channel.subscribers))}
            {stat('Total views', show(channel.views))}
            {stat('Videos', show(channel.videos))}
          </div>
          {insights.count > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stat('Average views', show(insights.avg), `Across the ${insights.count} videos loaded below`)}
              {stat('Typical views', show(insights.median), 'Median — not skewed by one viral video')}
              {stat('Engagement', insights.engagement == null ? 'Not available' : pf.format(insights.engagement), '(Likes + comments) ÷ views')}
              {stat('Uploads', insights.daysPerUpload == null ? '—' : `every ${insights.daysPerUpload.toFixed(1)} days`, insights.sinceLast == null ? undefined : `Last upload ${insights.sinceLast} days ago`)}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Updated {formatDistanceToNow(new Date(first!.syncedAt), { addSuffix: true })}. Video averages use the {insights.count} latest videos loaded. YouTube rounds public subscriber counts, and channels can hide some numbers.
          </p>

          <h4 className="pt-1 text-xs font-medium text-muted-foreground">Latest videos</h4>
          {!videos.length ? (
            <p className="text-sm text-muted-foreground">No public videos yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {videos.map((v) => (
                <li key={v.id}>
                  <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" className="flex gap-3 p-2.5 hover:bg-muted/50">
                    <div className="relative shrink-0">
                      {v.thumbnail ? <img src={v.thumbnail} alt="" loading="lazy" decoding="async" className="h-14 w-24 rounded object-cover" /> : <div className="h-14 w-24 rounded bg-muted" />}
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-foreground/80 px-1 text-[10px] text-background">{formatDuration(v.duration)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">{v.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {v.publishedAt && format(new Date(v.publishedAt), 'MMM d, yyyy')} · {show(v.views)} views
                        {v.likes != null && ` · ${nf.format(v.likes)} likes`}
                        {v.comments != null && ` · ${nf.format(v.comments)} comments`}
                      </p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
          {q.hasNextPage && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
              {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </>
      ) : null}
    </section>
  );
}
