import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Small inline field: saves on Enter or blur, cancels on Escape.
 * Saving an unchanged value is skipped, so a stray click never writes to the database.
 */
export function InlineEdit({ value, onSave, onDone, label, type = "text", className, placeholder }: {
  value: string;
  onSave: (value: string) => void;
  onDone: () => void;
  label: string;
  type?: "text" | "number";
  className?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const settled = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (save: boolean) => {
    if (settled.current) return;
    settled.current = true;
    if (save && draft.trim() !== value.trim()) onSave(draft);
    onDone();
  };
  return (
    <input
      ref={ref}
      aria-label={label}
      type={type}
      inputMode={type === "number" ? "numeric" : undefined}
      min={type === "number" ? 1 : undefined}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      }}
      onBlur={() => finish(true)}
      className={cn(
        "min-w-0 rounded-[4px] border border-primary/40 bg-background px-1 outline-none ring-2 ring-primary/15",
        type === "number" && "w-12 tabular-nums",
        className,
      )}
    />
  );
}
