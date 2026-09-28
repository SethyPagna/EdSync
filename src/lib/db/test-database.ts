import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SessionUser } from "@/lib/auth/session";
import type { D1QueryAdapter } from "./d1-adapter";

/** In-memory SQLite with the tables the client data API exposes, for policy tests only. */
const SCHEMA = `
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('teacher', 'student')),
  school TEXT,
  grade_level TEXT,
  subjects TEXT DEFAULT '[]',
  interests TEXT DEFAULT '[]',
  preferences TEXT DEFAULT '{"theme":"light","text_size":"medium"}',
  achievements TEXT DEFAULT '[]',
  total_xp INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_active_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  grade_level TEXT,
  join_code TEXT UNIQUE DEFAULT (upper(substr(hex(randomblob(4)), 1, 8))),
  is_active INTEGER DEFAULT 1,
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE class_enrollments (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,
  UNIQUE(class_id, student_id)
);
CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  objectives TEXT DEFAULT '[]',
  subject TEXT,
  grade_level TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  difficulty TEXT DEFAULT 'intermediate',
  estimated_duration INTEGER DEFAULT 45,
  tags TEXT DEFAULT '[]',
  thumbnail_url TEXT,
  source_url TEXT,
  source_content TEXT,
  ai_generated INTEGER DEFAULT 0,
  complexity_slider INTEGER DEFAULT 50,
  pacing_slider INTEGER DEFAULT 50,
  scaffolding_slider INTEGER DEFAULT 50,
  prerequisites TEXT DEFAULT '[]',
  personalization TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE lesson_sections (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  content_type TEXT DEFAULT 'text',
  order_index INTEGER NOT NULL,
  duration_minutes INTEGER DEFAULT 5,
  is_required INTEGER DEFAULT 1,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE quiz_questions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES lesson_sections(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice',
  options TEXT,
  correct_answer TEXT,
  explanation TEXT,
  difficulty TEXT DEFAULT 'intermediate',
  points INTEGER DEFAULT 1,
  is_diagnostic INTEGER DEFAULT 0,
  is_micro_check INTEGER DEFAULT 0,
  is_final_quiz INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE glossary_terms (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  example TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE lesson_assignments (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  due_date TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE student_progress (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started',
  current_section_id TEXT,
  sections_completed TEXT DEFAULT '[]',
  score REAL,
  time_spent INTEGER DEFAULT 0,
  diagnostic_completed INTEGER DEFAULT 0,
  diagnostic_score REAL,
  final_quiz_score REAL,
  knowledge_gaps TEXT DEFAULT '[]',
  metadata TEXT DEFAULT '{}',
  started_at TEXT,
  completed_at TEXT,
  last_active TEXT DEFAULT (datetime('now')),
  UNIQUE(student_id, lesson_id)
);
CREATE TABLE quiz_attempts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer TEXT,
  is_correct INTEGER,
  time_taken INTEGER,
  attempt_number INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE socratic_interactions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  section_id TEXT,
  student_question TEXT NOT NULL,
  hint_response TEXT NOT NULL,
  hint_type TEXT DEFAULT 'guiding_question',
  conversation_history TEXT DEFAULT '[]',
  helpful_rating INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE learning_reflections (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  lesson_id TEXT,
  confidence INTEGER,
  reflection TEXT NOT NULL,
  ai_feedback TEXT,
  next_step TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE learning_goals (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_type TEXT DEFAULT 'weekly_xp',
  target_value INTEGER DEFAULT 100,
  current_value INTEGER DEFAULT 0,
  is_complete INTEGER DEFAULT 0,
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE knowledge_nodes (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  lesson_id TEXT,
  concept TEXT NOT NULL,
  mastery_level REAL DEFAULT 0,
  evidence TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(student_id, concept)
);
CREATE TABLE teacher_alerts (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  student_id TEXT,
  lesson_id TEXT,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_suggestion TEXT,
  is_read INTEGER DEFAULT 0,
  is_dismissed INTEGER DEFAULT 0,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL
);
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active'
);
CREATE TABLE billing_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  course_id TEXT,
  status TEXT DEFAULT 'draft'
);
CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  product_id TEXT,
  status TEXT DEFAULT 'active',
  starts_at TEXT DEFAULT (datetime('now')),
  ends_at TEXT
);
`;

function user(id: string, role: SessionUser["user_metadata"]["role"]): SessionUser {
  return { id, email: `${id}@example.com`, user_metadata: { role } };
}

export const TEACHER = user("teacher-1", "teacher");
export const OTHER_TEACHER = user("teacher-2", "teacher");
export const STUDENT = user("student-1", "student");
export const OTHER_STUDENT = user("student-2", "student");
export const BUYER = user("student-3", "student");
export const ADMIN = user("admin-1", "admin");

const SEED: Record<string, Record<string, SQLInputValue>[]> = {
  profiles: [
    { id: TEACHER.id, email: TEACHER.email, full_name: "Tara Teacher", role: "teacher" },
    { id: OTHER_TEACHER.id, email: OTHER_TEACHER.email, full_name: "Theo Teacher", role: "teacher" },
    { id: STUDENT.id, email: STUDENT.email, full_name: "Sam Student", role: "student" },
    { id: OTHER_STUDENT.id, email: OTHER_STUDENT.email, full_name: "Sia Student", role: "student" },
    { id: BUYER.id, email: BUYER.email, full_name: "Bea Buyer", role: "student" },
    { id: ADMIN.id, email: ADMIN.email, full_name: "Ada Admin", role: "teacher" },
  ],
  classes: [
    { id: "class-1", teacher_id: TEACHER.id, name: "Math 7", join_code: "JOIN1111" },
    { id: "class-2", teacher_id: OTHER_TEACHER.id, name: "Art 7", join_code: "JOIN2222" },
    { id: "class-3", teacher_id: OTHER_TEACHER.id, name: "Old", join_code: "OLD33333", is_active: 0 },
  ],
  class_enrollments: [
    { id: "enroll-1", class_id: "class-1", student_id: STUDENT.id },
    { id: "enroll-2", class_id: "class-2", student_id: OTHER_STUDENT.id },
  ],
  lessons: [
    { id: "lesson-1", teacher_id: TEACHER.id, title: "Fractions", status: "published" },
    { id: "lesson-2", teacher_id: TEACHER.id, title: "Draft decimals", status: "draft" },
    { id: "lesson-3", teacher_id: OTHER_TEACHER.id, title: "Color theory", status: "published" },
    { id: "lesson-4", teacher_id: OTHER_TEACHER.id, title: "Catalog course", status: "published" },
  ],
  lesson_assignments: [
    { id: "assign-1", lesson_id: "lesson-1", class_id: "class-1", assigned_by: TEACHER.id },
    { id: "assign-2", lesson_id: "lesson-2", class_id: "class-1", assigned_by: TEACHER.id },
    { id: "assign-3", lesson_id: "lesson-3", class_id: "class-2", assigned_by: OTHER_TEACHER.id },
  ],
  lesson_sections: [
    { id: "section-1", lesson_id: "lesson-1", title: "Warm up", order_index: 0 },
    { id: "section-3", lesson_id: "lesson-3", title: "Palette", order_index: 0 },
  ],
  quiz_questions: [
    { id: "question-1", lesson_id: "lesson-1", section_id: null, question_text: "1/2 + 1/2?" },
    { id: "question-2", lesson_id: "lesson-1", section_id: "section-1", question_text: "Block check" },
    { id: "question-3", lesson_id: "lesson-3", section_id: null, question_text: "Primary colors?" },
  ],
  glossary_terms: [{ id: "term-1", lesson_id: "lesson-1", term: "Numerator", definition: "Top number" }],
  student_progress: [
    { id: "progress-1", student_id: STUDENT.id, lesson_id: "lesson-1", status: "completed", score: 80 },
    { id: "progress-2", student_id: OTHER_STUDENT.id, lesson_id: "lesson-3", status: "in_progress", score: null },
  ],
  socratic_interactions: [
    { id: "hint-1", student_id: STUDENT.id, lesson_id: "lesson-1", student_question: "Why?", hint_response: "Think." },
  ],
  learning_reflections: [
    { id: "reflection-1", student_id: STUDENT.id, lesson_id: "lesson-1", confidence: 1, reflection: "Hard" },
    { id: "reflection-2", student_id: OTHER_STUDENT.id, lesson_id: "lesson-3", confidence: 1, reflection: "Hmm" },
  ],
  learning_goals: [
    { id: "goal-1", student_id: STUDENT.id, title: "One lesson" },
    { id: "goal-2", student_id: OTHER_STUDENT.id, title: "Two lessons" },
  ],
  teacher_alerts: [
    { id: "alert-1", teacher_id: TEACHER.id, alert_type: "struggling", title: "Check in", message: "Sam" },
    { id: "alert-2", teacher_id: OTHER_TEACHER.id, alert_type: "struggling", title: "Check in", message: "Sia" },
  ],
  notifications: [{ id: "notification-1", user_id: STUDENT.id, title: "Hi" }],
  tenants: [{ id: "tenant-1", slug: "academy", name: "Academy", status: "active" }],
  billing_products: [
    { id: "product-1", tenant_id: "tenant-1", title: "Catalog course", course_id: "lesson-4", status: "active" },
  ],
  entitlements: [{ id: "entitlement-1", tenant_id: "tenant-1", user_id: BUYER.id, product_id: "product-1" }],
};

function normalizeParams(params: unknown[]): SQLInputValue[] {
  return params.map((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "object") return JSON.stringify(value);
    return value as SQLInputValue;
  });
}

export function createSeededDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  for (const [table, rows] of Object.entries(SEED)) {
    for (const row of rows) {
      const columns = Object.keys(row);
      db.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(
        ...columns.map((column) => row[column]),
      );
    }
  }
  return db;
}

export function sqliteAdapter(db: DatabaseSync): D1QueryAdapter {
  return {
    name: "binding",
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...normalizeParams(params)) as T[];
    },
    async batch(statements) {
      for (const statement of statements) db.prepare(statement.sql).run(...normalizeParams(statement.params ?? []));
    },
  };
}

export function rowOf(db: DatabaseSync, table: string, id: string) {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
}
