import { describe, expect, it } from "vitest";
import {
  evaluateWorkSubmission,
  normalizeWorkSubmissionPolicy,
  parseWorkDueAt,
  validateWorkDueAt,
  WORK_MAX_ATTEMPTS_LIMIT,
} from "@/lib/work/policy";

const NOW = Date.parse("2026-09-28T12:00:00Z");
const open = { allowResubmission: false, maxAttempts: null };

describe("work submission policy", () => {
  it("normalizes resubmission settings", () => {
    expect(normalizeWorkSubmissionPolicy(null)).toEqual({ allowResubmission: false, maxAttempts: null });
    expect(normalizeWorkSubmissionPolicy('{"allowResubmission":true,"maxAttempts":"3"}')).toEqual({
      allowResubmission: true,
      maxAttempts: 3,
    });
    expect(normalizeWorkSubmissionPolicy({ allowResubmission: "yes", maxAttempts: 0 })).toEqual({
      allowResubmission: false,
      maxAttempts: null,
    });
    expect(normalizeWorkSubmissionPolicy({ maxAttempts: 10_000 }).maxAttempts).toBe(WORK_MAX_ATTEMPTS_LIMIT);
  });

  it("parses stored due dates", () => {
    expect(parseWorkDueAt("2026-09-28T10:00:00Z")).toBe(Date.parse("2026-09-28T10:00:00Z"));
    expect(parseWorkDueAt("2026-09-28T10:00:00+02:00")).toBe(Date.parse("2026-09-28T08:00:00Z"));
    expect(parseWorkDueAt("2026-09-28T10:00")).toBe(Date.parse("2026-09-28T10:00:00Z"));
    expect(parseWorkDueAt("2026-09-28 10:00:00")).toBe(Date.parse("2026-09-28T10:00:00Z"));
    expect(parseWorkDueAt("2026-09-28")).toBe(Date.parse("2026-09-28T23:59:59Z"));
    expect(parseWorkDueAt("next week")).toBeNull();
    expect(parseWorkDueAt(null)).toBeNull();
  });

  it("validates due dates sent by teachers", () => {
    expect(validateWorkDueAt("")).toBeNull();
    expect(validateWorkDueAt(null)).toBeNull();
    expect(validateWorkDueAt(" 2026-10-01T09:00 ")).toBe("2026-10-01T09:00");
    expect(validateWorkDueAt("2026-10-01")).toBe("2026-10-01");
    expect(validateWorkDueAt("2026-10-01T09:00Z")).toBe("2026-10-01T09:00:00.000Z");
    expect(validateWorkDueAt(" 2026-10-01T09:00:00+02:00")).toBe("2026-10-01T07:00:00.000Z");
    expect(() => validateWorkDueAt("tomorrow")).toThrow("valid due date");
    expect(() => validateWorkDueAt("  ")).toThrow("valid due date");
    expect(() => validateWorkDueAt(42)).toThrow("valid due date");
  });

  it("never enforces a due date without a zone before the student's local deadline", () => {
    const decide = (dueAt: string, now: string, allowLate = false) =>
      evaluateWorkSubmission({ now: Date.parse(now), dueAt, allowLate, policy: open, existing: null });
    // 10:00 local is 22:00Z at the latest (UTC-12).
    expect(decide("2030-01-01T10:00", "2030-01-01T12:00:00Z")).toEqual({ ok: true, attemptNumber: 1, late: false });
    expect(decide("2030-01-01T10:00", "2030-01-01T22:00:00Z")).toEqual({ ok: true, attemptNumber: 1, late: false });
    expect(decide("2030-01-01T10:00", "2030-01-01T22:01:00Z")).toEqual({
      ok: false,
      status: 403,
      error: "The due date has passed.",
    });
    expect(decide("2030-01-01T10:00", "2030-01-01T22:01:00Z", true)).toEqual({ ok: true, attemptNumber: 1, late: true });
    expect(decide("2030-01-01", "2030-01-02T11:59:00Z")).toMatchObject({ ok: true, late: false });
    expect(decide("2030-01-01", "2030-01-02T12:00:00Z")).toMatchObject({ ok: false, status: 403 });
  });

  it("enforces a due date with a zone exactly", () => {
    const decide = (dueAt: string, now: string) =>
      evaluateWorkSubmission({ now: Date.parse(now), dueAt, allowLate: false, policy: open, existing: null });
    expect(decide("2030-01-01T10:00Z", "2030-01-01T12:00:00Z")).toEqual({
      ok: false,
      status: 403,
      error: "The due date has passed.",
    });
    expect(decide("2030-01-01T10:00:00-05:00", "2030-01-01T14:59:00Z")).toMatchObject({ ok: true, late: false });
    expect(decide("2030-01-01T10:00:00-05:00", "2030-01-01T15:01:00Z")).toMatchObject({ ok: false, status: 403 });
  });

  it("accepts on-time submissions", () => {
    expect(
      evaluateWorkSubmission({ now: NOW, dueAt: "2026-09-29T00:00:00Z", allowLate: false, policy: open, existing: null }),
    ).toEqual({ ok: true, attemptNumber: 1, late: false });
  });

  it("rejects late submissions when late work is off", () => {
    expect(
      evaluateWorkSubmission({ now: NOW, dueAt: "2026-09-27T23:00:00Z", allowLate: false, policy: open, existing: null }),
    ).toEqual({ ok: false, status: 403, error: "The due date has passed." });
  });

  it("marks late submissions when late work is allowed", () => {
    expect(
      evaluateWorkSubmission({ now: NOW, dueAt: "2026-09-27T23:00:00Z", allowLate: true, policy: open, existing: null }),
    ).toEqual({ ok: true, attemptNumber: 1, late: true });
  });

  it("blocks resubmission after grading unless it is allowed", () => {
    const existing = { status: "graded", attempts: 1 };
    expect(evaluateWorkSubmission({ now: NOW, dueAt: null, allowLate: true, policy: open, existing })).toEqual({
      ok: false,
      status: 409,
      error: "This work is already graded.",
    });
    expect(
      evaluateWorkSubmission({
        now: NOW,
        dueAt: null,
        allowLate: true,
        policy: { allowResubmission: true, maxAttempts: null },
        existing,
      }),
    ).toEqual({ ok: true, attemptNumber: 2, late: false });
  });

  it("allows resubmitting ungraded work and numbers attempts", () => {
    expect(
      evaluateWorkSubmission({ now: NOW, dueAt: null, allowLate: true, policy: open, existing: { status: "submitted", attempts: 2 } }),
    ).toEqual({ ok: true, attemptNumber: 3, late: false });
  });

  it("enforces the attempt cap", () => {
    expect(
      evaluateWorkSubmission({
        now: NOW,
        dueAt: null,
        allowLate: true,
        policy: { allowResubmission: true, maxAttempts: 2 },
        existing: { status: "submitted", attempts: 2 },
      }),
    ).toEqual({ ok: false, status: 409, error: "No attempts left." });
  });
});
