import type { Database } from "@/integrations/supabase/types";

export type DealTask = Database["public"]["Tables"]["deal_tasks"]["Row"];

/** Starter ideas shown as one-tap chips; the user can still type anything. */
export const TASK_SUGGESTIONS = ["Send follow-up", "Send video angle", "Send script", "Send draft video", "Send invoice"];

export type DueState = "overdue" | "today" | "soon" | "later" | "none";

/** How urgent a task is, from its reminder time. Done tasks are never urgent. */
export function dueState(task: Pick<DealTask, "due_at" | "done_at">, now = new Date()): DueState {
  if (task.done_at || !task.due_at) return "none";
  const due = new Date(task.due_at);
  if (due.getTime() < now.getTime()) return "overdue";
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (due <= endOfToday) return "today";
  const inThreeDays = new Date(endOfToday.getTime() + 3 * 86_400_000);
  return due <= inThreeDays ? "soon" : "later";
}

/** Open tasks first (soonest reminder first, untimed last), then done ones. */
export function sortTasks<T extends Pick<DealTask, "due_at" | "done_at" | "sort_order" | "created_at">>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (!!a.done_at !== !!b.done_at) return a.done_at ? 1 : -1;
    if (a.due_at && b.due_at && a.due_at !== b.due_at) return a.due_at < b.due_at ? -1 : 1;
    if (!!a.due_at !== !!b.due_at) return a.due_at ? -1 : 1;
    return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
  });
}

/** `datetime-local` input value (local time) from an ISO timestamp. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO timestamp from a `datetime-local` value; empty means no reminder. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
