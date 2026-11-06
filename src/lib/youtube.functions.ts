import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const API = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  subscribers: number | null;
  views: number | null;
  videos: number | null;
  uploadsPlaylist: string | null;
}
export interface YouTubeVideo {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string | null;
  duration: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
}
export interface YouTubePage {
  channel: YouTubeChannel | null;
  videos: YouTubeVideo[];
  nextPageToken: string | null;
  syncedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const num = (v: unknown) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

class NotFound extends Error {}

async function yt(path: string, params: Record<string, string>, key: string): Promise<Json> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', key);
  // Workers reject redirect:'error'; 'manual' + status check never follows a redirect with the key.
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12000) });
  if (res.status >= 300 && res.status < 400) throw new Error('YouTube answered unexpectedly. Try again later.');
  if (!res.ok) {
    console.error('YouTube API error', path, res.status, await res.text().catch(() => ''));
    if (res.status === 404) throw new NotFound('Not found');
    if (res.status === 403) throw new Error('YouTube refused the request. Check the API key or daily quota.');
    if (res.status === 400) throw new Error('YouTube rejected the request. Check the API key and the channel link.');
    throw new Error(`YouTube is unavailable right now (${res.status}). Try again later.`);
  }
  return res.json();
}

const CHANNEL_ID = /^UC[\w-]{22}$/;
const PHOTO_HOST = /(^|\.)(ggpht\.com|googleusercontent\.com|ytimg\.com)$/;

/** Downloads a YouTube channel picture (Google hosts only) into private storage; returns its path. */
async function saveChannelPhoto(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, folder: string, src: string,
): Promise<string | null> {
  const u = new URL(src);
  if (u.protocol !== 'https:' || !PHOTO_HOST.test(u.hostname)) return null;
  const res = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const mime = res.headers.get('content-type')?.split(';')[0] ?? '';
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[mime];
  if (!ext) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > 5 * 1024 * 1024) return null;
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from('profile-pictures').upload(path, bytes, { contentType: mime });
  return up.error ? null : path;
}

/** Turns a profile link, @handle or saved channel ID into a channels.list lookup.
 *  The link/handle wins so editing it switches channels; the saved ID is only a fallback. */
export function channelLookup(url: string | null, handle: string | null, externalId: string | null): Record<string, string> | null {
  if (url) {
    try {
      const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
      const host = u.hostname.replace(/^(www\.|m\.)/, '');
      if (host === 'youtube.com') {
        const [a, b] = u.pathname.split('/').filter(Boolean);
        if (a === 'channel' && b && CHANNEL_ID.test(b)) return { id: b };
        if (a?.startsWith('@')) return { forHandle: decodeURIComponent(a) };
        if (a === 'user' && b) return { forUsername: b };
        if (a === 'c' && b) return { forHandle: `@${b}` };
      }
    } catch { /* fall through */ }
  }
  const h = handle?.trim().replace(/^@/, '');
  if (h && CHANNEL_ID.test(h)) return { id: h };
  if (h && /^[\w.\-·]{3,100}$/.test(h)) return { forHandle: `@${h}` };
  if (externalId && CHANNEL_ID.test(externalId)) return { id: externalId };
  return null;
}

async function fetchVideos(playlistId: string, pageToken: string | undefined, key: string) {
  let pl: Json;
  try {
    pl = await yt('playlistItems', { part: 'contentDetails', playlistId, maxResults: '12', ...(pageToken ? { pageToken } : {}) }, key);
  } catch (e) {
    if (e instanceof NotFound) return { videos: [] as YouTubeVideo[], nextPageToken: null }; // channel has no uploads
    throw e;
  }
  const ids: string[] = (pl.items ?? []).map((i: Json) => i.contentDetails?.videoId).filter(Boolean);
  if (!ids.length) return { videos: [], nextPageToken: null };
  const vs = await yt('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') }, key);
  const byId = new Map<string, Json>((vs.items ?? []).map((v: Json) => [v.id, v]));
  const videos: YouTubeVideo[] = ids.flatMap((id) => {
    const v = byId.get(id);
    if (!v) return []; // private/removed
    const t = v.snippet?.thumbnails;
    return [{
      id,
      title: v.snippet?.title ?? '',
      publishedAt: v.snippet?.publishedAt ?? '',
      thumbnail: t?.medium?.url ?? t?.default?.url ?? null,
      duration: v.contentDetails?.duration ?? null,
      views: num(v.statistics?.viewCount),
      likes: num(v.statistics?.likeCount),
      comments: num(v.statistics?.commentCount),
    }];
  });
  return { videos, nextPageToken: (pl.nextPageToken as string | undefined) ?? null };
}

export const getYouTubeAnalytics = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ accountId: z.string().uuid(), pageToken: z.string().max(200).optional() }).parse(input))
  .handler(async ({ data, context }): Promise<YouTubePage> => {
    const key = process.env['YOUTUBE_API_KEY'];
    if (!key) throw new Error('YouTube isn’t connected yet. Add the YouTube API key first.');
    const { data: account, error } = await context.supabase
      .from('accounts').select('id, platform, url, handle, external_id, avatar_path').eq('id', data.accountId).maybeSingle();
    if (error || !account) throw new Error('Profile not found.');
    if (account.platform !== 'youtube') throw new Error('This profile isn’t a YouTube profile.');
    const syncedAt = new Date().toISOString();

    // Next pages: skip the channel lookup (saves quota) using the channel found on page one.
    if (data.pageToken) {
      if (!account.external_id || !CHANNEL_ID.test(account.external_id)) throw new Error('Refresh the stats first.');
      const page = await fetchVideos(`UU${account.external_id.slice(2)}`, data.pageToken, key);
      return { channel: null, ...page, syncedAt };
    }

    const lookup = channelLookup(account.url, account.handle, account.external_id);
    if (!lookup) throw new Error('Add a YouTube channel link (youtube.com/@name) or @handle to this profile first.');
    const ch = (await yt('channels', { part: 'snippet,statistics,contentDetails', ...lookup }, key)).items?.[0];
    if (!ch) throw new Error('No YouTube channel found for this link or handle. Check that it’s correct.');
    const s = ch.statistics ?? {};
    const t = ch.snippet?.thumbnails;
    const channel: YouTubeChannel = {
      id: ch.id,
      title: ch.snippet?.title ?? '',
      description: ch.snippet?.description ?? '',
      thumbnail: t?.medium?.url ?? t?.default?.url ?? null,
      subscribers: s.hiddenSubscriberCount ? null : num(s.subscriberCount),
      views: num(s.viewCount),
      videos: num(s.videoCount),
      uploadsPlaylist: ch.contentDetails?.relatedPlaylists?.uploads ?? null,
    };
    const page = channel.uploadsPlaylist ? await fetchVideos(channel.uploadsPlaylist, undefined, key) : { videos: [], nextPageToken: null };

    // Save fresh public stats onto this one profile only.
    const patch: { external_id: string; last_synced_at: string; followers?: number; avatar_path?: string } = { external_id: channel.id, last_synced_at: syncedAt };
    if (channel.subscribers != null) patch.followers = channel.subscribers;
    // Use the channel picture when the profile has none, or when it now points to a different channel.
    const photo = t?.high?.url ?? channel.thumbnail;
    let newPhoto: string | null = null;
    if (photo && (!account.avatar_path || account.external_id !== channel.id)) {
      newPhoto = await saveChannelPhoto(context.supabase, `${context.userId}/${account.id}`, photo).catch((e) => { console.error('YouTube photo save failed', e); return null; });
      if (newPhoto) patch.avatar_path = newPhoto;
    }
    const saved = await context.supabase.from('accounts').update(patch).eq('id', account.id);
    if (saved.error) {
      console.error('Failed to save YouTube stats', saved.error.message);
      if (newPhoto) await context.supabase.storage.from('profile-pictures').remove([newPhoto]);
    } else if (newPhoto && account.avatar_path) {
      await context.supabase.storage.from('profile-pictures').remove([account.avatar_path]);
    }

    return { channel, ...page, syncedAt };
  });
