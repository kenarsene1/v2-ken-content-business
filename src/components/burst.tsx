import type { CSSProperties } from "react";

const BURST_COLORS = ["var(--success)", "var(--primary)", "var(--warning)", "var(--chart-5)"];

/** A one-shot confetti burst from the centre of the nearest positioned parent. Remount (new key) to replay. */
export function Burst({ count = 16, spread = 36 }: { count?: number; spread?: number }) {
  const step = 360 / count;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="burst-dot"
          style={{
            "--angle": `${i * step}deg`,
            "--distance": `${spread + (i % 3) * Math.round(spread / 2.5)}px`,
            "--delay": `${(i % 4) * 35}ms`,
            backgroundColor: BURST_COLORS[i % BURST_COLORS.length],
          } as CSSProperties}
        />
      ))}
    </span>
  );
}
