const PAGE = 1000;

/**
 * Reads a whole table, one page at a time. The Data API returns at most 1,000 rows per request,
 * so a plain select would silently drop rows once a table grows past that.
 * The query must have a stable order (end it with `id`) so pages never overlap or skip rows.
 */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}
