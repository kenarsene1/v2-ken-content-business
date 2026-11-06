import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { DndContext, PointerSensor, KeyboardSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Flame, List, MoreHorizontal, Plus, Sparkles, Target, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useAccounts, useScopedContent, useCreateContent, useUpdateContent, type ContentItem } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { calendarDays, contentEvents, moveEventPatch, publishedStreak, type CalendarEvent as Event, type EventKind } from "@/lib/calendar";
import { STAGES, labelOf } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CalendarEvent } from "@/components/calendar-event";
import { PlatformDot } from "@/components/bits";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [
    { title: "Calendar · My content B/S CRM" },
    { name: "description", content: "Find your creative rhythm. Plan publishing days, connect your pipeline, and celebrate what you ship." },
    { property: "og:title", content: "Calendar · My content B/S CRM" },
    { property: "og:description", content: "A calm calendar for your content, publishing plans, and creative momentum." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CalendarPage,
});

function CalendarPage() {
  const { calendarView: view, setCalendarView, calendarDate, setCalendarDate, accountId, openContent } = useUI();
  const [today] = useState(() => new Date());
  const [anchor, setAnchor] = useState(today);
  const selected = calendarDate ? parseISO(calendarDate) : today;
  const { data: items = [], isLoading, isError, refetch } = useScopedContent();
  const { data: accounts = [] } = useAccounts();
  const update = useUpdateContent();
  const create = useCreateContent();
  const [filter, setFilter] = useState<EventKind | "all">("all");
  const [title, setTitle] = useState("");
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }), useSensor(KeyboardSensor));
  const events = useMemo(() => contentEvents(items, filter), [items, filter]);
  const days = calendarDays(anchor, view);
  const dayEvents = events.filter((e) => isSameDay(e.date, selected));
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const published = contentEvents(items, "publish").filter((e) => e.item.stage === "published");
  const shipped = published.filter((e) => e.date >= weekStart && e.date <= weekEnd).length;
  const activeAccounts = accounts.filter((a) => !a.archived_at && (!accountId || a.id === accountId));
  const goal = activeAccounts.reduce((n, a) => n + (a.posting_goal_period === "week" ? Math.max(0, a.posting_goal_count) : 0), 0);
  const progress = goal ? Math.min(shipped / goal, 1) : 0;
  const unscheduled = items.filter((i) => !i.publish_at && i.stage !== "published");
  const visibleUnscheduled = unscheduled.filter((i) => i.title.toLowerCase().includes(scheduleSearch.toLowerCase()));
  const streak = publishedStreak(items, today);
  const monthEvents = events.filter((e) => e.date >= startOfMonth(anchor) && e.date <= endOfMonth(anchor));

  const selectDay = (date: Date) => setCalendarDate(format(date, "yyyy-MM-dd"));
  const navigate = (direction: number) => setAnchor(view === "week" ? addWeeks(anchor, direction) : addMonths(anchor, direction));
  const undoableUpdate = (item: ContentItem, patch: Parameters<typeof update.mutate>[0]["patch"], message: string) => {
    update.mutate({ id: item.id, patch }, { onSuccess: () => toast.success(message, { action: { label: "Undo", onClick: () => update.mutate({ id: item.id, patch: { publish_at: item.publish_at, due_date: item.due_date, stage: item.stage } }) } }) });
  };
  const onDrop = (e: DragEndEvent) => {
    const event = e.active.data.current?.['event'] as Event | undefined;
    const date = e.over?.data.current?.['date'] as Date | undefined;
    if (!event || !date || isSameDay(event.date, date)) return;
    undoableUpdate(event.item, moveEventPatch(event.item, event.kind, date), `Moved to ${format(date, "MMM d")}`);
    selectDay(date);
  };
  const schedule = (item: ContentItem) => {
    undoableUpdate(item, moveEventPatch(item, "publish", selected), `Planned for ${format(selected, "MMM d")}`);
    setScheduleOpen(false);
    setScheduleSearch("");
  };
  const addContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || create.isPending) return;
    const date = new Date(selected); date.setHours(12, 0, 0, 0);
    const account = activeAccounts.find((a) => a.id === accountId);
    try {
      const row = await create.mutateAsync({ title: title.trim(), account_id: account?.id ?? null, platforms: account ? [account.platform] : [], publish_at: date.toISOString(), stage: "scheduled" });
      setTitle(""); openContent(row.id);
      toast.success("A little closer to shipping ✨");
    } catch { /* Mutation shows the error without discarding the title. */ }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <div>
        <section className="min-w-0" aria-label="Content calendar">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h1 className="mr-auto text-2xl font-semibold">{view === "week" ? `${format(days[0] ?? anchor, "MMM d")} – ${format(days[6] ?? anchor, "MMM d, yyyy")}` : format(anchor, "MMMM yyyy")}</h1>
            <Button variant="outline" size="sm" onClick={() => { setAnchor(today); selectDay(today); }}>Today</Button>
            <div className="flex"><Button variant="ghost" size="icon" title="Previous" aria-label="Previous period" onClick={() => navigate(-1)}><ChevronLeft /></Button><Button variant="ghost" size="icon" title="Next" aria-label="Next period" onClick={() => navigate(1)}><ChevronRight /></Button></div>
            <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Calendar view">{(["month", "week", "agenda"] as const).map((v) => <Button key={v} variant="ghost" size="sm" aria-pressed={view === v} onClick={() => setCalendarView(v)} className={cn("capitalize", view === v && "bg-background text-foreground shadow-sm")}>{v === "agenda" && <List className="h-3.5 w-3.5" />}{v}</Button>)}</div>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Planned</span><span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-success" />Published</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground" />Due</span></div>
            <Select value={filter} onValueChange={(v) => setFilter(v as EventKind | "all")}><SelectTrigger aria-label="Event filter" className="h-7 w-32 border-0 bg-transparent text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All events</SelectItem><SelectItem value="publish">Publishing</SelectItem><SelectItem value="due">Due dates</SelectItem></SelectContent></Select>
          </div>
          {isLoading ? <Skeleton className="h-[540px] w-full" /> : isError ? <div className="py-20 text-center"><p className="mb-3 text-sm text-muted-foreground">Your calendar couldn't load.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div> : view === "agenda" ? (
            <div key={`agenda:${format(anchor, "yyyy-MM")}:${accountId}`} className="calendar-enter divide-y border-y">
              {!monthEvents.length && <div className="py-20 text-center"><Sparkles className="mx-auto mb-3 h-6 w-6 text-primary" /><p className="text-sm font-medium">A little room for your next big idea.</p><p className="mt-1 text-xs text-muted-foreground">Nothing planned in {format(anchor, "MMMM")} yet.</p></div>}
              {calendarDays(anchor, "month").filter((d) => isSameMonth(d, anchor) && monthEvents.some((e) => isSameDay(e.date, d))).map((day) => <div key={day.toISOString()} className="flex gap-4 py-4"><Button variant="ghost" onClick={() => selectDay(day)} className="h-auto w-16 shrink-0 flex-col gap-0 py-2"><span className="text-[10px] uppercase text-muted-foreground">{format(day, "EEE")}</span><span className={cn("text-xl", isToday(day) && "text-primary")}>{format(day, "d")}</span></Button><div className="min-w-0 flex-1 space-y-2">{monthEvents.filter((e) => isSameDay(e.date, day)).map((e) => <CalendarEvent key={e.id} event={e} />)}</div></div>)}
            </div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={onDrop}>
              <div key={`${view}:${format(anchor, "yyyy-MM-dd")}:${accountId}`} className="calendar-enter overflow-x-auto rounded-lg border">
                <div className={cn("grid grid-cols-7", view === "week" ? "min-w-[630px]" : "min-w-[350px]")}>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="border-b bg-muted/35 py-2.5 text-center text-[11px] font-medium text-muted-foreground">{d}</div>)}
                  {days.map((day) => <Day key={day.toISOString()} day={day} selected={selected} anchor={anchor} week={view === "week"} events={events.filter((e) => isSameDay(e.date, day))} onSelect={selectDay} />)}
                </div>
              </div>
            </DndContext>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">{Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll("_", " ")}<span className="mx-2">·</span>{events.filter((e) => isSameMonth(e.date, anchor) && e.kind === "publish").length} publishing plans in {format(anchor, "MMMM")}</p>
        </section>

      </div>
    </div>
  );
}

function Day({ day, selected, anchor, week, events, onSelect }: { day: Date; selected: Date; anchor: Date; week: boolean; events: Event[]; onSelect: (d: Date) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: format(day, "yyyy-MM-dd"), data: { date: day } });
  const same = isSameDay(day, selected);
  const visible = week ? events : events.slice(0, 3);
  return <div ref={setNodeRef} className={cn("group min-w-0 border-b border-r p-1.5 transition-colors [&:nth-child(7n)]:border-r-0 sm:p-2", week ? "min-h-[560px]" : "min-h-[120px] sm:min-h-[150px]", !isSameMonth(day, anchor) && !week && "bg-muted/30", same && "bg-accent/25", isOver && "bg-accent ring-1 ring-inset ring-primary")}>
    <div className="mb-1.5 flex items-center justify-between"><Button variant="ghost" size="icon" onClick={() => onSelect(day)} aria-label={format(day, "EEEE, MMMM d, yyyy")} aria-pressed={same} className={cn("h-7 w-7 rounded-full text-xs", !isSameMonth(day, anchor) && !week && "text-muted-foreground/60", isToday(day) && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground", same && !isToday(day) && "bg-accent text-primary")}>{format(day, "d")}</Button></div>
    <div className="space-y-1">{visible.map((e) => <CalendarEvent key={e.id} event={e} compact={!week} />)}{!week && events.length > 3 && <Button variant="ghost" onClick={() => onSelect(day)} className="h-5 w-full px-1 text-[10px] text-muted-foreground">+{events.length - 3} more</Button>}{week && !events.some((e) => e.kind === "publish") && <p className="pt-6 text-center text-[10px] leading-relaxed text-muted-foreground/70">Room to create<br />No post planned</p>}</div>
  </div>;
}