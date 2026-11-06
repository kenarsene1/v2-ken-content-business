export const IDEA_STATUSES = [
  { id: "new", label: "Fresh" }, { id: "shortlisted", label: "Shortlisted" },
  { id: "used", label: "In motion" }, { id: "archived", label: "Archived" },
] as const;
export const IDEA_SOURCES = [
  { id: "own_thought", label: "My own thought" }, { id: "comment", label: "A comment" },
  { id: "competitor", label: "Another creator" }, { id: "trend", label: "A trend" },
] as const;
export function ideaScore(idea: { reach: number; ease: number; relevance: number }) {
  return idea.reach * idea.ease * idea.relevance;
}
export function scopeToAccount<T extends { account_id: string | null }>(rows: T[] | undefined, accountId: string | null) {
  return accountId ? rows?.filter((row) => row.account_id === accountId) : rows;
}