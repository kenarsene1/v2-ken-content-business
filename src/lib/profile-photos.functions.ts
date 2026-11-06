import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { allowedPhotoUrl, boundedBytes, extractProfilePhoto, profileLookupUrl } from './profile-photos';

export const importProfilePhoto = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ accountId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: account, error } = await context.supabase.from('accounts').select('*').eq('id', data.accountId).single();
    if (error || !account) throw new Error('Profile not found.');
    let pageUrl = profileLookupUrl(account.platform, account.url, account.handle);
    let response: Response | null = null;
    // Every redirect is revalidated. Never send session headers to a platform.
    for (let i = 0; i < 4; i++) {
      response = await fetch(pageUrl, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0' } });
      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get('location');
      if (!location) break;
      try { pageUrl = profileLookupUrl(account.platform, new URL(location, pageUrl).toString(), null); }
      catch { throw new Error('The platform redirected to a sign-in or consent page. Upload your picture instead.'); }
    }
    if (!response?.ok) throw new Error(`The platform couldn't share this picture (${response?.status ?? 'no response'}). You can upload it instead.`);
    const html = new TextDecoder().decode(await boundedBytes(response, 4 * 1024 * 1024));
    const photoUrl = extractProfilePhoto(html, account.platform);
    if (!photoUrl || !allowedPhotoUrl(photoUrl)) throw new Error('No public profile picture found. Upload your picture instead.');
    const image = await fetch(photoUrl, { redirect: 'manual', signal: AbortSignal.timeout(12000) });
    if (!image.ok) throw new Error(`The picture couldn't be downloaded (${image.status}). Upload it instead.`);
    const mime = image.headers.get('content-type')?.split(';')[0] ?? '';
    const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[mime];
    if (!extension) throw new Error('This picture format is not supported. Upload a JPG, PNG, or WebP.');
    const bytes = await boundedBytes(image, 5 * 1024 * 1024);
    const path = `${context.userId}/${account.id}/${crypto.randomUUID()}.${extension}`;
    const upload = await context.supabase.storage.from('profile-pictures').upload(path, bytes, { contentType: mime });
    if (upload.error) throw new Error(upload.error.message);
    const saved = await context.supabase.from('accounts').update({ avatar_path: path }).eq('id', account.id);
    if (saved.error) { await context.supabase.storage.from('profile-pictures').remove([path]); throw new Error(saved.error.message); }
    if (account.avatar_path) await context.supabase.storage.from('profile-pictures').remove([account.avatar_path]);
    return { path };
  });