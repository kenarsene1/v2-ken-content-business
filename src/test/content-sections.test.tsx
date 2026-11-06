import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChecklistItem } from "@/lib/queries";

const api = vi.hoisted(() => ({ toggle: vi.fn(), add: vi.fn(), rename: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/queries", () => ({
  useToggleChecklist: () => ({ mutate: api.toggle }),
  useAddChecklistItem: () => ({ mutate: api.add }),
  useRenameChecklistItem: () => ({ mutate: api.rename }),
  useRemoveChecklistItem: () => ({ mutate: api.remove }),
  useSetThumbnail: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateContent: () => ({ mutate: vi.fn() }),
  useLibraryItems: () => ({ data: [] }),
  useFileUrl: () => ({ data: undefined }),
  openPrivateFile: vi.fn(),
}));

import { TaskChecklist } from "@/components/content-drawer-sections";
import { RefLink } from "@/components/ref-link";

const check = (id: string, label: string, done = false) => ({ id, label, done, content_item_id: "v", position: 0 }) as ChecklistItem;

describe("Task checklist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the renamed heading and adds your own tasks", () => {
    render(<TaskChecklist videoId="v" checks={[check("a", "Script", true), check("b", "Record")]} />);
    expect(screen.getByText("Task checklist · 1/2")).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "New task" });
    fireEvent.change(input, { target: { value: "Color grade" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(api.add).toHaveBeenCalledWith({ content_item_id: "v", label: "Color grade", position: 2 });
  });

  it("renames and removes a task from the right-click menu", async () => {
    render(<TaskChecklist videoId="v" checks={[check("a", "Script")]} />);
    fireEvent.contextMenu(screen.getByText("Script").closest("li")!);
    fireEvent.click(screen.getByRole("menuitem", { name: /Rename/ }));
    const input = await screen.findByRole("textbox", { name: "Task name" });
    fireEvent.change(input, { target: { value: "Write script" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(api.rename).toHaveBeenCalledWith({ id: "a", label: "Write script" });

    fireEvent.contextMenu(screen.getByText("Script").closest("li")!);
    fireEvent.click(screen.getByRole("menuitem", { name: /Remove/ }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("a"));
  });
});

describe("RefLink", () => {
  it("shows a small ref link only when there is a reference", () => {
    const { rerender } = render(<RefLink url={null} />);
    expect(screen.queryByText("ref")).not.toBeInTheDocument();
    rerender(<RefLink url="https://www.tiktok.com/@creator/video/1" />);
    expect(screen.getByRole("link", { name: "ref" })).toHaveAttribute("href", "https://www.tiktok.com/@creator/video/1");
  });
});
