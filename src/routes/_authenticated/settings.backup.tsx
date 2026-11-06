import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Archive, Download, FileSpreadsheet, LoaderCircle } from 'lucide-react';
import JSZip from 'jszip';
import { toast } from 'sonner';
import { prepareBackup } from '@/lib/backup.functions';
import { WORKSPACE_TABLES, csvForRows } from '@/lib/workspace-data';
import { deliverFile } from '@/lib/download';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_authenticated/settings/backup')({
  head: () => ({ meta: [
    { title: 'Backup & export · My content B/S CRM' },
    { name: 'description', content: 'Download your private creator records and profile photos.' },
    { property: 'og:title', content: 'Backup & export · My content B/S CRM' },
    { property: 'og:description', content: 'Download your private creator records and profile photos.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: BackupSettings,
});

function BackupSettings() {
  const load = useServerFn(prepareBackup);
  const [busy, setBusy] = useState<'backup' | 'csv' | null>(null);
  const [ready, setReady] = useState<{ blob: Blob; name: string; rows: number } | null>(null);
  const prepare = async (kind: 'backup' | 'csv') => {
    setBusy(kind); setReady(null);
    try {
      const backup = await load();
      const zip = new JSZip();
      if (kind === 'backup') {
        zip.file('records.json', JSON.stringify(backup, null, 2));
        const paths = [...new Set(backup.tables.accounts.flatMap(account => [account.avatar_path, account.avatar_image_path].filter((p): p is string => !!p)))];
        // Bounded concurrency: large profile collections do not flood Storage.
        for (let offset = 0; offset < paths.length; offset += 4) {
          await Promise.all(paths.slice(offset, offset + 4).map(async path => {
            const { data, error } = await supabase.storage.from('profile-pictures').download(path);
            if (error || !data) throw new Error('A profile photo could not be downloaded. Please retry the backup.');
            zip.file(`profile-pictures/${path}`, data);
          }));
        }
        zip.file('README.txt', 'My content B/S CRM backup v1\nrecords.json contains all saved CRM tables with original IDs and relationships.\nprofile-pictures contains the referenced private photo files.\nPaid deals remain in brand_deals, not duplicated in revenue_entries.\nAPI keys, sign-in details, browser chat history and live YouTube API responses are not included.\nThis is a manual downloadable backup. Automatic backups and in-app restore are not included.\n');
      } else {
        for (const table of WORKSPACE_TABLES) zip.file(`${table}.csv`, '\uFEFF' + csvForRows(backup.tables[table]));
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      setReady({ blob, name: `my-content-crm-${kind}-${backup.exportedAt.slice(0, 10)}.zip`, rows: WORKSPACE_TABLES.reduce((sum, table) => sum + backup.tables[table].length, 0) });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Export could not be prepared.'); }
    finally { setBusy(null); }
  };
  return <section className="space-y-6">
    <header><Archive className="mb-3 h-5 w-5 text-primary" /><h2 className="text-lg font-medium">Backup & export</h2></header>
    <div className="space-y-5 border-y py-5">
      <div><h3 className="text-sm font-medium">Complete backup</h3><p className="mt-1 text-sm text-muted-foreground">All profiles, videos, checklists, ideas, deals, groups, money entries, tags, AI preferences and profile photos.</p><Button className="mt-3" variant="outline" disabled={Boolean(busy)} onClick={() => prepare('backup')}>{busy === 'backup' ? <LoaderCircle className="animate-spin" /> : <Archive />} Prepare backup</Button></div>
      <div><h3 className="text-sm font-medium">Spreadsheet export</h3><p className="mt-1 text-sm text-muted-foreground">A CSV file for each collection, across all profiles.</p><Button className="mt-3" variant="outline" disabled={Boolean(busy)} onClick={() => prepare('csv')}>{busy === 'csv' ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />} Prepare CSV export</Button></div>
    </div>
    {ready && <div className="flex flex-wrap items-center gap-3" role="status"><Button onClick={() => deliverFile(ready.blob, ready.name)}><Download /> Download {ready.name.includes('-backup-') ? 'backup' : 'CSV export'}</Button><span className="text-xs text-muted-foreground">{ready.rows} saved records · Ready</span></div>}
    <p className="text-xs text-muted-foreground">Manual downloads only; no automatic schedule or in-app restore. Keys and sign-in details are excluded. Keep backups somewhere private.</p>
  </section>;
}