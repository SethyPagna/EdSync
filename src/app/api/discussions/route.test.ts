// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import {
  OTHER_STUDENT,
  STUDENT,
  TEACHER,
  createGradingDatabase,
  insertRows,
  selectAll,
  sqliteAdapter,
} from "@/lib/grades/test-support";
import { GET, POST } from "./route";

const state = vi.hoisted(() => ({
  adapter: null as unknown,
  user: null as SessionUser | null,
  tenantId: "tenant_edsync_default",
  membership: null as { status: string } | null,
}));

vi.mock("@/lib/db/d1-adapter", () => ({ getD1QueryAdapter: () => state.adapter }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  resolveTenantContext: async () => ({ tenant: { id: state.tenantId }, portal: null, membership: state.membership }),
  linkTenantObject: async () => undefined,
}));

let db: DatabaseSync;

beforeEach(() => {
  db = createGradingDatabase();
  state.adapter = sqliteAdapter(db);
  state.user = STUDENT;
  state.tenantId = "tenant_edsync_default";
  state.membership = null;
  insertRows(db, "discussion_threads", [
    { id: "thread-1", class_id: "class-1", teacher_id: TEACHER.id, title: "Pond ecosystem", prompt: "What happens if the plants disappear?" },
  ]);
  insertRows(db, "tenant_object_links", [
    { id: "class-link", tenant_id: "tenant_edsync_default", object_table: "classes", object_id: "class-1" },
    { id: "thread-link", tenant_id: "tenant_edsync_default", object_table: "discussion_threads", object_id: "thread-1" },
  ]);
  insertRows(db, "discussion_posts", [
    { id: "class-post", thread_id: "thread-1", author_id: TEACHER.id, body: "Discuss the ecosystem.", visibility: "class" },
    { id: "other-private", thread_id: "thread-1", author_id: OTHER_STUDENT.id, body: "Private note", visibility: "private" },
    { id: "teacher-only", thread_id: "thread-1", author_id: TEACHER.id, body: "Teacher note", visibility: "teacher" },
    { id: "own-private", thread_id: "thread-1", author_id: STUDENT.id, body: "My private note", visibility: "private" },
    { id: "own-teacher", thread_id: "thread-1", author_id: STUDENT.id, body: "Question for teacher", visibility: "teacher" },
  ]);
});

const list = () => GET(new Request("http://localhost/api/discussions"));
const posts = () => GET(new Request("http://localhost/api/discussions?threadId=thread-1"));
const reply = (parentId: string) => POST(new Request("http://localhost/api/discussions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ threadId: "thread-1", parentId, body: "My reply" }),
}), undefined);

describe("discussion visibility", () => {
  it("returns only posts the learner may read and counts only those posts", async () => {
    const threadResponse = await list();
    expect(threadResponse.status).toBe(200);
    const threadPayload = await threadResponse.json() as { data: { threads: Array<{ post_count: number }> } };
    expect(threadPayload.data.threads).toHaveLength(1);
    expect(threadPayload.data.threads[0].post_count).toBe(3);

    const postResponse = await posts();
    expect(postResponse.status).toBe(200);
    const postPayload = await postResponse.json() as { data: { posts: Array<{ id: string }> } };
    expect(postPayload.data.posts.map((post) => post.id).sort()).toEqual(["class-post", "own-private", "own-teacher"]);
  });

  it("lets the thread teacher see teacher posts without exposing another author's private note", async () => {
    state.user = TEACHER;
    const threadResponse = await list();
    const threadPayload = await threadResponse.json() as { data: { threads: Array<{ post_count: number }> } };
    expect(threadPayload.data.threads[0].post_count).toBe(3);
    const response = await posts();
    const payload = await response.json() as { data: { posts: Array<{ id: string }> } };
    expect(payload.data.posts.map((post) => post.id).sort()).toEqual(["class-post", "own-teacher", "teacher-only"]);
  });

  it("rejects replies to a post the learner cannot see", async () => {
    expect((await reply("other-private")).status).toBe(400);
    expect((await reply("teacher-only")).status).toBe(400);
    expect(selectAll(db, "SELECT id FROM discussion_posts WHERE body = 'My reply'")).toEqual([]);

    expect((await reply("class-post")).status).toBe(200);
    expect(selectAll(db, "SELECT parent_id FROM discussion_posts WHERE body = 'My reply'")).toEqual([{ parent_id: "class-post" }]);
  });

  it("keeps the thread inaccessible to a learner outside its class", async () => {
    state.user = OTHER_STUDENT;
    expect((await posts()).status).toBe(404);
    expect((await reply("class-post")).status).toBe(404);
    state.user = null;
    expect((await list()).status).toBe(401);
  });

  it("rejects an organization outsider before reading or posting", async () => {
    state.tenantId = "tenant-school";
    state.user = TEACHER;
    expect((await list()).status).toBe(403);
    expect((await posts()).status).toBe(403);
    expect((await reply("class-post")).status).toBe(403);
    const create = await POST(new Request("https://school.example.test/api/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Unauthorized global thread" }),
    }), undefined);
    expect(create.status).toBe(403);
    expect(selectAll(db, "SELECT id FROM discussion_threads WHERE title = 'Unauthorized global thread'")).toEqual([]);
  });

  it("keeps threads linked to another tenant out of list, reads, and replies", async () => {
    insertRows(db, "tenants", [{ id: "tenant-other", slug: "other", name: "Other school" }]);
    insertRows(db, "discussion_threads", [
      { id: "foreign-thread", class_id: "class-2", teacher_id: TEACHER.id, title: "Foreign thread" },
    ]);
    insertRows(db, "tenant_object_links", [
      { id: "foreign-class-link", tenant_id: "tenant-other", object_table: "classes", object_id: "class-2" },
      { id: "foreign-thread-link", tenant_id: "tenant-other", object_table: "discussion_threads", object_id: "foreign-thread" },
    ]);
    const response = await list();
    const payload = await response.json() as { data: { threads: Array<{ id: string }> } };
    expect(payload.data.threads.map((thread) => thread.id)).toEqual(["thread-1"]);
    expect((await GET(new Request("http://localhost/api/discussions?threadId=foreign-thread"))).status).toBe(404);
    expect((await POST(new Request("http://localhost/api/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: "foreign-thread", body: "Unauthorized post" }),
    }), undefined)).status).toBe(404);
  });
});
