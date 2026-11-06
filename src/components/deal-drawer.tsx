import { Trash2, Film } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AutoInput, Field } from "./bits";
import { ProfileAvatar } from "./profile-avatar";
import { useAccounts, useContent, useDeals, useDealGroups, useUpdateDeal, useDeleteDealOrGroup } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { DEAL_STATUSES, TONE_CLASS, statusMeta } from "@/lib/deals";
import { cn } from "@/lib/utils";
import { DealTaskList } from "./deal-tasks";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "SEK", "INR"];

export function DealDrawer() {
  const { openDealId, openDeal, openContent } = useUI();
  const { data: deals } = useDeals();
  const { data: groups } = useDealGroups();
  const { data: accounts } = useAccounts();
  const { data: content } = useContent();
  const update = useUpdateDeal();
  const del = useDeleteDealOrGroup();
  const deal = deals?.find((d) => d.id === openDealId);
  const save = (patch: Parameters<typeof update.mutate>[0]["patch"]) => deal && update.mutate({ id: deal.id, patch });
  const videos = content?.filter((c) => !deal?.account_id || c.account_id === deal.account_id || c.id === deal.content_item_id);
  const linked = content?.find((c) => c.id === deal?.content_item_id);

  return (
    <Sheet open={!!openDealId} onOpenChange={(o) => !o && openDeal(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetTitle className="sr-only">Brand deal</SheetTitle>
        {deal && (
          <div className="space-y-7 pb-10">
            <div className="pr-8">
              <span className={cn("mb-3 inline-block rounded-md px-2 py-0.5 text-xs font-medium", TONE_CLASS[statusMeta(deal.status).tone])}>{statusMeta(deal.status).label}</span>
              <AutoInput key={deal.id + "b"} value={deal.brand} className="-ml-2 text-xl font-semibold" onSave={(brand) => save({ brand: brand.trim() || "New brand" })} />
              <AutoInput key={deal.id + "t"} value={deal.title} className="-ml-2 text-sm text-muted-foreground" placeholder="What's the deal?" onSave={(title) => save({ title: title.trim() || "Untitled deal" })} />
            </div>
            <div className="space-y-1">
              <Field label="Status">
                <Select value={deal.status} onValueChange={(status) => save({ status })}>
                  <SelectTrigger aria-label="Deal status" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{DEAL_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Value">
                <div className="flex gap-2">
                  <AutoInput type="number" value={String(deal.value)} onSave={(v) => save({ value: Math.max(0, Number(v) || 0) })} />
                  <Select value={deal.currency} onValueChange={(currency) => save({ currency })}>
                    <SelectTrigger aria-label="Currency" className="h-9 w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </Field>
              <Field label="Group">
                <Select value={deal.group_id ?? "none"} onValueChange={(g) => save({ group_id: g === "none" ? null : g })}>
                  <SelectTrigger aria-label="Deal group" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No group</SelectItem>{groups?.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Profile">
                <Select value={deal.account_id ?? "none"} onValueChange={(id) => save({ account_id: id === "none" ? null : id })}>
                  <SelectTrigger aria-label="Deal profile" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No profile</SelectItem>
                    {accounts?.filter((a) => !a.archived_at || a.id === deal.account_id).map((a) => (
                      <SelectItem key={a.id} value={a.id}><span className="flex items-center gap-2"><ProfileAvatar account={a} className="h-5 w-5" />{a.name}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Deadline"><AutoInput type="date" value={deal.deadline} onSave={(v) => save({ deadline: v || null })} /></Field>
              <Field label="Invoice due"><AutoInput type="date" value={deal.invoice_due} onSave={(v) => save({ invoice_due: v || null })} /></Field>
              <Field label="Linked video">
                <div className="flex gap-2">
                  <Select value={deal.content_item_id ?? "none"} onValueChange={(id) => save({ content_item_id: id === "none" ? null : id })}>
                    <SelectTrigger aria-label="Linked video" className="h-9 min-w-0"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Not linked</SelectItem>{videos?.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                  </Select>
                  {linked && <Button variant="outline" size="icon" aria-label="Open linked video" onClick={() => { openDeal(null); openContent(linked.id); }}><Film /></Button>}
                </div>
              </Field>
            </div>
            <section className="space-y-2 border-t pt-5">
              <h3 className="text-sm font-medium">Tasks <span className="text-xs font-normal text-muted-foreground">· reminders show on your dashboard</span></h3>
              <DealTaskList dealId={deal.id} />
            </section>
            <section className="space-y-1 border-t pt-5">
              <h3 className="mb-2 text-sm font-medium">Contact</h3>
              <Field label="Name"><AutoInput value={deal.contact_name} placeholder="Who you talk to" onSave={(v) => save({ contact_name: v || null })} /></Field>
              <Field label="Email"><AutoInput type="email" value={deal.contact_email} placeholder="name@brand.com" onSave={(v) => save({ contact_email: v || null })} /></Field>
            </section>
            <section className="space-y-3 border-t pt-5">
              <div><h3 className="mb-2 text-sm font-medium">Deliverables</h3><AutoInput multiline value={deal.deliverables} placeholder="1 integrated video, 2 stories…" onSave={(v) => save({ deliverables: v || null })} /></div>
              <div><h3 className="mb-2 text-sm font-medium">Usage rights</h3><AutoInput value={deal.usage_rights} placeholder="e.g. 90 days paid social" onSave={(v) => save({ usage_rights: v || null })} /></div>
              <div><h3 className="mb-2 text-sm font-medium">Notes</h3><AutoInput multiline value={deal.notes} placeholder="Follow-ups, talking points…" onSave={(v) => save({ notes: v || null })} /></div>
            </section>
            <div className="border-t pt-5">
              <Button variant="ghost" className="gap-1.5 text-destructive" onClick={() => { openDeal(null); del("deal", deal, deal.brand); }}><Trash2 className="h-4 w-4" />Delete deal</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
