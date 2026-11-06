import { FileText, Image as ImageIcon, Link2, StickyNote } from "lucide-react";
import { useState } from "react";
import { useFileUrl, type LibraryItem } from "@/lib/queries";
import type { LibraryKind } from "@/lib/library";
import { cn } from "@/lib/utils";

const ICONS = { note: StickyNote, doc: FileText, image: ImageIcon, link: Link2 } as const;
const TONES = { note: "text-chart-4", doc: "text-primary", image: "text-chart-2", link: "text-chart-5" } as const;

export function LibraryKindIcon({ kind, className }: { kind: string; className?: string | undefined }) {
  const k = (kind in ICONS ? kind : "note") as LibraryKind;
  const Icon = ICONS[k];
  return <Icon aria-hidden className={cn("h-3.5 w-3.5 shrink-0", TONES[k], className)} />;
}

/** Image preview from the private bucket (signed link cached for 45 min). */
export function LibraryImage({ path, alt, className }: { path: string | null; alt: string; className?: string }) {
  const { data: url } = useFileUrl(path);
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <span className={cn("block animate-pulse bg-muted", className)} aria-hidden />;
  return <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={cn("object-cover", className)} />;
}

/** Site icon for a link (falls back to the link icon). */
export function LinkFavicon({ url, className }: { url: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  let host = "";
  try { host = url ? new URL(url).hostname : ""; } catch { /* not a link */ }
  if (!host || failed) return <LibraryKindIcon kind="link" className={className} />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("h-3.5 w-3.5 shrink-0 rounded-sm", className)}
    />
  );
}

export function LibraryItemIcon({ item }: { item: Pick<LibraryItem, "kind" | "url"> }) {
  return item.kind === "link" ? <LinkFavicon url={item.url} /> : <LibraryKindIcon kind={item.kind} />;
}
