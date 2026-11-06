import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { BotMessageSquare, Minus } from 'lucide-react';
import { useAccounts, useContent, useDeals } from '@/lib/queries';
import { reminderWhen, workspaceReminders, type Reminder } from '@/lib/reminders';
import { useUI } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/** The chat (AI SDK, markdown) is heavy, so it loads only when "Ask" is opened. */
const AssistantAsk = lazy(() => import('./assistant-panel').then(module => ({ default: module.AssistantAsk })));

export const AssistantIcon = BotMessageSquare;

/** Reminders shown before "Show more". */
const PREVIEW = 4;

type View = 'today' | 'ask';

/**
 * Small floating assistant in the top-right corner: today's reminders plus the chat.
 * Not a modal (no role="dialog"), so the page and keyboard shortcuts keep working under it.
 */
export function AssistantPopover({ open, onMinimize }: { open: boolean; onMinimize: () => void }) {
  const [shown, setShown] = useState(false);
  const [view, setView] = useState<View>('today');
  const [askLoaded, setAskLoaded] = useState(false);
  // Wait one frame after mounting so the slide-in transition has a starting point.
  useEffect(() => {
    if (!open) { setShown(false); return; }
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const content = useContent(); const deals = useDeals(); const accounts = useAccounts();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(timer); }, []);
  const reminders = useMemo(() => workspaceReminders(content.data ?? [], deals.data ?? [], now), [content.data, deals.data, now]);
  const overdue = reminders.filter(r => r.overdue).length;

  const show = (next: View) => { setView(next); if (next === 'ask') setAskLoaded(true); };

  return <aside
    aria-label="Assistant"
    data-state={shown ? 'open' : 'closed'}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onMinimize(); } }}
    className={cn(
      'fixed right-4 top-[5.5rem] z-40 flex origin-top-right flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-[0_16px_48px_-20px_rgb(0_0_0/0.3)] backdrop-blur-xl md:right-8',
      'transition-[opacity,transform,visibility,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
      view === 'ask' ? 'w-[min(26rem,calc(100vw-2rem))]' : 'w-[min(21rem,calc(100vw-2rem))]',
      shown ? 'visible translate-y-0 scale-100 opacity-100' : 'invisible -translate-y-3 scale-[0.97] opacity-0',
    )}
  >
    <header className="flex items-center gap-2 px-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><AssistantIcon className="h-3.5 w-3.5" /></span>
      <div role="group" aria-label="Assistant view" className="mr-auto flex rounded-full bg-muted/70 p-0.5">
        {(['today', 'ask'] as const).map(v => <Button key={v} type="button" variant="ghost" aria-pressed={view === v} onClick={() => show(v)}
          className={cn('h-6 gap-1 rounded-full px-2.5 text-xs font-normal hover:bg-transparent', view === v ? 'bg-card font-medium text-foreground shadow-sm hover:bg-card' : 'text-muted-foreground hover:text-foreground')}>
          {v === 'today' ? 'Today' : 'Ask'}
          {v === 'today' && reminders.length > 0 && <span className={cn('tabular-nums', overdue ? 'text-destructive' : 'text-muted-foreground')}>{reminders.length}</span>}
        </Button>)}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Hide assistant" title="Hide (Esc)" className="text-muted-foreground" onClick={onMinimize}><Minus /></Button>
    </header>

    {view === 'today' && <TodayList reminders={reminders} now={now} loading={content.isLoading || deals.isLoading} failed={content.isError || deals.isError} accountName={id => accounts.data?.find(a => a.id === id)?.name ?? null} />}
    {askLoaded && <div className={cn('flex h-[min(28rem,calc(100vh-9rem))] min-h-0 flex-col px-3 pb-3', view !== 'ask' && 'hidden')}>
      <Suspense fallback={<p role="status" className="py-6 text-center text-xs text-muted-foreground">Opening…</p>}><AssistantAsk /></Suspense>
    </div>}
  </aside>;
}

function TodayList({ reminders, now, loading, failed, accountName }: { reminders: Reminder[]; now: Date; loading: boolean; failed: boolean; accountName: (id: string | null) => string | null }) {
  const [all, setAll] = useState(false);
  const open = (reminder: Reminder) => {
    if (reminder.kind === 'content') useUI.getState().openContent(reminder.itemId); else useUI.getState().openDeal(reminder.itemId);
  };
  if (failed) return <p role="alert" className="px-4 pb-4 text-xs text-destructive">Reminders could not be loaded.</p>;
  if (loading) return <div role="status" aria-label="Loading reminders" className="space-y-2 px-3 pb-3"><Skeleton className="h-9 motion-reduce:animate-none" /><Skeleton className="h-9 motion-reduce:animate-none" /></div>;
  if (!reminders.length) return <p className="px-4 pb-4 text-xs text-muted-foreground">All clear. Nothing due this week.</p>;
  const rows = all ? reminders : reminders.slice(0, PREVIEW);
  const hidden = reminders.length - rows.length;
  return <div className="pb-2">
    <ul className={cn('px-1.5', all && 'max-h-[min(22rem,calc(100vh-12rem))] overflow-y-auto')}>
      {rows.map(reminder => {
        const profile = accountName(reminder.accountId);
        return <li key={reminder.id}><Button variant="ghost" onClick={() => open(reminder)} title={`${reminder.title} · ${reminder.label}`}
          className="h-auto w-full justify-between gap-3 rounded-xl px-2.5 py-2 text-left font-normal hover:bg-muted/60">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{reminder.title}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{reminder.label}{profile ? ` · ${profile}` : ''}</span>
          </span>
          {reminder.date && <span className={cn('shrink-0 text-[11px] tabular-nums', reminder.overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>{reminderWhen(reminder, now)}</span>}
        </Button></li>;
      })}
    </ul>
    {reminders.length > PREVIEW &&<Button variant="ghost" size="sm" className="mx-1.5 h-7 w-[calc(100%-0.75rem)] rounded-xl text-xs font-normal text-muted-foreground" onClick={() => setAll(!all)}>
      {all ? 'Show less' : `Show ${hidden} more`}
    </Button>}
  </div>;
}
