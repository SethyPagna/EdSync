// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, HttpError } from "@/lib/security/http-errors";

const mocks = vi.hoisted(() => ({
  item: { id: "course-1" } as { id: string } | null,
  enroll: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => ({ id: "student-1", email: "student@example.com", user_metadata: { role: "student" } }),
}));
vi.mock("@/lib/catalog", () => ({
  getPublicCatalogItem: async () => mocks.item,
  enrollCatalogItem: mocks.enroll,
}));

import { POST } from "./route";

function enroll() {
  return POST(new Request("http://localhost/api/catalog/course-1/enroll", { method: "POST" }), {
    params: Promise.resolve({ id: "course-1" }),
  });
}

describe("POST /api/catalog/[id]/enroll", () => {
  beforeEach(() => {
    mocks.item = { id: "course-1" };
    mocks.enroll.mockReset();
  });

  it("preserves missing-item and enrollment conflict statuses", async () => {
    mocks.item = null;
    expect((await enroll()).status).toBe(404);
    mocks.item = { id: "course-1" };
    mocks.enroll.mockRejectedValue(new ConflictError("This course is not open for enrollment."));
    const conflict = await enroll();
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toBe("This course is not open for enrollment.");
  });

  it("preserves upstream checkout errors", async () => {
    mocks.enroll.mockRejectedValue(new HttpError(502, "Checkout is temporarily unavailable."));
    const response = await enroll();
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("Checkout is temporarily unavailable.");
  });
});
