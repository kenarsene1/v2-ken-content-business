import { describe, expect, it } from "vitest";
import { fetchAll } from "@/lib/fetch-all";

const table = (n: number) => Array.from({ length: n }, (_, i) => i);
const source = (rows: number[]) => async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null });

describe("fetchAll", () => {
  it("returns every row past the 1,000 row limit", async () => expect(await fetchAll(source(table(2500)))).toHaveLength(2500));
  it("handles an exact page boundary", async () => expect(await fetchAll(source(table(2000)))).toHaveLength(2000));
  it("handles an empty table", async () => expect(await fetchAll(source([]))).toEqual([]));
  it("throws instead of returning partial data", async () => {
    let calls = 0;
    const failing = async () => (++calls === 1 ? { data: table(1000), error: null } : { data: null, error: { message: "boom" } });
    await expect(fetchAll(failing)).rejects.toThrow("boom");
  });
});
