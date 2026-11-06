import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { WORKSPACE_TABLES, type WorkspaceData } from './workspace-data';

/** Read every page, not just the Data API's first 1,000 rows. RLS plus explicit owner scope. */
export async function readWorkspace(client: SupabaseClient<Database>, userId: string): Promise<WorkspaceData> {
  const entries = await Promise.all(WORKSPACE_TABLES.map(async table => {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 500) {
      const order = table === 'ai_preferences' ? 'user_id' : 'id';
      const { data, error } = await client.from(table).select('*').eq('user_id', userId).order(order).range(offset, offset + 499);
      if (error) throw new Error(`Could not read ${table.replaceAll('_', ' ')}. No incomplete backup was created.`);
      rows.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    return [table, rows];
  }));
  return Object.fromEntries(entries) as WorkspaceData;
}