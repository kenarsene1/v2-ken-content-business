/**
 * Tracks rows the user just added or removed while the database call is still running.
 *
 * Why: a background refetch (window focus, another save finishing) can land in the middle of an
 * add or remove and bring the old list back, so a new row vanishes or a removed row reappears for
 * a moment. Query functions pass every fetched list through `apply`, so the screen keeps showing
 * what the user did until the database confirms it.
 */
export class PendingChanges<T extends { id: string }> {
  private added = new Map<string, T>();
  private removed = new Set<string>();

  /** A row is being created: keep showing it even if a fetch does not include it yet. */
  add(row: T) {
    this.removed.delete(row.id);
    this.added.set(row.id, row);
  }

  /** A row is being deleted: hide it even if a fetch still includes it. */
  remove(id: string) {
    this.added.delete(id);
    this.removed.add(id);
  }

  /** The database call finished (or failed): stop overriding fetched data for this row. */
  settle(id: string) {
    this.added.delete(id);
    this.removed.delete(id);
  }

  isRemoved(id: string) {
    return this.removed.has(id);
  }

  hasRemoved() {
    return this.removed.size > 0;
  }

  /** Fetched rows with the user's unconfirmed adds and removes applied. */
  apply(rows: T[]): T[] {
    if (!this.added.size && !this.removed.size) return rows;
    const kept = this.removed.size ? rows.filter((r) => !this.removed.has(r.id)) : rows;
    if (!this.added.size) return kept;
    const have = new Set(kept.map((r) => r.id));
    const extra = [...this.added.values()].filter((r) => !have.has(r.id));
    return extra.length ? [...extra, ...kept] : kept;
  }
}

/**
 * Runs saves for the same row one after another, and makes a save wait for that row's creation.
 * Without this, editing a note that was just added (before the database has it) would fail.
 */
export class RowQueue {
  private tails = new Map<string, Promise<unknown>>();

  run<R>(id: string, task: () => Promise<R>): Promise<R> {
    const tail = this.tails.get(id) ?? Promise.resolve();
    const next = tail.catch(() => undefined).then(task);
    const stored = next.catch(() => undefined);
    this.tails.set(id, stored);
    void stored.then(() => {
      if (this.tails.get(id) === stored) this.tails.delete(id);
    });
    return next;
  }
}
