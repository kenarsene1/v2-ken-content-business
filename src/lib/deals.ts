/** Brand deal stages, analytics and helpers. Pure functions — safe to unit test. */
export const DEAL_STATUSES = [
  { id: "lead", label: "Lead", tone: "muted" },
  { id: "contacted", label: "Contacted", tone: "muted" },
  { id: "negotiating", label: "Negotiating", tone: "warn" },
  { id: "contract_sent", label: "Contract sent", tone: "warn" },
  { id: "active", label: "In progress", tone: "primary" },
  { id: "delivered", label: "Delivered", tone: "primary" },
  { id: "paid", label: "Paid", tone: "success" },
  { id: "lost", label: "Lost", tone: "danger" },
] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number]["id"];

export const statusMeta = (id: string) => DEAL_STATUSES.find((s) => s.id === id) ?? DEAL_STATUSES[0];

export const TONE_CLASS: Record<string, string> = {
  muted: "bg-muted text-muted-foreground",
  warn: "bg-chart-3/15 text-chart-3",
  primary: "bg-primary/10 text-primary",
  success: "bg-success-soft text-success",
  danger: "bg-destructive/10 text-destructive",
};

const IN_PROGRESS = new Set(["negotiating", "contract_sent", "active", "delivered"]);
const CONFIRMED = new Set(["active", "delivered", "paid"]);

export interface DealLike {
  status: string;
  value: number;
  deadline: string | null;
  group_id: string | null;
}

export function dealStats<T extends DealLike>(deals: T[]) {
  const open = deals.filter((d) => d.status !== "lost");
  const sum = (xs: T[]) => xs.reduce((n, d) => n + Number(d.value || 0), 0);
  const closed = deals.filter((d) => d.status === "paid" || d.status === "lost");
  const won = deals.filter((d) => d.status === "paid").length;
  return {
    count: deals.length,
    totalValue: sum(open),
    inProgress: deals.filter((d) => IN_PROGRESS.has(d.status)).length,
    paidCount: won,
    paid: sum(deals.filter((d) => d.status === "paid")),
    confirmed: sum(deals.filter((d) => CONFIRMED.has(d.status))),
    outstanding: sum(deals.filter((d) => d.status === "active" || d.status === "delivered")),
    pipeline: sum(deals.filter((d) => !CONFIRMED.has(d.status) && d.status !== "lost")),
    winRate: closed.length ? Math.round((won / closed.length) * 100) : null,
  };
}

/** Solid fill per tone, for bars and dots (TONE_CLASS is the soft chip style). */
export const TONE_FILL: Record<string, string> = {
  muted: "bg-muted-foreground/45",
  warn: "bg-chart-3",
  primary: "bg-primary",
  success: "bg-success",
  danger: "bg-destructive/70",
};

/** Stages grouped the way a deal moves: finding, closing, doing the work, then the outcome. */
export const DEAL_PHASES = [
  { id: "finding", label: "Finding", stages: ["lead", "contacted"] },
  { id: "closing", label: "Closing", stages: ["negotiating", "contract_sent"] },
  { id: "working", label: "Working", stages: ["active", "delivered"] },
  { id: "done", label: "Done", stages: ["paid", "lost"] },
] as const;

/**
 * Count and value for every stage, in pipeline order (empty stages included so the flow reads clearly).
 * `share` is the stage's part of all deals (0-1).
 */
export function statusBreakdown<T extends DealLike>(deals: T[]) {
  const total = deals.length;
  return DEAL_STATUSES.map((s) => {
    const xs = deals.filter((d) => d.status === s.id);
    return { ...s, count: xs.length, value: xs.reduce((n, d) => n + Number(d.value || 0), 0), share: total ? xs.length / total : 0 };
  });
}

export function formatMoney(n: number, currency = "USD", compact = false) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0, notation: compact ? "compact" : "standard" }).format(n);
  } catch {
    return `${Math.round(n)} ${currency}`;
  }
}

type Linkable = { id: string; account_id: string | null; content_item_id: string | null };

/** Deals that can be linked to a video: same profile (or no profile on either side), plus any already linked to it. */
export function linkableDeals<T extends Linkable>(deals: T[], video: { id: string; account_id: string | null }) {
  return deals.filter((d) => d.content_item_id === video.id || !d.account_id || !video.account_id || d.account_id === video.account_id);
}

/**
 * Changes needed so `dealId` is the one deal linked to `videoId` (null = none).
 * Unlinks any other deal currently pointing at the video; skips deals that are already right.
 */
export function dealLinkChanges<T extends Linkable>(deals: T[], videoId: string, dealId: string | null) {
  const changes: { id: string; content_item_id: string | null }[] = deals
    .filter((d) => d.content_item_id === videoId && d.id !== dealId)
    .map((d) => ({ id: d.id, content_item_id: null }));
  const chosen = dealId ? deals.find((d) => d.id === dealId) : undefined;
  if (chosen && chosen.content_item_id !== videoId) changes.push({ id: chosen.id, content_item_id: videoId });
  return changes;
}

/**
 * Sponsor brand per video id, from deals linked to a video (brand_deals.content_item_id).
 * Lost deals don't count. When several deals point at one video, the first brand wins.
 */
export function sponsorsByVideo(deals: readonly (Linkable & { brand: string; status: string })[]) {
  const map = new Map<string, string>();
  for (const d of deals) {
    if (d.content_item_id && d.status !== "lost" && !map.has(d.content_item_id)) map.set(d.content_item_id, d.brand.trim() || "a brand");
  }
  return map;
}
