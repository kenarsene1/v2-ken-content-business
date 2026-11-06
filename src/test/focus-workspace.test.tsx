import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "@/lib/queries";

const api = vi.hoisted(() => ({ mutate: vi.fn(), save: vi.fn(), items: [] as unknown[], sponsors: new Map<string, string>(), steps: null as unknown }));
vi.mock("@/lib/queries", () => ({
  useScopedContent: () => ({ data: api.items, isLoading: false }),
  useUpdateContent: () => ({ mutate: api.mutate }),
  useSponsors: () => api.sponsors,
  useWorkflow: () => ({ steps: api.steps, custom: false, editable: true }),
  useSaveWorkflow: () => ({ mutate: api.save }),
  useStages: () => ({ stages: DEFAULT_STAGES, editable: true }),
}));
vi.mock("@/components/app-shell", () => ({ useNewContent: () => vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

import { FocusWorkspace } from "@/components/focus-workspace";
import { useUI } from "@/lib/store";
import { WORKFLOW, type WorkflowStep } from "@/lib/workflow";
import { DEFAULT_STAGES } from "@/lib/stages";

const video = (patch: Partial<ContentItem> = {}): ContentItem => ({
  id: "v", title: "AI app in 10 minutes", stage: "idea", account_id: null, publish_at: null, due_date: null, created_at: "", updated_at: "",
  user_id: "u", format: "long_video", notes: null, parent_id: null, platforms: [], position: 0, priority: "medium", script_url: null,
  tags: [], thumbnail_concepts: null, title_options: [], minutes_logged: 0, creation_started_at: null, creation_finished_at: null,
  workflow_done: [], ref_url: null, resources: [], thumbnail_path: null, thumbnail_url: null, ...patch,
});

describe("FocusWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.steps = WORKFLOW;
    useUI.setState({ focusId: null, accountId: null });
  });

  it("shows one video with the current step's tasks, tips and times", () => {
    api.items = [video()];
    render(<FocusWorkspace />);
    expect(screen.getByText("AI app in 10 minutes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start creation/ })).toBeInTheDocument();
    expect(screen.getByText("Lock the topic or collab")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "~10m" })).toBeInTheDocument();
    expect(screen.getByText("· Pick from the idea bank")).toBeInTheDocument();
    expect(screen.queryByText("Record the tool walkthrough")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pipeline/ })).toHaveAttribute("href", "/pipeline/board");
  });

  it("starts the clock and moves the stage when creation starts", () => {
    api.items = [video()];
    render(<FocusWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /Start creation/ }));
    const patch = api.mutate.mock.calls[0]![0].patch;
    expect(patch.stage).toBe("researching");
    expect(typeof patch.creation_started_at).toBe("string");
    expect(useUI.getState().focusId).toBe("v");
  });

  it("checks a task, starting the clock on the first one", () => {
    api.items = [video({ stage: "researching" })];
    render(<FocusWorkspace />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Lock the topic/ }));
    const patch = api.mutate.mock.calls[0]![0].patch;
    expect(patch.workflow_done).toEqual(["topic"]);
    expect(typeof patch.creation_started_at).toBe("string");
  });

  it("shows the finished time once a video is created", () => {
    api.items = [video({ stage: "scheduled", creation_started_at: "2026-10-25T09:00:00Z", creation_finished_at: "2026-10-25T14:20:00Z" })];
    render(<FocusWorkspace />);
    expect(screen.getByText(/Created in 5h 20m/)).toBeInTheDocument();
  });

  it("changes a task's time by clicking it", () => {
    api.items = [video()];
    render(<FocusWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "~10m" }));
    const input = screen.getByRole("spinbutton", { name: "Minutes" });
    fireEvent.change(input, { target: { value: "25" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const saved = api.save.mock.calls[0]![0] as WorkflowStep[];
    expect(saved[0]!.tasks[0]).toMatchObject({ id: "topic", minutes: 25 });
    expect(api.mutate).not.toHaveBeenCalled();
  });

  it("edits, adds and removes tasks from the right-click menu", async () => {
    api.items = [video()];
    render(<FocusWorkspace />);
    const row = () => screen.getByRole("checkbox", { name: "Outline talking points" }).closest("li")!;

    fireEvent.contextMenu(row());
    fireEvent.click(screen.getByRole("menuitem", { name: /Remove task/ }));
    expect((api.save.mock.calls[0]![0] as WorkflowStep[])[0]!.tasks.map((t) => t.id)).toEqual(["topic", "assets"]);

    fireEvent.contextMenu(row());
    fireEvent.click(screen.getByRole("menuitem", { name: /Edit task/ }));
    const input = await screen.findByRole("textbox", { name: "Task name" });
    fireEvent.change(input, { target: { value: "Bullet the talking points" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect((api.save.mock.calls[1]![0] as WorkflowStep[])[0]!.tasks[1]).toMatchObject({ id: "outline", label: "Bullet the talking points" });

    fireEvent.contextMenu(row());
    fireEvent.click(screen.getByRole("menuitem", { name: /Add task below/ }));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(3));
    expect((api.save.mock.calls[2]![0] as WorkflowStep[])[0]!.tasks.map((t) => t.label)).toEqual([
      "Lock the topic or collab", "Outline talking points", "New task", "Prepare tools, clips & prompts",
    ]);
  });

  it("marks only sponsored videos", () => {
    api.items = [video()];
    const { unmount } = render(<FocusWorkspace />);
    expect(screen.queryByText("Sponsored")).not.toBeInTheDocument();
    unmount();
    api.sponsors = new Map([["v", "Notion"]]);
    render(<FocusWorkspace />);
    expect(screen.getByTitle("Sponsored by Notion")).toHaveTextContent("Sponsored");
    api.sponsors = new Map();
  });

  it("offers a way to start when nothing is in progress", () => {
    api.items = [video({ stage: "published" })];
    render(<FocusWorkspace />);
    expect(screen.getByText("Nothing in progress")).toBeInTheDocument();
  });
});
