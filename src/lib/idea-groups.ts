/** Helpers for idea groups (folders for sorting ideas into sub-niches). Pure, so easy to test. */

export const GROUP_NAME_MAX = 80;

/** Pinned groups first, then in the order they were created. */
export const sortGroups = <T extends { pinned: boolean; created_at: string }>(groups: readonly T[]) =>
  [...groups].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.created_at.localeCompare(b.created_at));

/** A clean group name: trimmed, one line, at most 80 characters. Empty means "not a name". */
export const cleanGroupName = (raw: string) => raw.replace(/\s+/g, " ").trim().slice(0, GROUP_NAME_MAX);

/**
 * Which ideas to show for the current place.
 * - Top level: ideas in no group, plus ideas whose group is not on screen (another profile's group),
 *   so an idea can never disappear just because its group is hidden.
 * - Inside a group: that group's ideas.
 */
export function arrangeIdeas<T extends { group_id?: string | null }>(rows: readonly T[], groups: readonly { id: string }[], openGroupId: string | null): T[] {
  if (openGroupId) return rows.filter((r) => r.group_id === openGroupId);
  const known = new Set(groups.map((g) => g.id));
  return rows.filter((r) => !r.group_id || !known.has(r.group_id));
}

/** Ideas per group, not counting archived ones. */
export function countByGroup(ideas: readonly { group_id?: string | null; status: string }[]) {
  const counts = new Map<string, number>();
  for (const i of ideas) if (i.group_id && i.status !== "archived") counts.set(i.group_id, (counts.get(i.group_id) ?? 0) + 1);
  return counts;
}

/** Groups an idea may sit in: the ones from its own profile. */
export const groupsForIdea = <T extends { account_id: string | null }>(groups: readonly T[], idea: { account_id: string | null }) =>
  groups.filter((g) => g.account_id === idea.account_id);
