import { describe, expect, it } from "vitest";
import {
  addLibraryResource, addLinkResource, formatBytes, hostOf, kindForFile, parseResources, removeResource, safeFileName, sortLibrary,
  titleFromFile, toHttpUrl,
} from "@/lib/library";

describe("library helpers", () => {
  it("makes storage-safe file names and titles", () => {
    expect(safeFileName("My Thumb (1).PNG")).toBe("My-Thumb-1.png");
    expect(safeFileName("..")).toBe("file");
    expect(titleFromFile("Brief v2.pdf")).toBe("Brief v2");
    expect(kindForFile({ type: "image/png" })).toBe("image");
    expect(kindForFile({ type: "application/pdf" })).toBe("doc");
  });

  it("formats sizes and links", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
    expect(hostOf("https://www.youtube.com/watch?v=1")).toBe("youtube.com");
    expect(toHttpUrl("youtube.com/@me")).toBe("https://youtube.com/@me");
    expect(toHttpUrl("javascript:alert(1)")).toBeNull();
    expect(toHttpUrl("not a link")).toBeNull();
  });

  it("puts pinned items first, then the newest", () => {
    const rows = [
      { id: "a", pinned: false, updated_at: "2026-10-03" },
      { id: "b", pinned: true, updated_at: "2026-10-01" },
      { id: "c", pinned: false, updated_at: "2026-10-05" },
    ];
    expect(sortLibrary(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("adds, dedupes, reads and removes video resources", () => {
    const withLink = addLinkResource([], "www.notion.so/brief")!;
    expect(withLink[0]).toMatchObject({ kind: "link", url: "https://www.notion.so/brief", label: "notion.so" });
    expect(addLinkResource(withLink, "https://www.notion.so/brief")).toHaveLength(1);
    expect(addLinkResource(withLink, "nope")).toBeNull();
    const both = addLibraryResource(withLink, { id: "lib-1", title: "Script notes" });
    expect(addLibraryResource(both, { id: "lib-1", title: "Script notes" })).toHaveLength(2);
    expect(parseResources(JSON.parse(JSON.stringify(both)))).toEqual(both);
    expect(parseResources([{ id: "x", kind: "link", url: "javascript:1" }, { kind: "library" }, null])).toEqual([]);
    expect(removeResource(both, both[0]!.id)).toEqual([both[1]]);
  });
});
