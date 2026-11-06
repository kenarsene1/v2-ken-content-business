import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom has no DOMRect, which Radix menus use to position at the pointer.
if (typeof globalThis.DOMRect === "undefined") {
  class TestDOMRect {
    constructor(public x = 0, public y = 0, public width = 0, public height = 0) {}
    get top() { return this.y; }
    get left() { return this.x; }
    get right() { return this.x + this.width; }
    get bottom() { return this.y + this.height; }
    toJSON() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
    static fromRect(r: { x?: number; y?: number; width?: number; height?: number } = {}) {
      return new TestDOMRect(r.x, r.y, r.width, r.height);
    }
  }
  Object.defineProperty(globalThis, "DOMRect", { writable: true, value: TestDOMRect });
}
