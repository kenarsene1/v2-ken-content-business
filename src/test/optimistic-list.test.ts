import { describe, expect, it } from "vitest";
import { PendingChanges, RowQueue } from "@/lib/optimistic-list";

type Row = { id: string; name: string };
const a: Row = { id: "a", name: "A" };
const b: Row = { id: "b", name: "B" };
const c: Row = { id: "c", name: "C" };

describe("PendingChanges", () => {
  it("returns fetched rows untouched when nothing is pending", () => {
    const rows = [a, b];
    expect(new PendingChanges<Row>().apply(rows)).toBe(rows);
  });

  it("keeps a removed row hidden when a refetch still returns it", () => {
    const pending = new PendingChanges<Row>();
    pending.remove("a");
    expect(pending.apply([a, b])).toEqual([b]);
    pending.settle("a");
    expect(pending.apply([b])).toEqual([b]);
  });

  it("keeps a new row visible when a refetch does not have it yet, without duplicating it", () => {
    const pending = new PendingChanges<Row>();
    pending.add(c);
    expect(pending.apply([a, b])).toEqual([c, a, b]);
    expect(pending.apply([a, c])).toEqual([a, c]);
    pending.settle("c");
    expect(pending.apply([a, b])).toEqual([a, b]);
  });

  it("adding a row cancels an earlier removal (undo) and removing cancels an add", () => {
    const pending = new PendingChanges<Row>();
    pending.remove("a");
    pending.add(a);
    expect(pending.isRemoved("a")).toBe(false);
    expect(pending.apply([b])).toEqual([a, b]);
    pending.remove("a");
    expect(pending.apply([a, b])).toEqual([b]);
    expect(pending.hasRemoved()).toBe(true);
    pending.settle("a");
    expect(pending.hasRemoved()).toBe(false);
  });
});

describe("RowQueue", () => {
  it("runs work for the same row in order, even when an earlier step is slow", async () => {
    const queue = new RowQueue();
    const log: string[] = [];
    const first = queue.run("x", async () => { await new Promise((r) => setTimeout(r, 20)); log.push("create"); });
    const second = queue.run("x", async () => { log.push("save"); });
    await Promise.all([first, second]);
    expect(log).toEqual(["create", "save"]);
  });

  it("still runs the next step after a failure, and reports the failure to its own caller", async () => {
    const queue = new RowQueue();
    const failing = queue.run("x", async () => { throw new Error("nope"); });
    const next = queue.run("x", async () => "ok");
    await expect(failing).rejects.toThrow("nope");
    await expect(next).resolves.toBe("ok");
  });

  it("does not make different rows wait for each other", async () => {
    const queue = new RowQueue();
    const log: string[] = [];
    const slow = queue.run("x", async () => { await new Promise((r) => setTimeout(r, 30)); log.push("x"); });
    await queue.run("y", async () => { log.push("y"); });
    await slow;
    expect(log).toEqual(["y", "x"]);
  });
});
