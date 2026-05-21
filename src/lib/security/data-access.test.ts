import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeDataRequest } from "@/lib/security/data-access";
import { d1Query } from "@/lib/db/d1";
import type { SessionUser } from "@/lib/auth/session";

vi.mock("@/lib/db/d1", () => ({
  d1Query: vi.fn(),
}));

const user = {
  id: "teacher-1",
  email: "teacher@example.com",
  user_metadata: { role: "teacher" },
} satisfies SessionUser;

const queryMock = vi.mocked(d1Query);

describe("authorizeDataRequest", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("allows lesson updates when the lesson belongs to the signed-in teacher", async () => {
    queryMock.mockResolvedValueOnce([{ id: "lesson-1" }]);

    await expect(
      authorizeDataRequest(user, {
        table: "lessons",
        action: "update",
        values: { title: "Updated" },
        filters: [{ op: "eq", column: "id", value: "lesson-1" }],
      }),
    ).resolves.toBeNull();
  });

  it("blocks lesson updates when ownership cannot be verified", async () => {
    queryMock.mockResolvedValueOnce([]);

    await expect(
      authorizeDataRequest(user, {
        table: "lessons",
        action: "update",
        values: { title: "Updated" },
        filters: [{ op: "eq", column: "id", value: "lesson-2" }],
      }),
    ).resolves.toBe("Lesson changes must target a lesson owned by the signed-in teacher.");
  });

  it("allows lesson child inserts only when the parent lesson is owned by the teacher", async () => {
    queryMock.mockResolvedValueOnce([{ id: "lesson-1" }]).mockResolvedValueOnce([]);

    await expect(
      authorizeDataRequest(user, {
        table: "lesson_sections",
        action: "insert",
        values: { lesson_id: "lesson-1", title: "Warm up" },
      }),
    ).resolves.toBeNull();

    await expect(
      authorizeDataRequest(user, {
        table: "lesson_sections",
        action: "insert",
        values: { lesson_id: "lesson-2", title: "Warm up" },
      }),
    ).resolves.toBe("Lesson content can only be added to lessons owned by the signed-in teacher.");
  });

  it("allows quiz question deletes by owned lesson id", async () => {
    queryMock.mockResolvedValueOnce([{ id: "lesson-1" }]);

    await expect(
      authorizeDataRequest(user, {
        table: "quiz_questions",
        action: "delete",
        filters: [{ op: "eq", column: "lesson_id", value: "lesson-1" }],
      }),
    ).resolves.toBeNull();
  });
});
