import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StudentDiscussionWorkspace from "./StudentDiscussionWorkspace";
import { listDiscussions, loadDiscussionPosts, sendDiscussionPost } from "./api";

vi.mock("./api", () => ({
  listDiscussions: vi.fn(),
  loadDiscussionPosts: vi.fn(),
  sendDiscussionPost: vi.fn(),
}));

const thread = {
  id: "thread-1",
  work_item_id: "work-1",
  class_id: "class-1",
  class_name: "Biology",
  title: "Pond ecosystem",
  prompt: "What happens when plants disappear?",
  is_locked: 0,
  post_count: 1,
  updated_at: "2026-09-29T08:00:00Z",
};

const post = {
  id: "post-1",
  thread_id: "thread-1",
  author_id: "teacher-1",
  parent_id: null,
  body: "Think about the food web.",
  full_name: "Tara Teacher",
  role: "teacher",
  created_at: "2026-09-29T08:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/student/discussions");
  vi.mocked(listDiscussions).mockResolvedValue([thread]);
  vi.mocked(loadDiscussionPosts).mockResolvedValue([post]);
  vi.mocked(sendDiscussionPost).mockResolvedValue({ id: "post-2" });
});

describe("student discussions", () => {
  it("opens assigned discussion work and posts a reply to the visible thread", async () => {
    render(<StudentDiscussionWorkspace classId="class-1" workItemId="work-1" />);

    expect(await screen.findByText("Think about the food web.")).toBeInTheDocument();
    expect(listDiscussions).toHaveBeenCalledWith("class-1");
    expect(loadDiscussionPosts).toHaveBeenCalledWith("thread-1");
    expect(screen.getByText("What happens when plants disappear?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your post" }), { target: { value: "The fish lose their shelter." } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => {
      expect(sendDiscussionPost).toHaveBeenCalledWith("thread-1", "The fish lose their shelter.", "post-1");
      expect(loadDiscussionPosts).toHaveBeenCalledTimes(2);
    });
  });

  it("does not offer a composer when a discussion is locked", async () => {
    vi.mocked(listDiscussions).mockResolvedValue([{ ...thread, is_locked: 1 }]);
    render(<StudentDiscussionWorkspace threadId="thread-1" />);

    expect(await screen.findByText("This discussion is locked.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Your post" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  });

  it("shows an unavailable state for work that has no accessible thread", async () => {
    render(<StudentDiscussionWorkspace workItemId="missing-work" />);
    expect(await screen.findByText("Discussion unavailable")).toBeInTheDocument();
    expect(loadDiscussionPosts).not.toHaveBeenCalled();
  });
});
