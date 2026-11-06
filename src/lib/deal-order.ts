/**
 * New id order after dragging `activeId` onto `overId`.
 * Dragging down lands after the target, dragging up lands before it, so the card ends up where it was dropped.
 */
export function moveBefore(ids: readonly string[], activeId: string, overId: string): string[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return [...ids];
  const next = ids.filter((id) => id !== activeId);
  const at = next.indexOf(overId);
  next.splice(from < to ? at + 1 : at, 0, activeId);
  return next;
}

export function moveToTop(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? [id, ...ids.filter((x) => x !== id)] : [...ids];
}

/** Manual order first; deals with the same order keep newest-first. */
export function byManualOrder<T extends { sort_order: number; created_at: string }>(a: T, b: T): number {
  return a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at);
}

/**
 * Rows whose saved position differs from the new order — only those need writing.
 * `previous` must be the order from *before* the optimistic screen update, otherwise
 * every row already appears to be in place and nothing is ever saved.
 */
export function orderPatches(previous: ReadonlyMap<string, number>, ids: readonly string[]): { id: string; sort_order: number }[] {
  return ids.flatMap((id, i) => (previous.get(id) === i ? [] : [{ id, sort_order: i }]));
}
