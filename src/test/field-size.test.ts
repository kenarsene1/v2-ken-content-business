import { beforeEach, describe, expect, it } from "vitest";
import { getFieldHeight, saveFieldHeight } from "@/lib/field-size";

const KEY = "creatoros-field-heights";

describe("remembered text box heights", () => {
  beforeEach(() => window.localStorage.clear());

  it("saves and returns a height per field", () => {
    saveFieldHeight("Notes", 320.4);
    saveFieldHeight("Title options", 200);
    expect(getFieldHeight("Notes")).toBe(320);
    expect(getFieldHeight("Title options")).toBe(200);
    expect(getFieldHeight("Other")).toBeNull();
  });

  it("ignores impossible sizes", () => {
    saveFieldHeight("Notes", 0);
    saveFieldHeight("Notes", 10);
    saveFieldHeight("Notes", Number.NaN);
    saveFieldHeight("Notes", 999999);
    saveFieldHeight("", 300);
    expect(getFieldHeight("Notes")).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("survives damaged storage", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(getFieldHeight("Notes")).toBeNull();
    saveFieldHeight("Notes", 150);
    expect(getFieldHeight("Notes")).toBe(150);
    window.localStorage.setItem(KEY, JSON.stringify({ Notes: "tall", Good: 120 }));
    expect(getFieldHeight("Notes")).toBeNull();
    expect(getFieldHeight("Good")).toBe(120);
  });

  it("keeps storage small by dropping the oldest fields", () => {
    for (let i = 0; i < 80; i++) saveFieldHeight(`field-${i}`, 100 + i);
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
    expect(Object.keys(stored)).toHaveLength(60);
    expect(stored["field-0"]).toBeUndefined();
    expect(stored["field-79"]).toBe(179);
  });
});
