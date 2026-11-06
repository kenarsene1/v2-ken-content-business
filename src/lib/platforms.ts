/**
 * Platform registry — the single source of truth for every social platform.
 *
 * To add a platform: add one entry to PLATFORMS and one `--platform-<id>` color
 * in src/styles.css. Everything else (grouping, pickers, link detection) reads
 * from here automatically.
 */
export interface PlatformDef {
  id: string;
  label: string;
  short: string;
  /** Hostnames that identify this platform when the user pastes a link. */
  hosts: string[];
  /** Builds a profile URL from a bare handle (without @). */
  profileUrl?: (handle: string) => string;
  /** Word used for the audience number on this platform. */
  audienceLabel: string;
}

export const PLATFORMS = [
  { id: "youtube", label: "YouTube", short: "YT", hosts: ["youtube.com", "youtu.be"], profileUrl: (h: string) => `https://youtube.com/@${h}`, audienceLabel: "subscribers" },
  { id: "instagram", label: "Instagram", short: "IG", hosts: ["instagram.com", "instagr.am"], profileUrl: (h: string) => `https://instagram.com/${h}`, audienceLabel: "followers" },
  { id: "tiktok", label: "TikTok", short: "TT", hosts: ["tiktok.com"], profileUrl: (h: string) => `https://tiktok.com/@${h}`, audienceLabel: "followers" },
  { id: "threads", label: "Threads", short: "TH", hosts: ["threads.net", "threads.com"], profileUrl: (h: string) => `https://threads.net/@${h}`, audienceLabel: "followers" },
  { id: "x", label: "X", short: "X", hosts: ["x.com", "twitter.com"], profileUrl: (h: string) => `https://x.com/${h}`, audienceLabel: "followers" },
  { id: "linkedin", label: "LinkedIn", short: "IN", hosts: ["linkedin.com"], profileUrl: (h: string) => `https://linkedin.com/in/${h}`, audienceLabel: "followers" },
  { id: "facebook", label: "Facebook", short: "FB", hosts: ["facebook.com", "fb.com"], profileUrl: (h: string) => `https://facebook.com/${h}`, audienceLabel: "followers" },
  { id: "twitch", label: "Twitch", short: "TW", hosts: ["twitch.tv"], profileUrl: (h: string) => `https://twitch.tv/${h}`, audienceLabel: "followers" },
  { id: "pinterest", label: "Pinterest", short: "PI", hosts: ["pinterest.com", "pin.it"], profileUrl: (h: string) => `https://pinterest.com/${h}`, audienceLabel: "followers" },
  { id: "snapchat", label: "Snapchat", short: "SC", hosts: ["snapchat.com"], profileUrl: (h: string) => `https://snapchat.com/add/${h}`, audienceLabel: "followers" },
  { id: "other", label: "Other", short: "•", hosts: [], audienceLabel: "followers" },
] as const satisfies readonly PlatformDef[];

export type PlatformId = (typeof PLATFORMS)[number]["id"];

export function getPlatform(id: string): PlatformDef {
  return (PLATFORMS as readonly PlatformDef[]).find((p) => p.id === id) ?? PLATFORMS[PLATFORMS.length - 1]!;
}

export interface DetectedProfile {
  platform: PlatformId | null;
  handle: string | null;
  url: string | null;
}

/**
 * Turns whatever the user pasted (a profile link or an @handle) into a
 * platform + handle + url. Returns platform=null when it can't tell.
 */
export function detectProfile(raw: string): DetectedProfile {
  const input = raw.trim();
  if (!input) return { platform: null, handle: null, url: null };

  const looksLikeUrl = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/|$)/i.test(input);
  if (!looksLikeUrl) {
    const handle = input.replace(/^@/, "");
    return { platform: null, handle: handle ? `@${handle}` : null, url: null };
  }

  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { platform: null, handle: null, url: null };
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, "").toLowerCase();
  const p = PLATFORMS.find((x) => x.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  const segs = u.pathname.split("/").filter(Boolean);
  const skip = new Set(["in", "add", "c", "user", "channel", "company"]);
  const first = segs.find((s) => !skip.has(s.toLowerCase()));
  const handle = first ? `@${decodeURIComponent(first).replace(/^@/, "")}` : null;
  return { platform: p?.id ?? "other", handle, url: u.toString() };
}

/** Groups items by platform in registry order; only non-empty groups returned. */
export function groupByPlatform<T extends { platform: string }>(items: T[]) {
  return PLATFORMS.map((p) => ({
    platform: p as PlatformDef,
    items: items.filter((i) => getPlatform(i.platform).id === p.id),
  })).filter((g) => g.items.length > 0);
}
