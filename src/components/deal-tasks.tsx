import { useState } from "react";
import { format } from "date-fns";
import { Check, DatabaseZap, Plus, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineEdit } from "@/components/inline-edit";
import { isMissingTableError, useCreateDealTask, useDealTasks, useDeleteDealTask, useScopedDeals, useUpdateDealTask } from "@/lib/queries";
import { TASK_SUGGESTIONS, dueState, fromLocalInput, sortTasks, toLocalInput, type DealTask, type DueState } from "@/lib/deal-tasks";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";

const DUE_TONE: Record<DueState, string> = {
  overdue: "text-destructive",
  today: "text-chart-3",
  soon: "text-primary",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
};

function SetupNotice() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
      <DatabaseZap className="h-4 w-4 shrink-0 text-primary/60" />
      Tasks need a quick database update. In Lovable, ask it to apply the latest database migration, then reload.
    </div>
  );
}

function CheckButton({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200 motion-reduce:transition-none",
        done ? "scale-110 border-success bg-success text-background" : "border-muted-foreground/40 hover:border-primary",
      )}
    >
      {done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
    </button>
  );
}

function dueLabel(task: DealTask) {
  return task.due_at ? format(new Date(task.due_at), "MMM d, h:mm a") : "";
}

/** Checklist for one deal: add, rename (click), set a reminder time, tick off, remove. */
export function DealTaskList({ dealId }: { dealId: string }) {
  const { data, isLoading, error } = useDealTasks();
  const create = useCreateDealTask();
  const update = useUpdateDealTask();
  const remove = useDeleteDealTask();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const tasks = sortTasks((data ?? []).filter((t) => t.deal_id === dealId));
  const add = (title: string) => {
    const t = title.trim();
    if (!t) return;
    create.mutate({ deal_id: dealId, title: t, sort_order: tasks.length });
    setDraft("");
  };

  if (isMissingTableError(error, "deal_tasks")) return <SetupNotice />;
  return (
    <div className="space-y-2">
      {isLoading ? <Skeleton className="h-8" /> : (
        <ul className="space-y-0.5">
          {tasks.map((t) => {
            const state = dueState(t);
            return (
              <li key={t.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
                <CheckButton done={!!t.done_at} label={`Mark “${t.title}” ${t.done_at ? "not done" : "done"}`}
                  onToggle={() => update.mutate({ id: t.id, patch: { done_at: t.done_at ? null : new Date().toISOString() } })} />
                {editing === t.id ? (
                  <InlineEdit value={t.title} label="Task name" className="flex-1 text-xs" onDone={() => setEditing(null)}
                    onSave={(v) => v.trim() ? update.mutate({ id: t.id, patch: { title: v.trim() } }) : remove.mutate(t.id)} />
                ) : (
                  <button type="button" onClick={() => setEditing(t.id)} title="Click to rename"
                    className={cn("min-w-0 flex-1 truncate text-left text-xs", t.done_at && "text-muted-foreground line-through")}>{t.title}</button>
                )}
                <label className={cn("relative shrink-0 cursor-pointer text-[11px] tabular-nums", DUE_TONE[state])} title="Reminder time">
                  {t.due_at ? dueLabel(t) : <span className="opacity-40 transition-opacity group-hover:opacity-100">+ time</span>}
                  <input type="datetime-local" aria-label={`Reminder time for ${t.title}`} value={toLocalInput(t.due_at)}
                    onChange={(e) => update.mutate({ id: t.id, patch: { due_at: fromLocalInput(e.target.value) } })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
                <button type="button" aria-label={`Remove “${t.title}”`} onClick={() => remove.mutate(t.id)}
                  className="shrink-0 text-muted-foreground opacity-40 transition-opacity hover:text-destructive hover:opacity-100 focus-visible:opacity-100"><X className="h-3.5 w-3.5" /></button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center gap-2 rounded-md border px-2 py-1">
        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add(draft)} placeholder="Add a task and press Enter…"
          aria-label="New task" className="w-full bg-transparent py-0.5 text-xs outline-none placeholder:text-muted-foreground" />
      </div>
      {tasks.length === 0 && (
        <div className="flex flex-wrap gap-1">
          {TASK_SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const SHOWN = 6;

/** Dashboard: open deal tasks, soonest reminder first. */
export function DashboardDealTasks() {
  const { data, isLoading, error } = useDealTasks();
  const { data: deals } = useScopedDeals();
  const update = useUpdateDealTask();
  const { openDeal } = useUI();
  const byDeal = new Map((deals ?? []).map((d) => [d.id, d]));
  const open = sortTasks((data ?? []).filter((t) => !t.done_at && byDeal.has(t.deal_id)));

  return (
    <section>
      <h2 className="mb-2.5 text-sm">Brand deal tasks</h2>
      {isMissingTableError(error, "deal_tasks") ? <SetupNotice /> : isLoading ? <Skeleton className="h-16" /> : open.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-5 text-center text-xs text-muted-foreground">No open deal tasks. Add follow-ups and reminders from a brand deal.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border bg-card">
          {open.slice(0, SHOWN).map((t) => {
            const deal = byDeal.get(t.deal_id);
            const state = dueState(t);
            return (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                <CheckButton done={false} label={`Mark “${t.title}” done`} onToggle={() => update.mutate({ id: t.id, patch: { done_at: new Date().toISOString() } })} />
                <button type="button" onClick={() => openDeal(t.deal_id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-xs">{t.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{deal?.brand}</span>
                </button>
                {t.due_at && <span className={cn("shrink-0 text-[11px] tabular-nums", DUE_TONE[state])}>{state === "overdue" ? "Overdue · " : ""}{dueLabel(t)}</span>}
              </li>
            );
          })}
          {open.length > SHOWN && <li className="px-3 py-1.5 text-center text-[11px] text-muted-foreground">+{open.length - SHOWN} more in your brand deals</li>}
        </ul>
      )}
    </section>
  );
}
