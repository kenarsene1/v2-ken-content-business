import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutoInput } from "@/components/bits";

const KEY = "creatoros-field-heights";
let trigger: (() => void) | undefined;

class FakeResizeObserver {
  constructor(cb: () => void) { trigger = cb; }
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe("AutoInput remembers its height", () => {
  beforeEach(() => {
    window.localStorage.clear();
    trigger = undefined;
    vi.useFakeTimers();
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens at the height the user last dragged it to", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ Notes: 300 }));
    render(<AutoInput multiline aria-label="Notes" value="" onSave={() => {}} />);
    expect(screen.getByLabelText("Notes")).toHaveStyle({ height: "300px" });
  });

  it("does not resize a different field", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ Notes: 300 }));
    render(<AutoInput multiline aria-label="Other" value="" onSave={() => {}} />);
    expect(screen.getByLabelText("Other").style.height).toBe("");
  });

  it("saves a new height after the user drags the box", () => {
    let height = 96;
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => height);
    render(<AutoInput multiline placeholder="Anything worth remembering" value="" onSave={() => {}} />);
    height = 420;
    act(() => { trigger?.(); vi.advanceTimersByTime(300); });
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "{}")).toEqual({ "Anything worth remembering": 420 });
  });

  it("ignores a width-only change", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => 96);
    render(<AutoInput multiline aria-label="Notes" value="" onSave={() => {}} />);
    act(() => { trigger?.(); vi.advanceTimersByTime(300); });
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("works without ResizeObserver (older browsers)", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    expect(() => render(<AutoInput multiline aria-label="Notes" value="" onSave={() => {}} />)).not.toThrow();
  });
});
