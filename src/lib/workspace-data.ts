import type { Database } from '@/integrations/supabase/types';

/** One explicit inventory for backups and assistant reads. Never includes credentials. */
export const WORKSPACE_TABLES = ['accounts', 'content_items', 'content_checklist_items', 'ideas', 'brand_deals', 'deal_tasks', 'deal_groups', 'revenue_entries', 'challenges', 'goals', 'workflows', 'library_projects', 'library_items', 'idea_groups', 'tags', 'ai_preferences'] as const;
export type WorkspaceTable = typeof WORKSPACE_TABLES[number];
export type WorkspaceData = { [K in WorkspaceTable]: Database['public']['Tables'][K]['Row'][] };

export function csvForRows(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const cell = (value: unknown) => {
    let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    // Spreadsheet formula injection also applies to user-entered titles and notes.
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [columns.map(cell).join(','), ...rows.map(row => columns.map(key => cell(row[key])).join(','))].join('\r\n');
}