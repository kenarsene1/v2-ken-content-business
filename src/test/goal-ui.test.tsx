import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { GoalCard } from "@/components/goal-card";
import type { Goal } from "@/lib/goals";
import type { Account } from "@/lib/queries";
import { useUI } from "@/lib/store";

const goal = (patch: Partial<Goal>): Goal => ({
  id: "g1", user_id: "u", account_id: null, kind: "goal", title: "Reach 10K subscribers", notes: "", status: "active", measure: "number",
  display: "ring", start_value: 0, current_value: 2500, target_value: 10000, unit: "subscribers", video_format: "any", steps: [], start_date: null, due_date: null,
  created_at: "2026-10-01T09:00:00", updated_at: "2026-10-01T09:00:00", ...patch,
});

describe("GoalCard", () => {
  it("shows a percentage circle for ring goals and opens the drawer", () => {
    render(<GoalCard goal={goal({})} channel={undefined} />);
    expect(screen.getByText("Reach 10K subscribers")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("2,500 / 10K subscribers")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(useUI.getState().openGoalId).toBe("g1");
  });

  it("shows step progress for projects and hides tracking for plain plans", () => {
    const steps = [{ id: "a", label: "Script", done: true }, { id: "b", label: "Film", done: false }];
    const { rerender } = render(<GoalCard goal={goal({ kind: "project", measure: "steps", display: "bar", steps })} channel={undefined} />);
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 steps")).toBeInTheDocument();
    expect(screen.queryByText("50%")).not.toBeInTheDocument();

    rerender(<GoalCard goal={goal({ kind: "plan", measure: "none", notes: "Launch a podcast in spring" })} channel={undefined} />);
    expect(screen.getByText("Launch a podcast in spring")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("reads live followers from the channel", () => {
    const channel = { id: "a", followers: 15000, platform: "youtube" } as Account;
    render(<GoalCard goal={goal({ measure: "followers", account_id: "a", target_value: 20000, unit: "" })} channel={channel} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("15K / 20K subscribers")).toBeInTheDocument();
  });
});
