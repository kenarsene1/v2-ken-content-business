import { cn } from "@/lib/utils";

const BLOCKS = 10;

/** Small circle with the percentage inside. */
export function GoalRing({ fraction, size = 40, className }: { fraction: number; size?: number; className?: string }) {
  const stroke = size >= 52 ? 4 : 3.5;
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const done = fraction >= 1;
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - fraction)}
          className={cn("momentum-ring", done ? "stroke-success" : "stroke-primary")}
        />
      </svg>
      <span className={cn("absolute font-medium tabular-nums", size >= 52 ? "text-xs" : "text-[10px]")}>{Math.round(fraction * 100)}%</span>
    </span>
  );
}

/** Thin bar or row of blocks. */
export function GoalBar({ fraction, display }: { fraction: number; display: string }) {
  const done = fraction >= 1;
  const fill = done ? "bg-success" : "bg-primary";
  if (display === "blocks") {
    const filled = Math.round(fraction * BLOCKS);
    return (
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: BLOCKS }, (_, i) => (
          <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
            {i < filled && <span className={cn("segment-fill block h-full w-full", fill)} style={{ animationDelay: `${i * 40}ms` }} />}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className={cn("momentum-bar block h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${fraction * 100}%` }} />
    </span>
  );
}
