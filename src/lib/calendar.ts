import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isValid, parseISO, startOfMonth, startOfWeek } from "date-fns";
import type { ContentItem } from "./queries";

export type CalendarView = "month" | "week" | "agenda";
export type EventKind = "publish" | "due";
export type CalendarEvent = { id: string; item: ContentItem; date: Date; kind: EventKind };

export function contentEvents(items: ContentItem[], filter: EventKind | "all" = "all"): CalendarEvent[] {
  return items.flatMap((item) => {
    const events: CalendarEvent[] = [];
    for (const kind of ["publish", "due"] as const) {
      const value = kind === "publish" ? item.publish_at : item.due_date;
      if (!value || (filter !== "all" && filter !== kind)) continue;
      // Once published, the item lives only on its publish date — no leftover deadline copy.
      if (kind === "due" && item.stage === "published" && item.publish_at) continue;
      const date = parseISO(value);
      if (isValid(date)) events.push({ id: `${kind}:${item.id}`, item, date, kind });
    }
    return events;
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function calendarDays(anchor: Date, view: CalendarView) {
  const start = startOfWeek(view === "week" ? anchor : startOfMonth(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(view === "week" ? anchor : endOfMonth(anchor), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

/** Keep the creator's local publishing time when moving between days. */
export function moveEventPatch(item: ContentItem, kind: EventKind, date: Date) {
  if (kind === "due") return { due_date: format(date, "yyyy-MM-dd") };
  const previous = item.publish_at ? parseISO(item.publish_at) : null;
  const next = new Date(date);
  next.setHours(previous && isValid(previous) ? previous.getHours() : 12, previous && isValid(previous) ? previous.getMinutes() : 0, 0, 0);
  return { publish_at: next.toISOString(), stage: item.stage === "idea" ? "scheduled" : item.stage };
}

export function publishedStreak(items: ContentItem[], today: Date) {
  const dates = contentEvents(items, "publish").filter((e) => e.item.stage === "published").map((e) => e.date);
  let day = dates.some((d) => isSameDay(d, today)) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.some((d) => isSameDay(d, day))) { streak++; day = addDays(day, -1); }
  return streak;
}

export function localDateTime(value: string | null) {
  if (!value) return "";
  const date = parseISO(value);
  return isValid(date) ? format(date, "yyyy-MM-dd'T'HH:mm") : "";
}