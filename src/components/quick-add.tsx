import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** One-line "type a name and press Enter" box. Escape closes it. */
export function QuickAdd({ placeholder, onSubmit, onCancel }: { placeholder: string; onSubmit: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(value); }} className="flex items-center gap-1.5">
      <Input
        autoFocus
        aria-label={placeholder}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        className="h-8 max-w-md text-xs"
      />
      <Button type="submit" size="sm" className="h-8 text-xs" disabled={!value.trim()}>Add</Button>
    </form>
  );
}
