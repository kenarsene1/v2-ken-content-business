import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rows: [] as unknown[], goals: [] as unknown[], create: vi.fn() }));
vi.mock("@/lib/queries", () => ({
  isMissingTableError: () => false,
  useChallengeRows: () => ({ rows: api.rows, isLoading: false, error: null, refetch: vi.fn() }),
  useCreateChallenge: () => ({ mutateAsync: api.create, isPending: false }),
  useStepChallenge: () => ({ mutate: vi.fn() }),
  useScopedGoals: () => ({ data: api.goals, isLoading: false, error: null, refetch: vi.fn() }),
  useAccounts: () => ({ data: [] }),
  useContent: () => ({ data: [] }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search }: { children: ReactNode; to: string; search?: { view?: string } }) => <a href={search?.view ? `${to}?view=${search.view}` : to}>{children}</a>,
}));

import { ChallengesPanel } from "@/components/challenges-panel";
import { DashboardChallenges } from "@/components/challenges-section";
import { useUI } from "@/lib/store";

const challenge = (id: string, title: string, current: number, goal: number, streak = 0) => ({
  challenge: { id, title, kind: "publish", period: "week", target: goal, format: null, archived_at: null, created_at: `2026-11-0${id.length}T00:00:00Z` },
  progress: { current, goal, done: current >= goal, summary: `${current} of ${goal}` },
  history: { streak, best: streak, wins: 2 },
});

describe("Challenges inside Goals & plans", () => {
  beforeEach(() => { api.rows = []; api.create.mockResolvedValue({ id: "new" }); useUI.setState({ accountId: null, openChallengeId: null }); });

  it("keeps the Start a challenge row on one line, without the stats boxes", () => {
    render(<ChallengesPanel />);
    const start = screen.getByRole("region", { name: "Start a challenge" });
    expect(start).toHaveClass("overflow-x-auto");
    expect(within(start).getByRole("heading", { name: "Start a challenge" })).toBeInTheDocument();
    expect(within(start).getByRole("button", { name: /Publish 4 videos · weekly/ })).toBeInTheDocument();
    expect(within(start).getByRole("button", { name: /Custom/ })).toBeInTheDocument();
    expect(screen.queryByText("Best streak")).not.toBeInTheDocument();
    expect(screen.queryByText("Total wins")).not.toBeInTheDocument();
  });

  it("starts a challenge from a template, and Custom opens it", async () => {
    render(<ChallengesPanel />);
    fireEvent.click(screen.getByRole("button", { name: /Custom/ }));
    await vi.waitFor(() => expect(useUI.getState().openChallengeId).toBe("new"));
    expect(api.create).toHaveBeenCalledTimes(1);
  });
});

describe("Dashboard: Challenges", () => {
  beforeEach(() => { useUI.setState({ accountId: null }); });

  it("shows challenges with progress, streak and wins, linking into Goals & plans", () => {
    api.rows = [challenge("a", "Publish 4 videos", 2, 4, 3), challenge("bb", "Publish 3 Shorts", 3, 3)];
    render(<DashboardChallenges />);
    const card = screen.getByRole("region", { name: "Challenges" });
    expect(card).toHaveTextContent("1 of 2 cleared");
    expect(within(card).getByTitle("Best current streak")).toHaveTextContent("3");
    expect(within(card).getByTitle("Total wins")).toHaveTextContent("4");
    expect(within(card).getByText("2/4")).toBeInTheDocument();
    expect(within(card).getByText("Cleared")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /New challenge/ })).toHaveAttribute("href", "/goals?view=challenges");
  });

  it("invites you to start one when there are none", () => {
    api.rows = [];
    render(<DashboardChallenges />);
    expect(screen.getByRole("link", { name: /Start a challenge/ })).toBeInTheDocument();
  });
});
