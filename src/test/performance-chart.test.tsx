import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PerformanceChart } from "@/components/performance-chart";

describe("Performance chart", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  });

  it("shows the title, the 12-month label and the Revenue / Expenses legend", () => {
    render(<PerformanceChart entries={[]} end="2026-11" currency="USD" />);
    const card = screen.getByRole("region", { name: "Performance" });
    expect(card).toHaveTextContent("Performance");
    expect(card).toHaveTextContent("Last 12 months");
    expect(card).toHaveTextContent("Revenue");
    expect(card).toHaveTextContent("Expenses");
  });

  it("shows a placeholder while loading", () => {
    render(<PerformanceChart entries={[]} end="2026-11" currency="USD" loading />);
    expect(screen.getByLabelText("Loading performance")).toBeInTheDocument();
  });
});
