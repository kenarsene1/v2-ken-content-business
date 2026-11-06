import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowRight, Film, FolderPlus, GripVertical, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, pointerWithin, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { moveBefore, moveToTop } from "@/lib/deal-order";
import {
  useActiveAccounts, useContent, useCreateDeal, useCreateGroup, useDealGroups, useDeleteDealOrGroup,
  useReorderDeals, useScopedDeals, useUpdateDeal, useUpdateGroup, type BrandDeal,
} from "@/lib/queries";
import { useUI } from "@/lib/store";
import { DEAL_PHASES, DEAL_STATUSES, TONE_CLASS, TONE_FILL, dealStats, formatMoney, statusBreakdown, statusMeta } from "@/lib/deals";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AutoInput } from "@/components/bits";
import { ProfileAvatar } from "@/components/profile-avatar";
import { markDraft } from "@/lib/drafts";
import { cn } from "@/lib/utils";

/** Fixed rate for the RWF view (no live FX). */
const USD_TO_RWF = 1478.41;

export const Route = createFileRoute("/_authenticated/deals")({
  validateSearch: (s: Record<string, unknown>): { group?: string } => (typeof s['group'] === "string" ? { group: s['group'] } : {}),
  head: () => ({
    meta: [
      { title: "Brand deals · My content B/S CRM" },
      { name: "description", content: "Track sponsorships, deal groups and what you've earned." },
      { property: "og:title", content: "Brand deals · My content B/S CRM" },
      { property: "og:description", content: "Track sponsorships, deal groups and what you've earned." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DealsPage,
});


function DealsPage() {
  const { group } = Route.useSearch();
  const navigate = useNavigate({ from: "/deals" });
  const { data: deals, isLoading } = useScopedDeals();
  const { data: groups } = useDealGroups();
  const { accountId, openDeal } = useUI();
  const createDeal = useCreateDeal();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const del = useDeleteDealOrGroup();

  const all = deals ?? [];
  // Default view: newest group, otherwise all deals.
  const current = group ?? groups?.at(-1)?.id ?? "all";
  const currentGroup = groups?.find((g) => g.id === current);
  const viewDeals = current === "all" ? all : current === "none" ? all.filter((d) => !d.group_id) : all.filter((d) => d.group_id === current);
  const setView = (g: string) => {
    navigate({ search: { group: g } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const newDeal = async () => {
    const row = await createDeal.mutateAsync({ account_id: accountId, group_id: currentGroup?.id ?? null });
    markDraft("brand_deals", row.id);
    openDeal(row.id);
  };
  const newGroup = async () => {
    const g = await createGroup.mutateAsync({ name: `${format(new Date(), "MMMM")} deals`, sort_order: (groups?.length ?? 0) });
    navigate({ search: { group: g.id } });
  };

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-12">
      {/* Current view */}
      <section className="space-y-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{currentGroup ? "Deal group" : "Brand deals"}</p>
            {currentGroup ? (
              <AutoInput key={currentGroup.id} value={currentGroup.name} aria-label="Deal group name" className="-ml-1.5 mt-1 w-auto max-w-full min-w-24 [field-sizing:content] rounded-md px-1.5 py-0.5 font-display text-2xl font-medium sm:text-3xl"
                onSave={(name) => updateGroup.mutate({ id: currentGroup.id, patch: { name: name.trim() || "Untitled group" } })} />
            ) : (
              <h1 className="text-3xl font-semibold tracking-tight">{current === "none" ? "Ungrouped deals" : "All deals"}</h1>
            )}
          </div>
          <div className="flex shrink-0 gap-1 sm:gap-2">
            {currentGroup && (
              <Button variant="ghost" size="icon" aria-label="Delete group" title="Delete group (deals are kept)"
                onClick={() => { del("group", currentGroup, currentGroup.name); setView("all"); }}><Trash2 /></Button>
            )}
            <Button onClick={newDeal} className="gap-1.5"><Plus className="h-4 w-4" />New deal</Button>
          </div>
        </div>
        {isLoading ? <Skeleton className="h-28" /> : <StatCards deals={viewDeals} />}
        <DealTable deals={viewDeals} loading={isLoading} />
      </section>

      {/* All deals by stage */}
      <DealsByStage deals={all} />

      {/* Groups */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Deal groups</h2>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={newGroup}><FolderPlus className="h-4 w-4" />New group</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups?.map((g) => <GroupCard key={g.id} name={g.name} color={g.color} deals={all.filter((d) => d.group_id === g.id)} active={current === g.id} onClick={() => setView(g.id)} />)}
          <GroupCard name="Ungrouped" color="var(--muted-foreground)" deals={all.filter((d) => !d.group_id)} active={current === "none"} onClick={() => setView("none")} />
        </div>
      </section>
    </div>
  );
}

function StatCards({ deals }: { deals: BrandDeal[] }) {
  const s = dealStats(deals);
  // Paid money moves out of Total value into Paid.
  const unpaid = Math.max(0, s.totalValue - s.paid);
  const cards: { label: string; value: string; sub?: string; rwf?: number }[] = [
    { label: "Total deals", value: String(s.count) },
    { label: "Total value", value: formatMoney(unpaid), rwf: unpaid * USD_TO_RWF },
    { label: "In progress", value: String(s.inProgress) },
    { label: "Paid", value: formatMoney(s.paid), sub: `${s.paidCount} deals` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="min-w-0 rounded-lg border bg-card p-5">
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className="mt-2 break-all font-display text-2xl font-medium tabular-nums">{c.value}</p>
          {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
          {c.rwf !== undefined && <p className="text-xs tabular-nums text-muted-foreground">≈ {formatMoney(c.rwf, "RWF")}</p>}
        </div>
      ))}
    </div>
  );
}

function DealTable({ deals, loading }: { deals: BrandDeal[]; loading: boolean }) {
  const [status, setStatus] = useState("all");
  const [profile, setProfile] = useState("all");
  const [q, setQ] = useState("");
  const { data: accounts } = useActiveAccounts();
  const { data: content } = useContent();
  const { data: groups } = useDealGroups();
  const { openDeal, openContent } = useUI();
  const update = useUpdateDeal();
  const reorder = useReorderDeals();
  const del = useDeleteDealOrGroup();
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return deals.filter((d) =>
      (status === "all" || d.status === status) &&
      (profile === "all" || d.account_id === profile) &&
      (!needle || `${d.brand} ${d.title} ${d.contact_name ?? ""}`.toLowerCase().includes(needle)));
  }, [deals, status, profile, q]);

  // Reordering is only offered on the full, unfiltered list, so positions are unambiguous.
  const canReorder = status === "all" && profile === "all" && !q.trim();
  const ids = rows.map((d) => d.id);
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (!canReorder || !e.over || e.over.id === e.active.id) return;
    reorder.mutate(moveBefore(ids, String(e.active.id), String(e.over.id)));
  };
  const dragged = rows.find((d) => d.id === dragId);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter by status" className="h-9 w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{DEAL_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={profile} onValueChange={setProfile}>
          <SelectTrigger aria-label="Filter by profile" className="h-9 w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All profiles</SelectItem>{accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
        </Select>
        <label className="col-span-2 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border bg-card px-3 text-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals…" className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
        </label>
      </div>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
      <div className="min-w-0 max-w-full overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="w-6" /><th className="px-4 py-3 font-medium">Brand</th><th className="px-4 py-3 font-medium">Deal</th>
              <th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Value</th>
              <th className="px-4 py-3 font-medium">Deadline</th><th className="px-4 py-3 font-medium">Linked video</th><th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="p-4"><Skeleton className="h-10" /></td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No deals here yet. Press N or “New deal” to add one.</td></tr>
            )}
            {rows.map((d) => {
              const acc = accounts?.find((a) => a.id === d.account_id);
              const video = content?.find((c) => c.id === d.content_item_id);
              const meta = statusMeta(d.status);
              return (
                <DealRow key={d.id} id={d.id} enabled={canReorder} onClick={() => openDeal(d.id)}>
                  <td className="w-6 pl-2" onClick={(e) => e.stopPropagation()}>{canReorder && <DragHandle id={d.id} label={d.brand} />}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background">{d.brand.charAt(0).toUpperCase()}</span>
                      <div className="min-w-0"><p className="truncate font-medium">{d.brand}</p>{acc && <p className="flex items-center gap-1 text-xs text-muted-foreground"><ProfileAvatar account={acc} className="h-3.5 w-3.5" />{acc.name}</p>}</div>
                    </div>
                  </td>
                  <td className="max-w-56 truncate px-4 py-3">{d.title}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Select value={d.status} onValueChange={(status) => update.mutate({ id: d.id, patch: { status } })}>
                      <SelectTrigger aria-label={`Status of ${d.brand}`} className={cn("h-7 w-auto gap-1 border-0 px-2 text-xs font-medium shadow-none", TONE_CLASS[meta.tone])}><SelectValue /></SelectTrigger>
                      <SelectContent>{DEAL_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">{formatMoney(Number(d.value), d.currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.deadline ? format(parseISO(d.deadline), "MMM d, yyyy") : "—"}</td>
                  <td className="px-4 py-3">
                    {video ? (
                      <button onClick={(e) => { e.stopPropagation(); openContent(video.id); }} className="flex max-w-44 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs hover:bg-muted/70">
                        <Film className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{video.title}</span>
                      </button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`More for ${d.brand}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openDeal(d.id)}>Edit</DropdownMenuItem>
                        {canReorder && ids[0] !== d.id && <DropdownMenuItem onSelect={() => reorder.mutate(moveToTop(ids, d.id))}>Move to top</DropdownMenuItem>}
                        {groups?.filter((g) => g.id !== d.group_id).map((g) => (
                          <DropdownMenuItem key={g.id} onSelect={() => update.mutate({ id: d.id, patch: { group_id: g.id } })}>Move to {g.name}</DropdownMenuItem>
                        ))}
                        {d.group_id && <DropdownMenuItem onSelect={() => update.mutate({ id: d.id, patch: { group_id: null } })}>Remove from group</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onSelect={() => del("deal", d, d.brand)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </DealRow>
              );
            })}
          </tbody>
        </table>
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged && <div className="pointer-events-none flex w-fit items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium shadow-lg">{dragged.brand}<span className="text-xs font-normal text-muted-foreground">{dragged.title}</span></div>}
      </DragOverlay>
      </DndContext>
    </div>
  );
}

/** A table row that other rows can be dropped onto; shows a line where the dragged deal will land. */
function DealRow({ id, enabled, onClick, children }: { id: string; enabled: boolean; onClick: () => void; children: React.ReactNode }) {
  const { setNodeRef, isOver, active } = useDroppable({ id, disabled: !enabled });
  const dragging = active?.id === id;
  return (
    <tr ref={setNodeRef} onClick={onClick}
      className={cn("cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40", dragging && "opacity-40", isOver && !dragging && "bg-primary/5 shadow-[inset_0_2px_0_0_var(--primary)]")}>
      {children}
    </tr>
  );
}

function DragHandle({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id });
  return (
    <button ref={setNodeRef} type="button" {...attributes} {...listeners} aria-label={`Drag to reorder ${label}`} title="Drag to reorder"
      className="flex h-7 w-5 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"><GripVertical className="h-3.5 w-3.5" /></button>
  );
}

/** Every stage in order, grouped by phase, with count, value and a bar for its share of deals. */
function DealsByStage({ deals }: { deals: BrandDeal[] }) {
  const breakdown = statusBreakdown(deals);
  const byId = new Map(breakdown.map((b) => [b.id, b]));
  const maxCount = Math.max(1, ...breakdown.map((b) => b.count));
  const totalValue = breakdown.reduce((n, b) => n + b.value, 0);

  return (
    <div className="min-w-0 rounded-lg border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Deals by stage</p>
        {deals.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {deals.length} deal{deals.length === 1 ? "" : "s"} · {formatMoney(totalValue)}
          </span>
        )}
      </div>
      {deals.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No deals yet.</p>
      ) : (
        <>
          {/* How all deals split across stages, left to right in pipeline order. */}
          <div className="mb-4 flex h-2 gap-px overflow-hidden rounded-full bg-muted" role="img" aria-label="Share of deals per stage">
            {breakdown.filter((b) => b.count).map((b) => (
              <span
                key={b.id}
                title={`${b.label}: ${b.count}`}
                className={cn("h-full transition-[width] duration-500", TONE_FILL[b.tone])}
                style={{ width: `${b.share * 100}%` }}
              />
            ))}
          </div>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {DEAL_PHASES.map((phase) => (
              <div key={phase.id}>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{phase.label}</p>
                <div className="space-y-1.5">
                  {phase.stages.map((id) => {
                    const b = byId.get(id);
                    if (!b) return null;
                    return (
                      <div key={id} className={cn("grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2.5 text-xs", !b.count && "opacity-50")}>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_FILL[b.tone])} />
                          <span className="truncate">{b.label}</span>
                        </span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <span className={cn("block h-full rounded-full transition-[width] duration-500", TONE_FILL[b.tone])} style={{ width: `${(b.count / maxCount) * 100}%` }} />
                        </span>
                        <span className="min-w-20 text-right tabular-nums">
                          <span className="font-medium">{b.count}</span>
                          <span className="text-muted-foreground"> · {b.count ? formatMoney(b.value, "USD", true) : "—"}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GroupCard({ name, color, deals, active, onClick }: { name: string; color: string; deals: BrandDeal[]; active: boolean; onClick: () => void }) {
  const s = dealStats(deals);
  const pct = s.totalValue ? Math.round((s.paid / s.totalValue) * 100) : 0;
  return (
    <button onClick={onClick} className={cn("group min-w-0 rounded-lg border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40", active && "border-primary ring-1 ring-primary/30")}>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="flex-1 truncate font-medium">{name}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">{formatMoney(s.totalValue)}</p>
      <p className="text-xs text-muted-foreground">{s.count} deals · {s.inProgress} in progress</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></div>
      <p className="mt-1 text-xs text-muted-foreground">{pct}% paid</p>
    </button>
  );
}
