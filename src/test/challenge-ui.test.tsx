import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), navigate: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: api.from } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => api.navigate,
}));

import { ActiveRuns } from "@/components/active-runs";
import { ChallengeCard } from "@/components/challenge-card";
import { periodKey, type Challenge } from "@/lib/challenges";
import type { ContentItem } from "@/lib/queries";
import { useUI } from "@/lib/store";

const wrap = (ui: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

const challenge = (patch: Partial<Challenge>): Challenge => ({
  id: "c1", user_id: "u", account_id: null, title: "Publish 4 videos", kind: "publish", period: "week", target: 4, format: null,
  progress: 0, progress_period: null, archived_at: null, created_at: "2026-10-01T09:00:00", updated_at: "2026-10-01T09:00:00",
  ...patch,
});
const noHistory = { streak: 0, best: 0, wins: 0 };

describe("ChallengeCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.from.mockReturnValue({ update: api.update });
    api.update.mockReturnValue({ eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) });
  });

  it("shows the period badge, progress blocks, summary and streak", () => {
    wrap(<ChallengeCard challenge={challenge({})} progress={{ current: 1, goal: 4, done: false, summary: "1 of 4 videos published this week" }} history={{ streak: 3, best: 3, wins: 5 }} />);
    expect(screen.getByText("Publish 4 videos")).toBeInTheDocument();
    expect(screen.getByText(/Weekly · /)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "1 of 4" })).toBeInTheDocument();
    expect(screen.getByText("3 wk streak")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("marks finished challenges as completed", () => {
    wrap(<ChallengeCard challenge={challenge({ kind: "time_limit", period: "month", target: 5 })} progress={{ current: 2, goal: 2, done: true, summary: "2 of 2 videos hit the target" }} history={noHistory} />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText(/Monthly · /)).toBeInTheDocument();
  });

  it("adds manual progress to the current period", async () => {
    const c = challenge({ kind: "manual", title: "Reply to comments", target: 5 });
    wrap(<ChallengeCard challenge={c} progress={{ current: 0, goal: 5, done: false, summary: "0 of 5 done" }} history={noHistory} />);
    fireEvent.click(screen.getByRole("button", { name: "Add progress to Reply to comments" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ progress: 1, progress_period: periodKey("week", new Date()) }));
  });
});

describe("ActiveRuns", () => {
  const item = (patch: Partial<ContentItem>): ContentItem => ({
    id: "v", title: "Video", stage: "scripting", account_id: null, publish_at: null, due_date: "2099-10-30", created_at: "", updated_at: "",
    user_id: "u", format: "long_video", notes: null, parent_id: null, platforms: [], position: 0, priority: "medium", script_url: null,
    tags: [], thumbnail_concepts: null, title_options: [], minutes_logged: 250, creation_started_at: null, creation_finished_at: null, workflow_done: [], ref_url: null, resources: [], thumbnail_path: null, thumbnail_url: null, ...patch,
  });

  it("shows in-progress videos with stage and time logged, skipping ideas and published ones", () => {
    wrap(<ActiveRuns isLoading={false} items={[item({}), item({ id: "i", title: "Just an idea", stage: "idea" }), item({ id: "p", title: "Out already", stage: "published" })]} />);
    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.getByText("Stage 3 · Scripting")).toBeInTheDocument();
    expect(screen.getByText("4h 10m logged")).toBeInTheDocument();
    expect(screen.getByText("due Oct 30")).toBeInTheDocument();
    expect(screen.queryByText("Just an idea")).not.toBeInTheDocument();
    expect(screen.queryByText("Out already")).not.toBeInTheDocument();
  });

  it("puts the focus video first and opens it in the workspace", () => {
    useUI.setState({ focusId: "b" });
    wrap(<ActiveRuns isLoading={false} items={[item({ id: "a", title: "First due" }), item({ id: "b", title: "My focus", due_date: null, workflow_done: ["topic", "outline"] })]} />);
    const cards = screen.getAllByRole("button");
    expect(cards[0]).toHaveTextContent("Focus");
    expect(cards[0]).toHaveTextContent("My focus");
    expect(screen.getByText("2/13 tasks")).toBeInTheDocument();
    fireEvent.click(cards[1]!);
    expect(useUI.getState().focusId).toBe("a");
    expect(api.navigate).toHaveBeenCalledWith({ to: "/pipeline" });
    useUI.setState({ focusId: null });
  });

  it("explains how to start a run when nothing is in progress", () => {
    wrap(<ActiveRuns isLoading={false} items={[]} />);
    expect(screen.getByText(/No videos in progress/)).toBeInTheDocument();
  });
});
