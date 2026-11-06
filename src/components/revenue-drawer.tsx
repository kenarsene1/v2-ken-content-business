import { Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AutoInput, Field } from "./bits";
import { useActiveAccounts, useDeleteRevenue, useRevenue, useUpdateRevenue } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { sourceMeta, sourcesFor } from "@/lib/revenue";
import { cn } from "@/lib/utils";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "SEK", "INR"];

/** Right-side editor for one income/expense entry. Autosaves. */
export function RevenueDrawer() {
  const { openRevenueId, openRevenue } = useUI();
  const { data } = useRevenue();
  const { data: accounts } = useActiveAccounts();
  const update = useUpdateRevenue();
  const del = useDeleteRevenue();
  const row = data?.find((r) => r.id === openRevenueId);
  const save = (patch: Parameters<typeof update.mutate>[0]["patch"]) => row && update.mutate({ id: row.id, patch });

  return (
    <Sheet open={!!openRevenueId} onOpenChange={(o) => !o && openRevenue(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetTitle className="sr-only">Money entry</SheetTitle>
        {row && (
          <div className="space-y-5 pt-4">
            <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
              {(["income", "expense"] as const).map((k) => (
                <button key={k} onClick={() => row.kind !== k && save({ kind: k, source: "other" })}
                  className={cn("rounded-md px-3 py-1 capitalize transition-all", row.kind === k ? "bg-background shadow-sm" : "text-muted-foreground")}>{k}</button>
              ))}
            </div>
            <AutoInput value={row.title} onSave={(title) => save({ title: title || "Untitled" })} className="text-lg font-semibold" placeholder="What was it?" />
            <div className="flex items-baseline gap-2 px-2">
              <span className={cn("text-3xl font-semibold", row.kind === "expense" ? "text-destructive" : "text-success")}>{row.kind === "expense" ? "−" : "+"}</span>
              <AutoInput type="number" value={String(row.amount)} onSave={(v) => save({ amount: Math.max(0, Number(v) || 0) })} className="text-3xl font-semibold tabular-nums" />
            </div>
            <div className="space-y-1">
              <Field label="Source">
                <Select value={sourceMeta(row.kind, row.source).id} onValueChange={(source) => save({ source })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{sourcesFor(row.kind).map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Date"><AutoInput type="date" value={row.entry_date} onSave={(v) => v && save({ entry_date: v })} /></Field>
              <Field label="Profile">
                <Select value={row.account_id ?? "none"} onValueChange={(v) => save({ account_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No profile</SelectItem>{accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Currency">
                <Select value={row.currency} onValueChange={(currency) => save({ currency })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <AutoInput multiline value={row.note} onSave={(note) => save({ note })} placeholder="Notes…" />
            <Button variant="ghost" className="text-destructive" onClick={() => { del(row, row.title); openRevenue(null); }}>
              <Trash2 /> Delete entry
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
