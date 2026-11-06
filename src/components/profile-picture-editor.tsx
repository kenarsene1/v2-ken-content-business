import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Camera, Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ProfileAvatar } from './profile-avatar';
import { supabase } from '@/integrations/supabase/client';
import { keys, type Account, useUpdateAccount } from '@/lib/queries';
import { importProfilePhoto } from '@/lib/profile-photos.functions';

export function ProfilePictureEditor({ account }: { account: Account }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const update = useUpdateAccount();
  const qc = useQueryClient();
  const lookup = useServerFn(importProfilePhoto);
  const upload = async (file: File) => {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { toast.error('Choose a JPG, PNG, or WebP smaller than 5 MB.'); return; }
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser(); if (!data.user) throw new Error('Please sign in again.');
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${data.user.id}/${account.id}/${crypto.randomUUID()}.${ext}`;
      const result = await supabase.storage.from('profile-pictures').upload(path, file);
      if (result.error) throw new Error(result.error.message);
      try { await update.mutateAsync({ id: account.id, patch: { avatar_path: path } }); }
      catch (error) { await supabase.storage.from('profile-pictures').remove([path]); throw error; }
      if (account.avatar_path) await supabase.storage.from('profile-pictures').remove([account.avatar_path]);
      toast.success('Profile picture updated');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Picture upload failed.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  const fetchPhoto = async () => {
    setBusy(true);
    try { await lookup({ data: { accountId: account.id } }); await qc.invalidateQueries({ queryKey: keys.accounts }); toast.success('Profile picture imported'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not get this picture. Upload it instead.'); }
    finally { setBusy(false); }
  };
  return <div className="flex items-center gap-4 border-b pb-5">
    <ProfileAvatar account={account} className="h-16 w-16 text-xl" />
    <div className="min-w-0 space-y-2"><p className="text-sm font-medium">Profile picture</p><div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <Camera />}Upload</Button>
      <Button size="sm" variant="ghost" disabled={busy || account.platform === 'other' || (!account.url && !account.handle)} onClick={fetchPhoto}><Download />From profile</Button>
      {account.avatar_path && <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy} title="Remove picture" aria-label="Remove picture" onClick={async () => { const old = account.avatar_path; await update.mutateAsync({ id: account.id, patch: { avatar_path: null } }); if (old) await supabase.storage.from('profile-pictures').remove([old]); }}><Trash2 /></Button>}
    </div></div><input ref={input} type="file" className="hidden" aria-label="Upload profile picture" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
  </div>;
}