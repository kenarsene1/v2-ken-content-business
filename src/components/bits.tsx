import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getFieldHeight, saveFieldHeight } from "@/lib/field-size";
import { PLATFORMS } from "@/lib/constants";
import { getPlatform } from "@/lib/platforms";
import { Inbox } from "lucide-react";

export function PlatformDot({ platform, className }: { platform: string; className?: string }) {
  const id = getPlatform(platform).id;
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ backgroundColor: `var(--platform-${id})` }} />;
}

export function PlatformBadge({ platform }: { platform: string }) {
  const p = PLATFORMS.find((x) => x.id === platform);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <PlatformDot platform={platform} className="h-1.5 w-1.5" />
      {p?.short ?? platform}
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-14 text-center">
      <Inbox className="h-6 w-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Keeps a resizable text box at the height the user dragged it to, in this browser.
 * The size is remembered per kind of field (its label), so every "Notes" box opens the same way.
 */
function useRememberedHeight(key: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !key) return;
    const saved = getFieldHeight(key);
    if (saved) el.style.height = `${saved}px`;
    if (typeof ResizeObserver === "undefined") return;
    let last = el.offsetHeight;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watch = new ResizeObserver(() => {
      // Width changes (a panel opening, a window resize) are not the user dragging the box taller.
      if (el.offsetHeight === last) return;
      last = el.offsetHeight;
      clearTimeout(timer);
      timer = setTimeout(() => saveFieldHeight(key, last), 250);
    });
    watch.observe(el);
    return () => { clearTimeout(timer); watch.disconnect(); };
  }, [key]);
  return ref;
}

/** Text input that saves itself on blur and after typing pauses. No save buttons. */
export function AutoInput({
  value,
  onSave,
  className,
  multiline,
  placeholder,
  type = "text",
  "aria-label": ariaLabel,
}: {
  value: string | null | undefined;
  onSave: (v: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
  type?: string;
  "aria-label"?: string;
}) {
  const [v, setV] = useState(value ?? "");
  const last = useRef(value ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    setV(value ?? "");
    last.current = value ?? "";
  }, [value]);
  const commit = (next: string) => {
    clearTimeout(timer.current);
    if (next !== last.current) {
      last.current = next;
      onSave(next);
    }
  };
  const change = (next: string) => {
    setV(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), 700);
  };
  const box = useRememberedHeight(multiline ? ariaLabel || placeholder || "" : "");
  const base =
    "w-full min-w-0 rounded-md bg-transparent px-3 py-2 text-sm outline-none transition-colors hover:bg-muted/60 focus:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground";
  return multiline ? (
    <textarea
      ref={box}
      aria-label={ariaLabel}
      className={cn(base, "min-h-24 resize-y", className)}
      value={v}
      placeholder={placeholder}
      onChange={(e) => change(e.target.value)}
      onBlur={() => commit(v)}
    />
  ) : (
    <input
      aria-label={ariaLabel}
      type={type}
      className={cn(base, className)}
      value={v}
      placeholder={placeholder}
      onChange={(e) => change(e.target.value)}
      onBlur={() => commit(v)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(80px,110px)_minmax(0,1fr)] items-center gap-2 py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{children}</kbd>;
}
