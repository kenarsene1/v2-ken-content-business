import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/deals";

/** Money value that eases to its new number. */
export function CountUp({ value, className, currency = 'USD', variant = 'money' }: { value: number; className?: string; currency?:string; variant?: 'money' | 'number' }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); from.current = value; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 600);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{variant === 'number' ? Math.round(shown).toLocaleString() : formatMoney(Math.round(shown),currency)}</span>;
}
