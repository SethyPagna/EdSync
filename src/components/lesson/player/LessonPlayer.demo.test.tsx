import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveProgress: vi.fn(), submitFinal: vi.fn(), checkAnswer: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./SectionContent", () => ({ default: () => <p>Sample lesson content</p> }));
vi.mock("./LessonSheet", () => ({ default: () => null }));
vi.mock("./api", async (importOriginal) => ({
  ...await importOriginal<typeof import("./api")>(),
  ...mocks,
  loadQuestions: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/edsync/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "sample-learner" } }, error: null }) },
    from: (table: string) => {
      const rows: Record<string, unknown> = {
        lessons: { id: "sample", title: "Sample biology" },
        lesson_sections: [{ id: "s1", title: "First section" }, { id: "s2", title: "Second section" }],
        glossary_terms: [],
        student_progress: null,
      };
      const result = { data: rows[table], error: null };
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => result,
        maybeSingle: async () => result,
        order: async () => result,
      };
      return query;
    },
  }),
}));

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("opens and navigates read-only demo lessons without saving progress", async () => {
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
  mocks.saveProgress.mockRejectedValue(new Error("This sample workspace is read-only."));
  const { default: LessonPlayer } = await import("./LessonPlayer");
  render(<LessonPlayer lessonId="sample" />);

  expect(await screen.findByRole("heading", { name: "First section" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByRole("heading", { name: "Second section" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("button", { name: "Finish lesson" })).toBeDisabled();
  expect(screen.getByText("This sample is read-only. Progress and quiz answers are not saved.")).toBeInTheDocument();
  expect(mocks.saveProgress).not.toHaveBeenCalled();
  expect(mocks.submitFinal).not.toHaveBeenCalled();
  expect(mocks.checkAnswer).not.toHaveBeenCalled();
});
