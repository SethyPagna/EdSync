import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("@/lib/tenancy", () => ({ DEFAULT_TENANT_ID: "tenant_edsync_default" }));

import { issueEligibleCertifications } from "./issuance";

let database: DatabaseSync;

beforeEach(() => {
  database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE lessons (id TEXT PRIMARY KEY, class_id TEXT, status TEXT);
    CREATE TABLE classes (id TEXT PRIMARY KEY);
    CREATE TABLE tenant_object_links (id TEXT PRIMARY KEY, tenant_id TEXT, object_table TEXT, object_id TEXT);
    CREATE TABLE tenant_memberships (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, status TEXT);
    CREATE TABLE profiles (id TEXT PRIMARY KEY, role TEXT);
    CREATE TABLE student_progress (id TEXT PRIMARY KEY, student_id TEXT, lesson_id TEXT, status TEXT, completed_at TEXT);
    CREATE TABLE gradebook_scores (id TEXT PRIMARY KEY, student_id TEXT, source_type TEXT, source_id TEXT, status TEXT, percent REAL, graded_at TEXT, updated_at TEXT, created_at TEXT);
    CREATE TABLE certification_rules (id TEXT PRIMARY KEY, tenant_id TEXT, course_id TEXT, expires_after_days INTEGER, settings TEXT);
    CREATE TABLE learner_certifications (id TEXT PRIMARY KEY, tenant_id TEXT, rule_id TEXT, user_id TEXT, status TEXT, issued_at TEXT, expires_at TEXT, evidence TEXT, UNIQUE(rule_id, user_id));
  `);
  mocks.query.mockReset();
  mocks.query.mockImplementation(async (sql: string, params: SQLInputValue[] = []) => database.prepare(sql).all(...params));
});

afterEach(() => database.close());

function addRule(input: { tenant?: string; rule?: string; lesson?: string; settings?: Record<string, unknown>; days?: number | null }) {
  const tenant = input.tenant ?? "tenant-a";
  const rule = input.rule ?? "rule-a";
  const lesson = input.lesson ?? "lesson-a";
  database.prepare("INSERT OR IGNORE INTO lessons VALUES (?, NULL, 'published')").run(lesson);
  database.prepare("INSERT OR IGNORE INTO tenant_object_links VALUES (?, ?, 'lessons', ?)").run(`link:${lesson}`, tenant, lesson);
  database.prepare("INSERT INTO certification_rules VALUES (?, ?, ?, ?, ?)").run(rule, tenant, lesson, input.days ?? null, JSON.stringify(input.settings ?? { evidence: ["completion"] }));
}

function addStudent(tenant: string, student: string, lesson: string, completedAt = "2026-01-01 10:00:00") {
  database.prepare("INSERT OR IGNORE INTO profiles VALUES (?, 'student')").run(student);
  database.prepare("INSERT INTO tenant_memberships VALUES (?, ?, ?, 'active')").run(`${tenant}:${student}`, tenant, student);
  database.prepare("INSERT INTO student_progress VALUES (?, ?, ?, 'completed', ?)").run(`progress:${tenant}:${student}`, student, lesson, completedAt);
}

function count() {
  return (database.prepare("SELECT COUNT(*) AS total FROM learner_certifications").get() as { total: number }).total;
}

describe("certification issuance", () => {
  it("issues only to active students of the tenant with a published linked lesson, then stays idempotent", async () => {
    addRule({});
    addRule({ tenant: "tenant-b", rule: "rule-b", lesson: "lesson-b" });
    addStudent("tenant-a", "student-a", "lesson-a");
    addStudent("tenant-b", "student-b", "lesson-b");
    const first = await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2026-01-02T00:00:00Z") });
    const second = await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2026-01-02T00:00:00Z") });
    expect(first.issued).toBe(1);
    expect(second.issued).toBe(0);
    expect(count()).toBe(1);
    expect(database.prepare("SELECT tenant_id, rule_id, user_id FROM learner_certifications").get()).toEqual({ tenant_id: "tenant-a", rule_id: "rule-a", user_id: "student-a" });
  });

  it("requires both course completion and a graded score meeting the rule threshold", async () => {
    addRule({ settings: { evidence: ["completion", "score"], scoreGte: 90 } });
    addStudent("tenant-a", "student-a", "lesson-a");
    database.prepare("INSERT INTO gradebook_scores VALUES ('grade-a', 'student-a', 'lesson_quiz', 'lesson-a', 'graded', 85, '2026-01-01 11:00:00', NULL, NULL)").run();
    const low = await issueEligibleCertifications({ tenantId: "tenant-a", studentId: "student-a", now: new Date("2026-01-02T00:00:00Z") });
    expect(low.issued).toBe(0);
    database.prepare("UPDATE gradebook_scores SET percent = 95 WHERE id = 'grade-a'").run();
    const passed = await issueEligibleCertifications({ tenantId: "tenant-a", studentId: "student-a", now: new Date("2026-01-02T00:00:00Z") });
    expect(passed.issued).toBe(1);
    const evidence = JSON.parse((database.prepare("SELECT evidence FROM learner_certifications").get() as { evidence: string }).evidence);
    expect(evidence).toMatchObject({ courseId: "lesson-a", requirements: ["completion", "score"], percent: 95, scoreGte: 90 });
  });

  it("renews an expired credential only after new qualifying evidence, but never reissues a revoked one", async () => {
    addRule({ settings: { evidence: ["score"], scoreGte: 80 }, days: 1 });
    addStudent("tenant-a", "student-a", "lesson-a");
    database.prepare("INSERT INTO gradebook_scores VALUES ('grade-a', 'student-a', 'lesson_quiz', 'lesson-a', 'graded', 92, '2026-01-01 11:00:00', NULL, NULL)").run();
    const first = await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2026-01-02T00:00:00Z") });
    expect(first.issued).toBe(1);
    const expired = await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2026-01-04T00:00:00Z") });
    expect(expired.renewed).toBe(0);
    expect((database.prepare("SELECT status FROM learner_certifications").get() as { status: string }).status).toBe("expired");
    database.prepare("UPDATE gradebook_scores SET graded_at = '2026-01-04 12:00:00' WHERE id = 'grade-a'").run();
    const renewed = await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2026-01-05T00:00:00Z") });
    expect(renewed.renewed).toBe(1);
    expect(count()).toBe(1);
    database.prepare("UPDATE learner_certifications SET status = 'revoked' WHERE rule_id = 'rule-a'").run();
    database.prepare("UPDATE gradebook_scores SET graded_at = '2026-01-06 12:00:00' WHERE id = 'grade-a'").run();
    const revoked = await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2026-01-07T00:00:00Z") });
    expect(revoked.issued + revoked.renewed).toBe(0);
    expect((database.prepare("SELECT status FROM learner_certifications").get() as { status: string }).status).toBe("revoked");
  });

  it("respects a one-time rule even after a new qualifying grade", async () => {
    addRule({ settings: { evidence: ["score"], scoreGte: 80, renewal: "none" }, days: 1 });
    addStudent("tenant-a", "student-a", "lesson-a");
    database.prepare("INSERT INTO gradebook_scores VALUES ('grade-a', 'student-a', 'lesson_quiz', 'lesson-a', 'graded', 92, '2026-01-01 11:00:00', NULL, NULL)").run();
    await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2026-01-02T00:00:00Z") });
    database.prepare("UPDATE gradebook_scores SET graded_at = '2026-01-04 12:00:00' WHERE id = 'grade-a'").run();
    const later = await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2026-01-05T00:00:00Z") });
    expect(later.renewed).toBe(0);
    expect((database.prepare("SELECT status FROM learner_certifications").get() as { status: string }).status).toBe("expired");
  });

  it("waits for an annual renewal window and new evidence", async () => {
    addRule({ settings: { evidence: ["score"], scoreGte: 80, renewal: "annual" }, days: 1 });
    addStudent("tenant-a", "student-a", "lesson-a");
    database.prepare("INSERT INTO gradebook_scores VALUES ('grade-a', 'student-a', 'lesson_quiz', 'lesson-a', 'graded', 92, '2026-01-01 11:00:00', NULL, NULL)").run();
    await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2026-01-02T00:00:00Z") });
    database.prepare("UPDATE gradebook_scores SET graded_at = '2026-01-04 12:00:00' WHERE id = 'grade-a'").run();
    const early = await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2026-01-05T00:00:00Z") });
    expect(early.renewed).toBe(0);
    database.prepare("UPDATE gradebook_scores SET graded_at = '2027-01-04 12:00:00' WHERE id = 'grade-a'").run();
    const afterYear = await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2027-01-05T00:00:00Z") });
    expect(afterYear.renewed).toBe(1);
  });

  it("does not issue for an unlinked lesson in an organization tenant", async () => {
    database.prepare("INSERT INTO lessons VALUES ('foreign-lesson', NULL, 'published')").run();
    database.prepare("INSERT INTO certification_rules VALUES ('rule-a', 'tenant-a', 'foreign-lesson', NULL, '{}')").run();
    addStudent("tenant-a", "student-a", "foreign-lesson");
    const result = await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2026-01-02T00:00:00Z") });
    expect(result.issued).toBe(0);
  });

  it("continues through eligible learners without duplicating a page", async () => {
    addRule({});
    for (let index = 0; index < 23; index += 1) addStudent("tenant-a", `student-${String(index).padStart(3, "0")}`, "lesson-a");
    const first = await issueEligibleCertifications({ tenantId: "tenant-a", now: new Date("2026-01-02T00:00:00Z") });
    expect(first.issued).toBe(10);
    expect(mocks.query).toHaveBeenCalledTimes(22);
    expect(first.nextCursor).toBeTruthy();
    mocks.query.mockClear();
    const second = await issueEligibleCertifications({ tenantId: "tenant-a", cursor: first.nextCursor!, now: new Date("2026-01-02T00:00:00Z") });
    expect(second.issued).toBe(10);
    expect(mocks.query).toHaveBeenCalledTimes(22);
    expect(second.nextCursor).toBeTruthy();
    mocks.query.mockClear();
    const third = await issueEligibleCertifications({ tenantId: "tenant-a", cursor: second.nextCursor!, now: new Date("2026-01-02T00:00:00Z") });
    expect(third.issued).toBe(3);
    expect(third.nextCursor).toBeNull();
    expect(mocks.query).toHaveBeenCalledTimes(8);
    expect(count()).toBe(23);
  });
});
