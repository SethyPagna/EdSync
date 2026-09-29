export type DiscussionThread = {
  id: string;
  work_item_id: string | null;
  class_id: string | null;
  class_name: string | null;
  title: string;
  prompt: string | null;
  is_locked: number;
  post_count: number;
  updated_at: string;
};

export type DiscussionPost = {
  id: string;
  thread_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

type Envelope<T> = { data?: T; error?: string | { message?: string } | null };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const payload = await response.json().catch(() => null) as Envelope<T> | null;
  if (!response.ok || !payload?.data || payload.error) {
    const message = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
    throw new Error(message || `Request failed (${response.status}).`);
  }
  return payload.data;
}

export async function listDiscussions(classId?: string): Promise<DiscussionThread[]> {
  const suffix = classId ? `?classId=${encodeURIComponent(classId)}` : "";
  const data = await request<{ threads: DiscussionThread[] }>(`/api/discussions${suffix}`);
  return data.threads;
}

export async function loadDiscussionPosts(threadId: string): Promise<DiscussionPost[]> {
  const data = await request<{ posts: DiscussionPost[] }>(`/api/discussions?threadId=${encodeURIComponent(threadId)}`);
  return data.posts;
}

export async function sendDiscussionPost(threadId: string, body: string, parentId?: string) {
  return request<{ id: string }>("/api/discussions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, body, ...(parentId ? { parentId } : {}) }),
  });
}
