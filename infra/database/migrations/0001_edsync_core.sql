PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  token_type TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS classes (
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

CREATE TABLE IF NOT EXISTS class_enrollments (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,
  UNIQUE(class_id, student_id)
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  objectives TEXT DEFAULT '[]',
  subject TEXT,
  grade_level TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
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

CREATE TABLE IF NOT EXISTS lesson_sections (
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

CREATE TABLE IF NOT EXISTS quiz_questions (
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

CREATE TABLE IF NOT EXISTS lesson_assignments (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by TEXT NOT NULL REFERENCES profiles(id),
  due_date TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_progress (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started',
  current_section_id TEXT REFERENCES lesson_sections(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer TEXT,
  is_correct INTEGER,
  time_taken INTEGER,
  attempt_number INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS socratic_interactions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES lesson_sections(id) ON DELETE SET NULL,
  student_question TEXT NOT NULL,
  hint_response TEXT NOT NULL,
  hint_type TEXT DEFAULT 'guiding_question',
  conversation_history TEXT DEFAULT '[]',
  helpful_rating INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS learning_reflections (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  confidence INTEGER,
  reflection TEXT NOT NULL,
  ai_feedback TEXT,
  next_step TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS learning_goals (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_type TEXT DEFAULT 'weekly_xp',
  target_value INTEGER DEFAULT 100,
  current_value INTEGER DEFAULT 0,
  is_complete INTEGER DEFAULT 0,
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  mastery_level REAL DEFAULT 0,
  evidence TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(student_id, concept)
);

CREATE TABLE IF NOT EXISTS teacher_alerts (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_suggestion TEXT,
  is_read INTEGER DEFAULT 0,
  is_dismissed INTEGER DEFAULT 0,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lesson_analytics (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_students INTEGER DEFAULT 0,
  students_started INTEGER DEFAULT 0,
  students_completed INTEGER DEFAULT 0,
  avg_score REAL,
  avg_time_spent REAL,
  concept_mastery TEXT DEFAULT '{}',
  common_mistakes TEXT DEFAULT '[]',
  struggling_students TEXT DEFAULT '[]',
  advanced_students TEXT DEFAULT '[]',
  computed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(lesson_id)
);

CREATE TABLE IF NOT EXISTS glossary_terms (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  example TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS storage_objects (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  public_url TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  purpose TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(bucket, object_key)
);

CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  success INTEGER DEFAULT 0,
  latency_ms INTEGER,
  request TEXT DEFAULT '{}',
  response TEXT DEFAULT '{}',
  error_message TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload TEXT DEFAULT '{}',
  result TEXT DEFAULT '{}',
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id, is_active);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON class_enrollments(student_id, is_active);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher ON lessons(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON lesson_assignments(class_id, is_active);
CREATE INDEX IF NOT EXISTS idx_progress_student_lesson ON student_progress(student_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_storage_owner ON storage_objects(owner_id, purpose);
CREATE INDEX IF NOT EXISTS idx_ai_runs_user_feature ON ai_runs(user_id, feature);
