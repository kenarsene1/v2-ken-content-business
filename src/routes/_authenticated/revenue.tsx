import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Handshake, Infinity as InfinityIcon, Minus, Plus } from "lucide-react";
import { useActiveAccounts, useCreateRevenue, useScopedMoney } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { bySource, change, inMonth, shiftMonth, sourceMeta, totals, type Kind, type MoneyEntry } from "@/lib/revenue";
import { formatMoney } from "@/lib/deals";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PerformanceChart } from "@/components/performance-chart";
import { markDraft } from "@/lib/drafts";
import { CountUp } from "@/components/count-up";
import { ProfileAvatar } from "@/components/profile-avatar";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const Route = createFileRoute("/_authenticated/revenue")({
  head: () => ({
    meta: [
      { title: "Revenue · My content B/S CRM" },
      { name: "description", content: "Income, expenses and profit for your creator business, month by month." },
      { property: "og:title", content: "Revenue · My content B/S CRM" },
      { property: "og:description", content: "Income, expenses and profit for your creator business, month by month." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RevenuePage,
});

type CardId = "income" | "expenses" | "profit" | "all";

function RevenuePage() {
  const { data, isLoading } = useScopedMoney();
  const { accountId, openRevenue } = useUI();
  const create = useCreateRevenue();
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [card, setCard] = useState<CardId>("profit");
  const [currency, setCurrency] = useState('USD');
  const currencies = Array.from(new Set(['USD', ...(data ?? []).map(e => e.currency ?? 'USD')])).sort();
  const all = useMemo(() => (data ?? []).filter(e => (e.currency ?? 'USD') === currency), [data, currency]);
  const cur = inMonth(all, month);
  const t = totals(cur);
  const prev = totals(inMonth(all, shiftMonth(month, -1)));
  const life = totals(all);

  const add = async (kind: Kind) => {
    const today = format(new Date(), "yyyy-MM");
    const entry_date = month === today ? format(new Date(), "yyyy-MM-dd") : `${month}-01`;
    const row = await create.mutateAsync({ kind, currency, account_id: accountId, entry_date, title: kind === "income" ? "New income" : "New expense" });
    markDraft("revenue_entries", row.id);
    openRevenue(row.id);
  };

  const cards: { id: CardId; label: string; value: number; delta: number | null; sub: string; good?: boolean }[] = [
    { id: "income", label: "Income", value: t.income, delta: change(t.income, prev.income), sub: "vs last month", good: true },
    { id: "expenses", label: "Expenses", value: t.expenses, delta: change(t.expenses, prev.expenses), sub: "vs last month", good: false },
    { id: "profit", label: "Profit", value: t.profit, delta: change(t.profit, prev.profit), sub: t.margin === null ? "No income yet" : `${t.margin}% margin`, good: true },
    { id: "all", label: "All time", value: life.profit, delta: null, sub: `${formatMoney(life.income, currency, true)} in · ${formatMoney(life.expenses, currency, true)} out` },
  ];

  return (
    <div className="calendar-enter mx-auto max-w-6xl space-y-8 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Your creator business</p>
          <h1 className="text-3xl font-semibold tracking-tight">Money</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={currency} onValueChange={setCurrency}><SelectTrigger aria-label="Money currency" className="w-24"><SelectValue/></SelectTrigger><SelectContent>{currencies.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <div className="flex items-center rounded-full border bg-card p-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></Button>
            <span className="w-28 text-center text-sm font-medium tabular-nums">{format(parseISO(`${month}-01`), "MMMM yyyy")}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></Button>
          </div>
          <Button variant="outline" onClick={() => add("expense")}><Minus /> Expense</Button>
          <Button onClick={() => add("income")}><Plus /> Income</Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c, i) => (
          <Button variant="ghost" key={c.id} onClick={() => setCard(c.id)} style={{ animationDelay: `${i * 60}ms` }}
            className={cn("calendar-enter group block h-auto min-w-0 whitespace-normal rounded-2xl border bg-card p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:bg-card hover:border-primary/40",
              card === c.id && "border-primary/60 ring-4 ring-primary/10")}>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {c.id === "all" && <InfinityIcon className="h-3.5 w-3.5" />}{c.label}
            </p>
            {isLoading ? <Skeleton className="mt-3 h-8 w-24" /> : <CountUp value={c.value} currency={currency} className="mt-2 block text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl" />}
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {c.delta !== null && <Delta n={c.delta} good={c.good ? c.delta >= 0 : c.delta <= 0} />}{c.sub}
            </p>
          </Button>
        ))}
      </div>

      <CardDetails card={card} entries={card === "all" ? all : cur} currency={currency} label={card === "all" ? "All time" : format(parseISO(`${month}-01`), "MMMM")} />

      <PerformanceChart entries={all} end={month} currency={currency} loading={isLoading} onPickMonth={setMonth} />

      <EntryList entries={cur} loading={isLoading} month={month} />
    </div>
  );
}

function Delta({ n, good }: { n: number; good: boolean }) {
  const Icon = n >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={cn("inline-flex items-center font-medium", good ? "text-success" : "text-destructive")}><Icon className="h-3 w-3" />{Math.abs(n)}%</span>;
}

/** Details for the selected card: where the money comes from / goes. */
function CardDetails({ card, entries, label, currency }: { card: CardId; entries: MoneyEntry[]; label: string; currency:string }) {
  const kinds: Kind[] = card === "income" ? ["income"] : card === "expenses" ? ["expense"] : ["income", "expense"];
  const top = [...entries].sort((a, b) => b.amount - a.amount).filter((e) => card === "income" ? e.kind === "income" : card === "expenses" ? e.kind === "expense" : true).slice(0, 4);
  return (
    <section key={card + label} className="calendar-enter grid gap-3 lg:grid-cols-3">
      {kinds.map((k) => {
        const rows = bySource(entries, k);
        return (
          <div key={k} className="rounded-2xl border bg-card p-5">
            <h3 className="mb-4 text-sm font-medium">{k === "income" ? "Where it came from" : "Where it went"} <span className="text-muted-foreground">· {label}</span></h3>
            {rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing yet.</p> : (
              <div className="space-y-3">
                {rows.map((s, i) => (
                  <div key={s.id}>
                    <div className="mb-1 flex justify-between text-sm"><span>{s.label}</span><span className="tabular-nums">{formatMoney(s.value,currency)} <span className="text-muted-foreground">· {s.share}%</span></span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="momentum-bar h-full rounded-full" style={{ width: `${s.share}%`, background: s.color, animationDelay: `${i * 70}ms` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className={cn("rounded-2xl border bg-card p-5", kinds.length === 1 && "lg:col-span-2")}>
        <h3 className="mb-3 text-sm font-medium">Biggest entries <span className="text-muted-foreground">· {label}</span></h3>
        {top.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing yet.</p> : top.map((e) => <EntryRow key={e.id} e={e} compact />)}
      </div>
    </section>
  );
}

function EntryRow({ e, compact }: { e: MoneyEntry; compact?: boolean }) {
  const openRevenue = useUI((s) => s.openRevenue);
  const { data: accounts } = useActiveAccounts();
  const acc = accounts?.find((a) => a.id === e.account_id);
  const meta = sourceMeta(e.kind, e.source);
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-background" style={{ background: meta.color }}>
        {e.fromDeal ? <Handshake className="h-4 w-4" /> : e.title.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{e.title}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          {meta.label}{!compact && <> · {format(parseISO(e.entry_date), "MMM d")}</>}
          {acc && !compact && <> · <ProfileAvatar account={acc} className="h-3.5 w-3.5" />{acc.name}</>}
        </p>
      </div>
      <span className={cn("text-sm font-semibold tabular-nums", e.kind === "expense" ? "text-destructive" : "text-success")}>
        {e.kind === "expense" ? "−" : "+"}{formatMoney(e.amount,e.currency ?? 'USD')}
      </span>
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted/60";
  return e.fromDeal
    ? <Link to="/deals" className={cls} title="Paid brand deal — edit it on Brand deals">{inner}</Link>
    : <button className={cls} onClick={() => openRevenue(e.id)}>{inner}</button>;
}

function EntryList({ entries, loading, month }: { entries: MoneyEntry[]; loading: boolean; month: string }) {
  const [tab, setTab] = useState<"all" | "income" | "expense">("all");
  const rows = entries.filter((e) => tab === "all" || e.kind === tab).sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{format(parseISO(`${month}-01`), "MMMM")} entries</h2>
        <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
          {(["all", "income", "expense"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)} className={cn("rounded-md px-3 py-1 capitalize transition-all", tab === k ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {k === "expense" ? "Expenses" : k}
            </button>
          ))}
        </div>
      </div>
      {loading ? <Skeleton className="h-24" /> : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">Nothing this month. Press N or “Income” to add one.</p>
      ) : <div className="divide-y">{rows.map((e) => <EntryRow key={e.id} e={e} />)}</div>}
    </section>
  );
}
