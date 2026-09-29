// @vitest-environment node

import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import { createSeededDatabase, sqliteAdapter, TEACHER, OTHER_TEACHER, STUDENT } from "@/lib/db/test-database";
import { outlineFromText } from "@/lib/compose";
import { POST } from "./route";

const state = vi.hoisted(() => ({ adapter: null as unknown, user: null as SessionUser | null }));
vi.mock("@/lib/db/d1-adapter", () => ({ getD1QueryAdapter: () => state.adapter }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/tenancy", () => ({ DEFAULT_TENANT_ID: "tenant_edsync_default", resolveTenantContext: vi.fn(async () => ({ tenant: { id: "tenant-1" }, membership: null })) }));
vi.mock("@/lib/permissions", () => ({ PERMISSIONS: { coursesAuthor: "courses.author", coursesPublish: "courses.publish" }, requirePermission: vi.fn(async () => undefined) }));

let db: DatabaseSync;
let batch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  db = createSeededDatabase();
  db.exec("CREATE TABLE tenant_object_links (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, portal_id TEXT, object_table TEXT NOT NULL, object_id TEXT NOT NULL)");
  db.prepare("INSERT INTO tenant_object_links (id, tenant_id, object_table, object_id) VALUES (?, ?, 'classes', ?)").run("link-class-1", "tenant-1", "class-1");
  const adapter = sqliteAdapter(db);
  batch = vi.fn(adapter.batch);
  state.adapter = { ...adapter, batch };
  state.user = TEACHER;
});

function post(body: unknown) {
  return POST(new Request("http://localhost/api/lessons/compose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

const outline = outlineFromText("Photosynthesis\n\n## Core idea\nPlants use light, water, and carbon dioxide to make sugar.\n\nWhich gas do plants absorb?\na) Oxygen\nb) Carbon dioxide\nc) Nitrogen\nAnswer: b");

describe("compose lesson", () => {
  it("saves lesson, sections, questions and assignment in one batch", async () => {
    const response = await post({ outline, classId: "class-1", publish: true });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(batch).toHaveBeenCalledTimes(1);
    const lesson = db.prepare("SELECT * FROM lessons WHERE id = ?").get(body.lessonId) as Record<string, unknown>;
    expect(lesson).toMatchObject({ teacher_id: TEACHER.id, class_id: "class-1", status: "published", title: "Photosynthesis" });
    expect(db.prepare("SELECT tenant_id FROM tenant_object_links WHERE object_table = 'lessons' AND object_id = ?").get(body.lessonId)).toEqual({ tenant_id: "tenant-1" });
    expect(db.prepare("SELECT COUNT(*) AS n FROM lesson_sections WHERE lesson_id = ?").get(body.lessonId)).toEqual({ n: expect.any(Number) });
    expect((db.prepare("SELECT COUNT(*) AS n FROM lesson_assignments WHERE lesson_id = ?").get(body.lessonId) as { n: number }).n).toBe(1);
  });

  it("rejects another teacher's class without writing anything", async () => {
    const before = (db.prepare("SELECT COUNT(*) AS n FROM lessons").get() as { n: number }).n;
    const response = await post({ outline, classId: "class-2", publish: true });
    expect(response.status).toBe(403);
    expect((db.prepare("SELECT COUNT(*) AS n FROM lessons").get() as { n: number }).n).toBe(before);
    expect(batch).not.toHaveBeenCalled();
  });

  it("requires a teacher and a meaningful outline", async () => {
    state.user = STUDENT;
    expect((await post({ outline })).status).toBe(403);
    state.user = OTHER_TEACHER;
    expect((await post({ outline: { title: "Empty", sections: [] } })).status).toBe(400);
  });
});
