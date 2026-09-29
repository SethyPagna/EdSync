import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { runEnabledAutomationRules } from "../../../infra/cloudflare/workers/rule-engine";

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function fixture() {
  const db = new DatabaseSync(":memory:");
  let d1Operations = 0;
  databases.push(db);
  db.exec(`
    CREATE TABLE tenants (id TEXT PRIMARY KEY, status TEXT);
    CREATE TABLE profiles (id TEXT PRIMARY KEY, role TEXT);
    CREATE TABLE tenant_memberships (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, status TEXT, created_at TEXT);
    CREATE TABLE tenant_object_links (id TEXT PRIMARY KEY, tenant_id TEXT, object_table TEXT, object_id TEXT);
    CREATE TABLE classes (id TEXT PRIMARY KEY, is_active INTEGER);
    CREATE TABLE class_enrollments (id TEXT PRIMARY KEY, class_id TEXT, student_id TEXT, is_active INTEGER);
    CREATE TABLE lessons (id TEXT PRIMARY KEY, class_id TEXT);
    CREATE TABLE student_progress (id TEXT PRIMARY KEY, student_id TEXT, lesson_id TEXT, last_active TEXT);
    CREATE TABLE automation_rules (id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT, trigger_key TEXT, conditions TEXT, actions TEXT, enabled INTEGER);
    CREATE TABLE automation_jobs (id TEXT PRIMARY KEY, job_type TEXT NOT NULL, status TEXT NOT NULL, payload TEXT, result TEXT, attempts INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, title TEXT, message TEXT, action_url TEXT, priority TEXT, channels TEXT, metadata TEXT, created_at TEXT);
    CREATE TABLE learning_events (id TEXT PRIMARY KEY, tenant_id TEXT, actor_id TEXT, student_id TEXT, created_at TEXT);
    CREATE TABLE gradebook_scores (id TEXT PRIMARY KEY, class_id TEXT, student_id TEXT, title TEXT, percent REAL, status TEXT);
    CREATE TABLE learning_work_items (id TEXT PRIMARY KEY, class_id TEXT, teacher_id TEXT, title TEXT, due_at TEXT, status TEXT, work_type TEXT);
    CREATE TABLE learning_submissions (id TEXT PRIMARY KEY, work_item_id TEXT, student_id TEXT, status TEXT);
    CREATE TABLE learning_submission_attempts (id TEXT PRIMARY KEY, submission_id TEXT, work_item_id TEXT, student_id TEXT, attempt_number INTEGER);
    CREATE TABLE certification_rules (id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT);
    CREATE TABLE learner_certifications (id TEXT PRIMARY KEY, tenant_id TEXT, rule_id TEXT, user_id TEXT, status TEXT, expires_at TEXT);
    CREATE TABLE achievements_catalog (id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT, description TEXT, icon TEXT, criteria TEXT, points INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE user_achievements (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, achievement_id TEXT, earned_at TEXT, UNIQUE(user_id, achievement_id));
  `);
  const env = {
    EDSYNC_DB: {
      prepare(sql: string) {
        const statement = db.prepare(sql);
        return {
          bind(...values: SQLInputValue[]) {
            return {
              async first() { d1Operations += 1; return statement.get(...values) ?? null; },
              async all() { d1Operations += 1; return { results: statement.all(...values) }; },
              async run() { d1Operations += 1; return { meta: { changes: statement.run(...values).changes } }; },
            };
          },
        };
      },
    },
  } as unknown as AutomationEnv;
  db.exec("INSERT INTO tenants VALUES ('tenant-a', 'active'), ('tenant-b', 'active')");
  return { db, env, d1Operations: () => d1Operations };
}

function member(db: DatabaseSync, tenant: string, user: string, role: "student" | "teacher", createdAt = "2025-01-01 00:00:00") {
  db.prepare("INSERT OR IGNORE INTO profiles (id, role) VALUES (?, ?)").run(user, role);
  db.prepare("INSERT INTO tenant_memberships VALUES (?, ?, ?, 'active', ?)").run(`${tenant}:${user}`, tenant, user, createdAt);
}

function rule(db: DatabaseSync, input: {
  id: string;
  tenant?: string;
  trigger: string;
  conditions: Record<string, unknown>;
  actions?: Array<Record<string, unknown>>;
  enabled?: boolean;
}) {
  db.prepare("INSERT INTO automation_rules VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    input.id,
    input.tenant ?? "tenant-a",
    input.id,
    input.trigger,
    JSON.stringify(input.conditions),
    JSON.stringify(input.actions ?? [{ type: "notify", channel: "in_app" }]),
    input.enabled === false ? 0 : 1,
  );
}

function relative(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

describe("hourly automation rule engine", () => {
  it("isolates deadline reminders by both tenant work links and active learner membership", async () => {
    const { db, env } = fixture();
    member(db, "tenant-a", "student-a", "student");
    member(db, "tenant-a", "student-b", "student");
    member(db, "tenant-b", "student-c", "student");
    rule(db, { id: "remind-a", trigger: "deadline.upcoming", conditions: { hoursBeforeDue: 24 } });
    db.exec("INSERT INTO classes VALUES ('class-a', 1), ('class-b', 1)");
    db.exec("INSERT INTO class_enrollments VALUES ('enrollment-a', 'class-a', 'student-a', 1), ('enrollment-b', 'class-a', 'student-b', 0), ('enrollment-c', 'class-b', 'student-c', 1)");
    db.exec("INSERT INTO tenant_object_links VALUES ('link-class-a', 'tenant-a', 'classes', 'class-a'), ('link-class-b', 'tenant-b', 'classes', 'class-b'), ('link-work-a', 'tenant-a', 'learning_work_items', 'work-a'), ('link-work-b', 'tenant-b', 'learning_work_items', 'work-b')");
    db.prepare("INSERT INTO learning_work_items VALUES (?, ?, 'teacher', ?, ?, 'published', 'task')").run("work-a", "class-a", "Tenant A work", relative(2));
    db.prepare("INSERT INTO learning_work_items VALUES (?, ?, 'teacher', ?, ?, 'published', 'task')").run("work-b", "class-b", "Tenant B work", relative(2));

    const first = await runEnabledAutomationRules(env);
    const second = await runEnabledAutomationRules(env);
    expect(first.notificationsCreated).toBe(1);
    expect(second.notificationsCreated).toBe(0);
    expect(db.prepare("SELECT user_id, type, channels FROM notifications").get()).toEqual({
      user_id: "student-a", type: "deadline.upcoming", channels: '["in_app"]',
    });
  });

  it("reminds only learners with outstanding work inside the due window", async () => {
    const { db, env } = fixture();
    for (const student of ["due", "submitted"]) member(db, "tenant-a", student, "student");
    rule(db, { id: "remind", trigger: "deadline.upcoming", conditions: { hoursBeforeDue: 3 } });
    db.exec("INSERT INTO classes VALUES ('class-a', 1)");
    db.exec("INSERT INTO class_enrollments VALUES ('enrollment-due', 'class-a', 'due', 1), ('enrollment-submitted', 'class-a', 'submitted', 1)");
    db.exec("INSERT INTO tenant_object_links VALUES ('class-link', 'tenant-a', 'classes', 'class-a'), ('work-link', 'tenant-a', 'learning_work_items', 'work-due')");
    db.prepare("INSERT INTO learning_work_items VALUES ('work-due', 'class-a', 'teacher', 'Quiz', ?, 'published', 'quiz')").run(relative(2));
    db.exec("INSERT INTO learning_submissions VALUES ('submission', 'work-due', 'submitted', 'submitted')");

    await runEnabledAutomationRules(env);
    expect(db.prepare("SELECT user_id FROM notifications").all()).toEqual([{ user_id: "due" }]);
  });

  it("awards a tenant-scoped mastery badge once and excludes another tenant's score", async () => {
    const { db, env } = fixture();
    member(db, "tenant-a", "student-a", "student");
    member(db, "tenant-b", "student-b", "student");
    rule(db, { id: "mastery", trigger: "score.mastery", conditions: { scoreGte: 90 }, actions: [{ type: "award_badge", badge: "mastery" }, { type: "notify", channel: "in_app" }] });
    db.exec("INSERT INTO gradebook_scores VALUES ('score-a', NULL, 'student-a', 'Math', 95, 'graded'), ('score-b', NULL, 'student-b', 'Math', 99, 'graded')");
    db.exec("INSERT INTO tenant_object_links VALUES ('score-link-a', 'tenant-a', 'gradebook_scores', 'score-a'), ('score-link-b', 'tenant-b', 'gradebook_scores', 'score-b')");

    const first = await runEnabledAutomationRules(env);
    const second = await runEnabledAutomationRules(env);
    expect(first.badgesAwarded).toBe(1);
    expect(first.notificationsCreated).toBe(1);
    expect(second.badgesAwarded).toBe(0);
    expect(second.notificationsCreated).toBe(0);
    expect(db.prepare("SELECT tenant_id, user_id FROM user_achievements").all()).toEqual([{ tenant_id: "tenant-a", user_id: "student-a" }]);
    expect(db.prepare("SELECT tenant_id, title FROM achievements_catalog").all()).toEqual([{ tenant_id: "tenant-a", title: "mastery" }]);
  });

  it("uses tenant learning activity for inactivity and reuses the certification expiry notice ID", async () => {
    const { db, env } = fixture();
    member(db, "tenant-a", "student", "student");
    member(db, "tenant-b", "student", "student");
    rule(db, { id: "inactive", trigger: "learner.inactive", conditions: { inactiveDays: 5 } });
    rule(db, { id: "expiry", trigger: "certification.expiring", conditions: { daysBeforeExpiry: 30 } });
    db.prepare("INSERT INTO learning_events VALUES ('event-b', 'tenant-b', 'student', 'student', ?)").run(relative(-1));
    db.exec("INSERT INTO certification_rules VALUES ('cert-rule', 'tenant-a', 'Safety')");
    const expiry = relative(24);
    db.prepare("INSERT INTO learner_certifications VALUES ('cert', 'tenant-a', 'cert-rule', 'student', 'active', ?)").run(expiry);

    await runEnabledAutomationRules(env);
    expect(db.prepare("SELECT type FROM notifications ORDER BY type").all()).toEqual([
      { type: "certification.expiring" }, { type: "learner.inactive" },
    ]);
    expect(db.prepare("SELECT id FROM notifications WHERE type = 'certification.expiring'").get()).toEqual({ id: `certification-expiry:cert:${expiry}` });
  });

  it("ignores teacher grading as learner activity and respects tenant-linked lesson progress", async () => {
    const { db, env } = fixture();
    for (const student of ["teacher-graded", "active-here", "active-elsewhere"]) {
      member(db, "tenant-a", student, "student");
    }
    member(db, "tenant-a", "teacher", "teacher");
    rule(db, { id: "inactive", trigger: "learner.inactive", conditions: { inactiveDays: 5 } });
    db.prepare("INSERT INTO learning_events VALUES ('grade-event', 'tenant-a', 'teacher', 'teacher-graded', ?)").run(relative(-1));
    db.exec("INSERT INTO lessons VALUES ('lesson-a', NULL), ('lesson-b', NULL)");
    db.exec("INSERT INTO tenant_object_links VALUES ('lesson-link-a', 'tenant-a', 'lessons', 'lesson-a'), ('lesson-link-b', 'tenant-b', 'lessons', 'lesson-b')");
    db.prepare("INSERT INTO student_progress VALUES ('progress-a', 'active-here', 'lesson-a', ?)").run(relative(-1));
    db.prepare("INSERT INTO student_progress VALUES ('progress-b', 'active-elsewhere', 'lesson-b', ?)").run(relative(-1));

    await runEnabledAutomationRules(env);
    expect(db.prepare("SELECT user_id FROM notifications ORDER BY user_id").all()).toEqual([
      { user_id: "active-elsewhere" }, { user_id: "teacher-graded" },
    ]);
  });

  it("resumes after the global candidate cap without duplicating earlier notices", async () => {
    const { db, env, d1Operations } = fixture();
    rule(db, { id: "inactive", trigger: "learner.inactive", conditions: { inactiveDays: 5 } });
    for (let index = 0; index < 50; index += 1) {
      member(db, "tenant-a", `student-${String(index).padStart(2, "0")}`, "student");
    }

    const first = await runEnabledAutomationRules(env);
    const firstOperations = d1Operations();
    const second = await runEnabledAutomationRules(env);
    expect(first.notificationsCreated).toBe(30);
    expect(first.capacityReached).toBe(true);
    expect(second.notificationsCreated).toBe(20);
    expect(firstOperations).toBeLessThanOrEqual(36);
    expect(d1Operations() - firstOperations).toBeLessThanOrEqual(36);
    expect(db.prepare("SELECT COUNT(*) AS total FROM notifications").get()).toEqual({ total: 50 });
  });

  it("rotates the persisted rule cursor so rules beyond the per-sweep cap run", async () => {
    const { db, env } = fixture();
    member(db, "tenant-a", "student", "student");
    for (let index = 0; index < 16; index += 1) {
      rule(db, { id: `rule-${String(index).padStart(2, "0")}`, trigger: "certification.expiring", conditions: { daysBeforeExpiry: 30 } });
    }
    rule(db, { id: "rule-16", trigger: "score.mastery", conditions: { scoreGte: 90 }, actions: [{ type: "award_badge", badge: "mastery" }] });
    db.exec("INSERT INTO gradebook_scores VALUES ('score', NULL, 'student', 'Math', 95, 'graded')");
    db.exec("INSERT INTO tenant_object_links VALUES ('score-link', 'tenant-a', 'gradebook_scores', 'score')");

    const first = await runEnabledAutomationRules(env);
    const firstCursor = db.prepare("SELECT result FROM automation_jobs WHERE id = 'automation-rule-sweep-state'").get() as { result: string };
    const second = await runEnabledAutomationRules(env);
    expect(first.rulesProcessed).toBe(16);
    expect(first.badgesAwarded).toBe(0);
    expect(JSON.parse(firstCursor.result)).toEqual({ cursor: "rule-15" });
    expect(second.rulesProcessed).toBe(16);
    expect(second.badgesAwarded).toBe(1);
    expect(JSON.parse((db.prepare("SELECT result FROM automation_jobs WHERE id = 'automation-rule-sweep-state'").get() as { result: string }).result)).toEqual({ cursor: "rule-14" });
  });

  it("notifies the linked teacher once for a submitted attempt requiring review", async () => {
    const { db, env } = fixture();
    member(db, "tenant-a", "student", "student");
    member(db, "tenant-a", "teacher", "teacher");
    rule(db, { id: "review", trigger: "work.submitted", conditions: { workTypes: ["task"], needsReview: true } });
    db.exec("INSERT INTO classes VALUES ('class-a', 1)");
    db.exec("INSERT INTO class_enrollments VALUES ('enrollment', 'class-a', 'student', 1)");
    db.exec("INSERT INTO tenant_object_links VALUES ('class-link', 'tenant-a', 'classes', 'class-a'), ('work-link', 'tenant-a', 'learning_work_items', 'work')");
    db.exec("INSERT INTO learning_work_items VALUES ('work', 'class-a', 'teacher', 'Essay', NULL, 'published', 'task')");
    db.exec("INSERT INTO learning_submissions VALUES ('submission', 'work', 'student', 'submitted')");
    db.exec("INSERT INTO learning_submission_attempts VALUES ('attempt', 'submission', 'work', 'student', 1)");

    await runEnabledAutomationRules(env);
    await runEnabledAutomationRules(env);
    expect(db.prepare("SELECT user_id, type FROM notifications").all()).toEqual([{ user_id: "teacher", type: "work.submitted" }]);
  });
});
