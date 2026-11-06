/** Helpers for the extra profile details: similar creators and other social platforms. Pure, so easy to test. */
import { toHttpUrl } from "./library";
import { getPlatform } from "./platforms";

export const MAX_LIST = 20;

export type SimilarCreator = { id: string; url: string; label: string };
export type OtherSocial = { id: string; platform: string; handle: string };

const newId = () => `p-${crypto.randomUUID().slice(0, 8)}`;
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Readable name for a link: "youtube.com/@mkbhd". Empty if it is not a link. */
export function linkLabel(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname.replace(/^www\./, "")}${path}`.slice(0, 60);
  } catch {
    return "";
  }
}

export function parseSimilarCreators(value: unknown): SimilarCreator[] {
  if (!Array.isArray(value)) return [];
  const out: SimilarCreator[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const r = v as { id?: unknown; url?: unknown; label?: unknown };
    const url = toHttpUrl(typeof r.url === "string" ? r.url : "");
    if (typeof r.id !== "string" || !url) continue;
    out.push({ id: r.id, url, label: clip(r.label, 80) || linkLabel(url) });
  }
  return out.slice(0, MAX_LIST);
}

/** Adds a link, or returns null if it is not a valid link or the list is full. A repeated link is ignored. */
export function addSimilarCreator(list: readonly SimilarCreator[], raw: string): SimilarCreator[] | null {
  const url = toHttpUrl(raw);
  if (!url || list.length >= MAX_LIST) return null;
  if (list.some((c) => c.url === url)) return [...list];
  return [...list, { id: newId(), url, label: linkLabel(url) }];
}

export const removeById = <T extends { id: string }>(list: readonly T[], id: string) => list.filter((x) => x.id !== id);

export function parseOtherSocials(value: unknown): OtherSocial[] {
  if (!Array.isArray(value)) return [];
  const out: OtherSocial[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const r = v as { id?: unknown; platform?: unknown; handle?: unknown };
    if (typeof r.id !== "string") continue;
    out.push({ id: r.id, platform: clip(r.platform, 40) || "other", handle: clip(r.handle, 200) });
  }
  return out.slice(0, MAX_LIST);
}

export function addOtherSocial(list: readonly OtherSocial[], platform: string): OtherSocial[] | null {
  if (list.length >= MAX_LIST) return null;
  return [...list, { id: newId(), platform: platform || "other", handle: "" }];
}

export const updateOtherSocial = (list: readonly OtherSocial[], id: string, patch: Partial<Omit<OtherSocial, "id">>) =>
  list.map((s) => (s.id === id ? { ...s, ...patch, handle: patch.handle !== undefined ? patch.handle.trim().slice(0, 200) : s.handle } : s));

/** Link for a social entry: a pasted link as is, or a handle turned into that platform's profile link. */
export function socialHref(platform: string, handle: string): string | null {
  const text = handle.trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text) || /^[\w-]+(\.[\w-]+)+\//.test(text)) return toHttpUrl(text);
  const bare = text.replace(/^@/, "");
  const build = getPlatform(platform).profileUrl;
  return build && /^[\w.-]+$/.test(bare) ? build(bare) : null;
}
