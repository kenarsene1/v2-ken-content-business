/** Library and resource helpers. Pure functions — safe to unit test. */

export const LIBRARY_KINDS = [
  { id: "note", label: "Note" },
  { id: "doc", label: "Doc" },
  { id: "image", label: "Image" },
  { id: "link", label: "Link" },
] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number]["id"];

/** Files the Library accepts: images plus common documents. */
export const DOC_ACCEPT = ".pdf,.doc,.docx,.txt,.md,.rtf,.csv,.xls,.xlsx,.ppt,.pptx,.key,.pages,.numbers";
export const UPLOAD_ACCEPT = `image/*,${DOC_ACCEPT}`;

export const kindForFile = (file: { type: string }): LibraryKind => (file.type.startsWith("image/") ? "image" : "doc");

/** Keeps a readable, storage-safe file name ("My Thumb (1).PNG" -> "My-Thumb-1.png"). */
export function safeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .slice(0, 60) || "file";
  return ext ? `${base}.${ext}` : base;
}

/** File name without its extension, as a default title. */
export const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, "").trim().slice(0, 200) || "Untitled";

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** "https://www.youtube.com/watch?v=1" -> "youtube.com" */
export function hostOf(url: string | null | undefined) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Turns "example.com/x" into a safe https link, or null if it isn't one. */
export function toHttpUrl(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

type Sortable = { pinned: boolean; updated_at: string };
/** Pinned first, then most recently changed. */
export const sortLibrary = <T extends Sortable>(rows: readonly T[]) =>
  [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));

/* ---------- Video resources: library items or plain links, stored on content_items.resources ---------- */

export type Resource =
  | { id: string; kind: "library"; library_item_id: string; label: string }
  | { id: string; kind: "link"; url: string; label: string };

export function parseResources(value: unknown): Resource[] {
  if (!Array.isArray(value)) return [];
  const out: Resource[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const r = v as { id?: unknown; kind?: unknown; library_item_id?: unknown; url?: unknown; label?: unknown };
    if (typeof r.id !== "string") continue;
    const label = typeof r.label === "string" ? r.label.slice(0, 120) : "";
    if (r.kind === "library" && typeof r.library_item_id === "string") out.push({ id: r.id, kind: "library", library_item_id: r.library_item_id, label });
    else if (r.kind === "link") {
      const url = toHttpUrl(typeof r.url === "string" ? r.url : "");
      if (url) out.push({ id: r.id, kind: "link", url, label: label || hostOf(url) });
    }
  }
  return out;
}

const resourceId = () => `r-${crypto.randomUUID().slice(0, 8)}`;

export function addLinkResource(list: readonly Resource[], raw: string): Resource[] | null {
  const url = toHttpUrl(raw);
  if (!url) return null;
  if (list.some((r) => r.kind === "link" && r.url === url)) return [...list];
  return [...list, { id: resourceId(), kind: "link", url, label: hostOf(url) }];
}

export function addLibraryResource(list: readonly Resource[], item: { id: string; title: string }): Resource[] {
  if (list.some((r) => r.kind === "library" && r.library_item_id === item.id)) return [...list];
  return [...list, { id: resourceId(), kind: "library", library_item_id: item.id, label: item.title }];
}

export const removeResource = (list: readonly Resource[], id: string) => list.filter((r) => r.id !== id);
