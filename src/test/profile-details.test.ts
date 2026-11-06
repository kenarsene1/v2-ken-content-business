import { describe, expect, it } from "vitest";
import {
  addOtherSocial, addSimilarCreator, linkLabel, MAX_LIST, parseOtherSocials, parseSimilarCreators, removeById, socialHref, updateOtherSocial,
} from "@/lib/profile-details";

describe("similar creators", () => {
  it("labels a link with its host and path", () => {
    expect(linkLabel("https://www.youtube.com/@mkbhd/")).toBe("youtube.com/@mkbhd");
    expect(linkLabel("not a link")).toBe("");
  });

  it("adds a valid link, ignores repeats, and rejects bad links", () => {
    const one = addSimilarCreator([], "youtube.com/@mkbhd");
    expect(one).toHaveLength(1);
    expect(one?.[0]?.url).toBe("https://youtube.com/@mkbhd");
    expect(addSimilarCreator(one ?? [], "https://youtube.com/@mkbhd")).toHaveLength(1);
    expect(addSimilarCreator([], "hello")).toBeNull();
    expect(addSimilarCreator([], "javascript:alert(1)")).toBeNull();
  });

  it("stops at the list limit", () => {
    let list: ReturnType<typeof parseSimilarCreators> = [];
    for (let i = 0; i < MAX_LIST; i++) list = addSimilarCreator(list, `https://example.com/${i}`) ?? list;
    expect(list).toHaveLength(MAX_LIST);
    expect(addSimilarCreator(list, "https://example.com/extra")).toBeNull();
  });

  it("reads stored data safely", () => {
    expect(parseSimilarCreators(null)).toEqual([]);
    expect(parseSimilarCreators("x")).toEqual([]);
    const parsed = parseSimilarCreators([
      { id: "1", url: "https://example.com/a", label: "A" },
      { id: "2", url: "javascript:alert(1)", label: "bad" },
      { url: "https://example.com/b" },
      "junk",
      { id: "3", url: "https://example.com/c" },
    ]);
    expect(parsed.map((p) => p.id)).toEqual(["1", "3"]);
    expect(parsed[1]?.label).toBe("example.com/c");
  });

  it("removes by id", () => {
    expect(removeById([{ id: "a" }, { id: "b" }], "a")).toEqual([{ id: "b" }]);
  });
});

describe("other social platforms", () => {
  it("adds, edits and trims entries", () => {
    const added = addOtherSocial([], "tiktok") ?? [];
    expect(added[0]).toMatchObject({ platform: "tiktok", handle: "" });
    const id = added[0]?.id ?? "";
    expect(updateOtherSocial(added, id, { handle: "  @me  " })[0]?.handle).toBe("@me");
    expect(updateOtherSocial(added, id, { platform: "x" })[0]).toMatchObject({ platform: "x", handle: "" });
  });

  it("stops at the list limit", () => {
    let list: ReturnType<typeof parseOtherSocials> = [];
    for (let i = 0; i < MAX_LIST; i++) list = addOtherSocial(list, "other") ?? list;
    expect(addOtherSocial(list, "other")).toBeNull();
  });

  it("reads stored data safely", () => {
    expect(parseOtherSocials(undefined)).toEqual([]);
    expect(parseOtherSocials([{ id: "1", platform: "tiktok", handle: "@me" }, { platform: "x" }, 5])).toEqual([{ id: "1", platform: "tiktok", handle: "@me" }]);
    expect(parseOtherSocials([{ id: "1", handle: "me" }])[0]?.platform).toBe("other");
  });

  it("builds a profile link from a handle, or keeps a pasted link", () => {
    expect(socialHref("tiktok", "@me")).toBe("https://tiktok.com/@me");
    expect(socialHref("instagram", "me.name")).toBe("https://instagram.com/me.name");
    expect(socialHref("x", "https://x.com/me")).toBe("https://x.com/me");
    expect(socialHref("x", "x.com/me")).toBe("https://x.com/me");
    expect(socialHref("other", "me")).toBeNull();
    expect(socialHref("tiktok", "")).toBeNull();
    expect(socialHref("tiktok", "a b; drop")).toBeNull();
  });
});
