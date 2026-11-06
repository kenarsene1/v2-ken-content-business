import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { readWorkspace } from './workspace-data.server';

export const prepareBackup = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const tables = await readWorkspace(context.supabase, context.userId);
  return { format: 'my-content-crm-backup', version: 1, exportedAt: new Date().toISOString(), tables };
});