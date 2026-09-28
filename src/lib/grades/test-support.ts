import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SessionUser } from "@/lib/auth/session";
import type { D1QueryAdapter } from "@/lib/db/d1-adapter";

/**
 * Test-only helpers: an in-memory SQLite database built from the real D1 migrations plus a small
 * grading fixture. Imported only by *.test.ts files.
 */

// 0009 belongs to a separate change; the grading tests pin the migrations they depend on.
const MIGRATION_FILE = /^(000[1-8]|0010)_[a-z0-9_]+\.sql$/;

export const DEFAULT_TENANT = "tenant_edsync_default";

function user(id: string, role: SessionUser["user_metadata"]["role"]): SessionUser {
  return { id, email: `${id}@example.com`, user_metadata: { role } };
}

export const TEACHER = user("teacher-1", "teacher");
export const OTHER_TEACHER = user("teacher-2", "teacher");
export const STUDENT = user("student-1", "student");
export const OTHER_STUDENT = user("student-2", "student");

const SEED: Array<[string, Record<string, SQLInputValue>[]]> = [
  [
    "auth_users",
    [TEACHER, OTHER_TEACHER, STUDENT, OTHER_STUDENT].map((account) => ({
      id: account.id,
      email: account.email,
      password_hash: "x",
    })),
  ],
  [
    "profiles",
    [
      { id: TEACHER.id, email: TEACHER.email, full_name: "Tara Teacher", role: "teacher" },
      { id: OTHER_TEACHER.id, email: OTHER_TEACHER.email, full_name: "Theo Teacher", role: "teacher" },
      { id: STUDENT.id, email: STUDENT.email, full_name: "Sam Student", role: "student" },
      { id: OTHER_STUDENT.id, email: OTHER_STUDENT.email, full_name: "Sia Student", role: "student" },
    ],
  ],
  [
    "classes",
    [
      { id: "class-1", teacher_id: TEACHER.id, name: "Biology" },
      { id: "class-2", teacher_id: OTHER_TEACHER.id, name: "Chemistry" },
    ],
  ],
  [
    "class_enrollments",
    [
      { id: "enroll-1", class_id: "class-1", student_id: STUDENT.id },
      { id: "enroll-2", class_id: "class-2", student_id: STUDENT.id },
      { id: "enroll-3", class_id: "class-2", student_id: OTHER_STUDENT.id },
    ],
  ],
  [
    "lessons",
    [
      { id: "lesson-1", teacher_id: TEACHER.id, class_id: "class-1", title: "Cells", status: "published" },
      { id: "lesson-2", teacher_id: TEACHER.id, class_id: "class-1", title: "Essays", status: "published" },
      { id: "lesson-3", teacher_id: OTHER_TEACHER.id, class_id: "class-2", title: "Acids", status: "published" },
    ],
  ],
  [
    "quiz_questions",
    [
      {
        id: "q-mcq",
        lesson_id: "lesson-1",
        question_text: "Powerhouse of the cell?",
        question_type: "multiple_choice",
        options: JSON.stringify([
          { id: "a", text: "Mitochondria", is_correct: true },
          { id: "b", text: "Ribosome", is_correct: false },
        ]),
        correct_answer: "a",
        points: 2,
        is_final_quiz: 1,
        order_index: 0,
      },
      {
        id: "q-tf",
        lesson_id: "lesson-1",
        question_text: "Plants have cell walls.",
        question_type: "true_false",
        options: JSON.stringify([
          { id: "true", text: "True", is_correct: true },
          { id: "false", text: "False", is_correct: false },
        ]),
        correct_answer: "true",
        points: 1,
        is_final_quiz: 1,
        order_index: 1,
      },
      {
        id: "q-short",
        lesson_id: "lesson-1",
        question_text: "Process plants use to make food?",
        question_type: "short_answer",
        correct_answer: "Photosynthesis",
        points: 1,
        is_final_quiz: 1,
        order_index: 2,
      },
      {
        id: "q-check",
        lesson_id: "lesson-1",
        question_text: "Warm-up (not graded)",
        question_type: "short_answer",
        correct_answer: "anything",
        points: 5,
        is_final_quiz: 0,
        order_index: 3,
      },
      {
        id: "q-essay",
        lesson_id: "lesson-2",
        question_text: "Explain osmosis.",
        question_type: "long_answer",
        points: 4,
        is_final_quiz: 1,
        order_index: 0,
      },
    ],
  ],
  [
    "gradebook_categories",
    [
      { id: "cat-tests", class_id: "class-1", teacher_id: TEACHER.id, name: "Tests", weight: 3 },
      { id: "cat-homework", class_id: "class-1", teacher_id: TEACHER.id, name: "Homework", weight: 1 },
      { id: "cat-labs", class_id: "class-2", teacher_id: OTHER_TEACHER.id, name: "Labs", weight: 1 },
    ],
  ],
];

function normalizeParams(params: unknown[]): SQLInputValue[] {
  return params.map((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "object") return JSON.stringify(value);
    return value as SQLInputValue;
  });
}

export function insertRows(db: DatabaseSync, table: string, rows: Record<string, SQLInputValue>[]) {
  for (const row of rows) {
    const columns = Object.keys(row);
    db.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(
      ...columns.map((column) => row[column]),
    );
  }
}

export function applyMigrations(db: DatabaseSync) {
  const dir = join(process.cwd(), "infra", "database", "migrations");
  const files = readdirSync(dir)
    .filter((file) => MIGRATION_FILE.test(file))
    .sort();
  for (const file of files) db.exec(readFileSync(join(dir, file), "utf8"));
  return files;
}

export function createGradingDatabase() {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db);
  for (const [table, rows] of SEED) insertRows(db, table, rows);
  return db;
}

export function sqliteAdapter(db: DatabaseSync): D1QueryAdapter {
  return {
    name: "binding",
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...normalizeParams(params)) as T[];
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        for (const statement of statements) db.prepare(statement.sql).run(...normalizeParams(statement.params ?? []));
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

export function selectAll(db: DatabaseSync, sql: string, ...params: SQLInputValue[]) {
  return db.prepare(sql).all(...params) as Record<string, unknown>[];
}

export function selectOne(db: DatabaseSync, sql: string, ...params: SQLInputValue[]) {
  return db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
}

export function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export async function readJson(response: Response) {
  return (await response.json()) as { data: Record<string, unknown> | null; error: string | null };
}
