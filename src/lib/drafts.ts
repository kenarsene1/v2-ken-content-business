/**
 * Blank drafts: rows made by a "New" button that you close without changing.
 * They are removed again, so nothing is added unless you actually filled something in.
 * Only rows marked here (made by New in this page load) are ever considered.
 */
export type DraftTable = "content_items" | "ideas" | "brand_deals" | "revenue_entries";

const drafts = new Map<string, DraftTable>();

export const markDraft = (table: DraftTable, id: string) => { drafts.set(id, table); };
export const draftTable = (id: string) => drafts.get(id);
export const clearDraft = (id: string) => { drafts.delete(id); };

const DEFAULT_TITLES: Record<DraftTable, readonly string[]> = {
  content_items: ["Untitled"],
  ideas: ["Untitled idea", "Untitled"],
  brand_deals: ["Untitled deal"],
  revenue_entries: ["New income", "New expense", "New entry"],
};

const blank = (v: unknown) => v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0);
const defaultTitle = (table: DraftTable, title: unknown) => blank(title) || DEFAULT_TITLES[table].includes(String(title).trim());
const allBlank = (row: Record<string, unknown>, fields: string[]) => fields.every((f) => blank(row[f]));

/** True when a new row still holds only what "New" put in it. */
export function isBlankDraft(table: DraftTable, row: Record<string, unknown>): boolean {
  if (!defaultTitle(table, row["title"])) return false;
  switch (table) {
    case "revenue_entries":
      return !Number(row["amount"]) && blank(row["note"]);
    case "brand_deals":
      return !Number(row["value"]) && (blank(row["brand"]) || row["brand"] === "New brand")
        && allBlank(row, ["notes", "contact_name", "contact_email", "deliverables", "usage_rights", "content_item_id", "revenue_entry_id"]);
    case "ideas":
      return allBlank(row, ["note", "ref_url", "tags", "content_item_id"]);
    case "content_items":
      return !Number(row["minutes_logged"])
        && allBlank(row, ["notes", "script_url", "ref_url", "thumbnail_url", "thumbnail_path", "thumbnail_concepts", "title_options", "tags", "workflow_done", "parent_id"])
        && (blank(row["resources"]) || (typeof row["resources"] === "object" && Object.keys(row["resources"] as object).length === 0));
  }
}
