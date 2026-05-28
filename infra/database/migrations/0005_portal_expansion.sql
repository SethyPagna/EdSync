CREATE TABLE IF NOT EXISTS admin_users (
  user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  flag_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  audience TEXT DEFAULT 'all' CHECK (audience IN ('all', 'admin', 'teacher', 'student')),
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_type TEXT DEFAULT 'chat' CHECK (provider_type IN ('chat', 'embed')),
  account_email TEXT,
  project_name TEXT,
  api_key_encrypted TEXT NOT NULL,
  default_model TEXT,
  supported_models TEXT DEFAULT '[]',
  endpoint_override TEXT,
  notes TEXT,
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 50,
  requests_per_minute INTEGER DEFAULT 10,
  max_input_chars INTEGER DEFAULT 1200,
  max_completion_tokens INTEGER DEFAULT 1800,
  timeout_ms INTEGER DEFAULT 15000,
  cooldown_seconds INTEGER DEFAULT 20,
  last_status TEXT DEFAULT 'untested' CHECK (last_status IN ('untested', 'ok', 'error')),
  last_error TEXT,
  last_checked_at TEXT,
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gradebook_categories (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight REAL DEFAULT 1,
  drop_lowest INTEGER DEFAULT 0,
  color TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gradebook_scores (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES gradebook_categories(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('lesson_quiz', 'quiz', 'test', 'task', 'discussion', 'activity', 'manual')),
  source_id TEXT,
  title TEXT NOT NULL,
  points_earned REAL DEFAULT 0,
  points_possible REAL DEFAULT 0,
  percent REAL,
  feedback TEXT,
  status TEXT DEFAULT 'graded' CHECK (status IN ('draft', 'submitted', 'graded', 'excused', 'missing')),
  graded_at TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(student_id, source_type, source_id)
);

CREATE TABLE IF NOT EXISTS learning_work_items (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES gradebook_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  work_type TEXT NOT NULL CHECK (work_type IN ('quiz', 'test', 'task', 'discussion', 'activity')),
  instructions TEXT,
  points_possible REAL DEFAULT 100,
  due_at TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  allow_late INTEGER DEFAULT 1,
  rubric TEXT DEFAULT '[]',
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS learning_work_questions (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES learning_work_items(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  question_type TEXT DEFAULT 'short_answer',
  options TEXT DEFAULT '[]',
  correct_answer TEXT,
  points REAL DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS learning_submissions (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES learning_work_items(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  response TEXT DEFAULT '{}',
  attachment_storage_id TEXT REFERENCES storage_objects(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'returned', 'graded', 'missing')),
  points_earned REAL,
  points_possible REAL,
  percent REAL,
  feedback TEXT,
  ai_feedback TEXT,
  submitted_at TEXT,
  graded_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(work_item_id, student_id)
);

CREATE TABLE IF NOT EXISTS discussion_threads (
  id TEXT PRIMARY KEY,
  work_item_id TEXT REFERENCES learning_work_items(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt TEXT,
  is_locked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS discussion_posts (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES discussion_posts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  visibility TEXT DEFAULT 'class' CHECK (visibility IN ('class', 'teacher', 'private')),
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_notes (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  visibility TEXT DEFAULT 'student' CHECK (visibility IN ('teacher', 'student', 'guardian')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_outbox_events (
  id TEXT PRIMARY KEY,
  teacher_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  recipients TEXT DEFAULT '[]',
  sender_display TEXT,
  reply_to TEXT,
  compose_url TEXT,
  provider TEXT DEFAULT 'outbox',
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'composed', 'sent', 'failed', 'skipped')),
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_time ON admin_audit_logs(admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_provider_enabled_priority ON ai_provider_configs(enabled, provider_type, priority);
CREATE INDEX IF NOT EXISTS idx_grade_categories_class ON gradebook_categories(class_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_grade_scores_student_class ON gradebook_scores(student_id, class_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_grade_scores_teacher_class ON gradebook_scores(teacher_id, class_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_work_items_teacher_class ON learning_work_items(teacher_id, class_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_work_items_class_status ON learning_work_items(class_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_work_questions_item ON learning_work_questions(work_item_id, order_index);
CREATE INDEX IF NOT EXISTS idx_submissions_work ON learning_submissions(work_item_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON learning_submissions(student_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_discussion_threads_class ON discussion_threads(class_id, created_at);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_thread ON discussion_posts(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_student_notes_student ON student_notes(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_student_notes_teacher ON student_notes(teacher_id, created_at);
CREATE INDEX IF NOT EXISTS idx_email_outbox_teacher ON email_outbox_events(teacher_id, created_at);
