import { PLATFORMS } from "./platforms";

/** Lookup is limited to real profile pages, never arbitrary URLs or posts. */
export function profileLookupUrl(platform: string, url: string | null, handle: string | null) {
  const definition = PLATFORMS.find((p) => p.id === platform);
  const builder = definition && 'profileUrl' in definition ? definition.profileUrl : null;
  const input = url || (handle && builder ? builder(handle.replace(/^@/, "")) : null);
  if (!input || !definition || platform === "other") throw new Error("Add a profile link first, or upload a picture.");
  const parsed = new URL(input);
  const host = parsed.hostname.replace(/^(www\.|m\.)/, "").toLowerCase();
  if (parsed.protocol !== "https:" || parsed.port || parsed.username || parsed.password || !definition.hosts.some((h) => h === host)) throw new Error("Use an HTTPS profile link from the selected platform.");
  const parts = parsed.pathname.split('/').filter(Boolean);
  const valid = platform === 'youtube'
    ? (parts.length === 1 && /^@[\w.\-]+$/.test(parts[0] ?? '')) || (parts.length === 2 && ['channel','user','c'].includes(parts[0] ?? ''))
    : parts.length > 0 && parts.length <= 2 && !['watch','shorts','p','reel','video','status','login','explore','share'].includes(parts[0] ?? '');
  if (!valid) throw new Error("Use the profile page, not a video or post link.");
  parsed.search = ''; parsed.hash = '';
  if (platform === 'youtube') parsed.hostname = 'www.youtube.com';
  return parsed.toString();
}

const imageHosts = ['yt3.googleusercontent.com','yt3.ggpht.com','scontent.cdninstagram.com','cdninstagram.com','fbcdn.net','twimg.com','tiktokcdn.com','tiktokcdn-us.com','tiktokcdn-eu.com','licdn.com','jtvnw.net','pinimg.com','sc-cdn.net'];
export function allowedPhotoUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && imageHosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch { return false; }
}

export function extractProfilePhoto(html: string, platform: string) {
  const candidates: string[] = [];
  // TikTok's avatar fields are less ambiguous than its generic share image.
  if (platform === 'tiktok') {
    const match = html.match(/"avatar(?:Larger|Medium|Thumb)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (match?.[1]) { try { candidates.push(JSON.parse(`"${match[1]}"`)); } catch { /* Skip malformed JSON. */ } }
  }
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((m) => [(m[1] ?? '').toLowerCase(), m[2] ?? '']));
    if (attrs['property'] === 'og:image' || attrs['name'] === 'twitter:image') candidates.push(attrs['content'] ?? '');
  }
  return candidates.map((v) => v.replaceAll('&amp;', '&').replaceAll('&#38;', '&')).find(allowedPhotoUrl) ?? null;
}

export async function boundedBytes(response: Response, limit: number) {
  if (!response.body) throw new Error('The platform returned an empty response.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > limit) throw new Error('The platform response is too large. Try uploading a picture.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}