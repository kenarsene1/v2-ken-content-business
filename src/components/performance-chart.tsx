import { useId, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { monthlySeries, type MoneyEntry } from "@/lib/revenue";
import { formatMoney } from "@/lib/deals";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

const config = {
  income: { label: "Revenue", color: "var(--primary)" },
  expenses: { label: "Expenses", color: "var(--warning)" },
} satisfies ChartConfig;

const MONTHS = 12;

/** Revenue (solid, softly filled) and expenses (dashed) for the 12 months ending at `end`. */
export function PerformanceChart({ entries, end, currency, loading, onPickMonth }: {
  entries: MoneyEntry[]; end: string; currency: string; loading?: boolean; onPickMonth?: (month: string) => void;
}) {
  const data = useMemo(() => monthlySeries(entries, end, MONTHS), [entries, end]);
  const fill = `perf-fill-${useId().replace(/:/g, "")}`;
  const money = (v: number) => formatMoney(v, currency, true);

  return (
    <section aria-label="Performance" className="rounded-3xl border bg-card p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">Performance</h2>
          <p className="mt-1 text-muted-foreground">Last 12 months</p>
        </div>
        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: config.income.color }} />Revenue</span>
          <span className="flex items-center gap-2"><span className="h-0.5 w-3.5 rounded-full" style={{ background: config.expenses.color }} />Expenses</span>
        </div>
      </div>
      {loading ? <Skeleton aria-label="Loading performance" className="h-72 motion-reduce:animate-none" /> : (
        <ChartContainer config={config} className="aspect-auto h-72 w-full">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            onClick={(state) => { const m = state?.activeLabel; if (onPickMonth && typeof m === "string") onPickMonth(m); }}>
            <defs>
              <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-income)" stopOpacity={0.14} />
                <stop offset="100%" stopColor="var(--color-income)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.7} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} minTickGap={4} tickFormatter={(m: string) => format(parseISO(`${m}-01`), "MMM")} />
            <YAxis tickLine={false} axisLine={false} width={56} tickCount={5} allowDecimals={false} tickFormatter={money} />
            <ChartTooltip cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={<ChartTooltipContent indicator="line" labelFormatter={(m) => format(parseISO(`${m}-01`), "MMMM yyyy")}
                formatter={(value, name) => (
                  <span className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">{config[name as keyof typeof config]?.label ?? name}</span>
                    <span className="font-medium tabular-nums">{formatMoney(Number(value), currency)}</span>
                  </span>
                )} />} />
            <Area dataKey="income" type="monotone" stroke="var(--color-income)" strokeWidth={2.5} fill={`url(#${fill})`}
              dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={900} animationEasing="ease-out" />
            <Line dataKey="expenses" type="monotone" stroke="var(--color-expenses)" strokeWidth={2} strokeDasharray="4 4"
              dot={false} activeDot={{ r: 3.5, strokeWidth: 0 }} animationDuration={900} animationEasing="ease-out" />
          </ComposedChart>
        </ChartContainer>
      )}
    </section>
  );
}
