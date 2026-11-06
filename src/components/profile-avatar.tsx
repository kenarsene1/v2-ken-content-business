import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Account } from '@/lib/queries';
import { cn } from '@/lib/utils';

export function ProfileAvatar({ account, className }: { account: Pick<Account, 'name' | 'avatar_path'>; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const path = account.avatar_path;
  const { data: url } = useQuery({ queryKey: ['profile-photo', path], enabled: !!path, staleTime: 45 * 60 * 1000, gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      const result = await supabase.storage.from('profile-pictures').createSignedUrl(path, 3600);
      if (result.error) throw new Error(result.error.message);
      return result.data.signedUrl;
    }, retry: false,
  });
  return <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-[10px] font-medium text-muted-foreground', className)}>
    {url && failed !== url ? <img src={url} alt={`${account.name} profile picture`} className="h-full w-full object-cover" onError={() => setFailed(url)} /> : <span aria-label={`${account.name} profile picture unavailable`}>{account.name.split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()}</span>}
  </span>;
}