import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { toHttpUrl } from "@/lib/library";
import { cn } from "@/lib/utils";
import { AutoInput } from "./bits";

/**
 * Tiny "ref" chip that opens a reference post in a new tab. Renders nothing without a link.
 * Stops the click and pointer-down so it works inside clickable or draggable cards.
 */
export function RefLink({ url, className }: { url: string | null | undefined; className?: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Reference: ${url}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "relative z-10 inline-flex shrink-0 items-center rounded-[4px] bg-primary/10 px-1 align-middle text-[9px] font-semibold uppercase leading-[14px] tracking-wide text-primary hover:bg-primary/20",
        className,
      )}
    >
      ref
    </a>
  );
}

/** Autosaving link field with an open button. Invalid links are rejected and the saved value comes back. */
export function LinkField({ value, onSave, placeholder, label }: {
  value: string | null;
  onSave: (url: string | null) => void;
  placeholder: string;
  label: string;
}) {
  const [resetKey, setResetKey] = useState(0);
  return (
    <div className="flex min-w-0 items-center">
      <AutoInput
        key={resetKey}
        aria-label={label}
        value={value ?? ""}
        placeholder={placeholder}
        onSave={(raw) => {
          if (!raw.trim()) return onSave(null);
          const url = toHttpUrl(raw);
          if (url) onSave(url);
          else {
            toast.error("Enter a valid link");
            setResetKey((k) => k + 1);
          }
        }}
      />
      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label.toLowerCase()}`} className="p-1.5 text-muted-foreground hover:text-foreground">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
