-- EdSync core schema for Supabase and portable Postgres.
-- Designed to run safely after the legacy Atlas schema because it only creates
-- missing objects and adds the production tables/indexes required by EdSync.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('teacher', 'student');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE lesson_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE content_type AS ENUM ('text', 'video', 'image', 'quiz', 'activity', 'discussion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE progress_status AS ENUM ('not_started', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE hint_type AS ENUM ('guiding_question', 'concept_reminder', 'step_breakdown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_type AS ENUM ('struggling', 'intervention', 'achievement', 'completion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role user_role NOT NULL DEFAULT 'student',
  school text,
  grade_level text,
  subjects text[] DEFAULT '{}',
  interests text[] DEFAULT '{}',
  preferences jsonb DEFAULT '{"theme":"dark","text_size":"medium"}',
  achievements jsonb DEFAULT '[]',
  total_xp integer DEFAULT 0,
  streak_days integer DEFAULT 0,
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  subject text,
  grade_level text,
  join_code text UNIQUE DEFAULT upper(substring(md5(random()::text), 1, 8)),
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_enrollments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(class_id, student_id)
);

CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  objectives text[] DEFAULT '{}',
  subject text,
  grade_level text,
  status lesson_status DEFAULT 'draft',
  difficulty difficulty_level DEFAULT 'intermediate',
  estimated_duration integer DEFAULT 45,
  tags text[] DEFAULT '{}',
  thumbnail_url text,
  source_url text,
  source_content text,
  ai_generated boolean DEFAULT false,
  complexity_slider integer DEFAULT 50 CHECK (complexity_slider BETWEEN 0 AND 100),
  pacing_slider integer DEFAULT 50 CHECK (pacing_slider BETWEEN 0 AND 100),
  scaffolding_slider integer DEFAULT 50 CHECK (scaffolding_slider BETWEEN 0 AND 100),
  prerequisites text[] DEFAULT '{}',
  personalization jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lesson_sections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  content_type content_type DEFAULT 'text',
  order_index integer NOT NULL,
  duration_minutes integer DEFAULT 5,
  is_required boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  section_id uuid REFERENCES lesson_sections(id) ON DELETE SET NULL,
  question_text text NOT NULL,
  question_type text DEFAULT 'multiple_choice',
  options jsonb,
  correct_answer text,
  explanation text,
  difficulty difficulty_level DEFAULT 'intermediate',
  points integer DEFAULT 1,
  is_diagnostic boolean DEFAULT false,
  is_micro_check boolean DEFAULT false,
  is_final_quiz boolean DEFAULT false,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lesson_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES profiles(id),
  due_date timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_progress (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status progress_status DEFAULT 'not_started',
  current_section_id uuid REFERENCES lesson_sections(id) ON DELETE SET NULL,
  sections_completed uuid[] DEFAULT '{}',
  score numeric(5,2),
  time_spent integer DEFAULT 0,
  diagnostic_completed boolean DEFAULT false,
  diagnostic_score numeric(5,2),
  final_quiz_score numeric(5,2),
  knowledge_gaps text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  started_at timestamptz,
  completed_at timestamptz,
  last_active timestamptz DEFAULT now(),
  UNIQUE(student_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer text,
  is_correct boolean,
  time_taken integer,
  attempt_number integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS socratic_interactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  section_id uuid REFERENCES lesson_sections(id) ON DELETE SET NULL,
  student_question text NOT NULL,
  hint_response text NOT NULL,
  hint_type hint_type DEFAULT 'guiding_question',
  conversation_history jsonb DEFAULT '[]',
  helpful_rating integer CHECK (helpful_rating BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_reflections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  confidence integer CHECK (confidence BETWEEN 1 AND 5),
  reflection text NOT NULL,
  ai_feedback text,
  next_step text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_goals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  target_type text DEFAULT 'weekly_xp',
  target_value integer DEFAULT 100,
  current_value integer DEFAULT 0,
  is_complete boolean DEFAULT false,
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  concept text NOT NULL,
  mastery_level numeric(3,2) DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 1),
  evidence jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, concept)
);

CREATE TABLE IF NOT EXISTS teacher_alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  alert_type alert_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  action_suggestion text,
  is_read boolean DEFAULT false,
  is_dismissed boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lesson_analytics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_students integer DEFAULT 0,
  students_started integer DEFAULT 0,
  students_completed integer DEFAULT 0,
  avg_score numeric(5,2),
  avg_time_spent integer,
  concept_mastery jsonb DEFAULT '{}',
  common_mistakes jsonb DEFAULT '[]',
  struggling_students uuid[] DEFAULT '{}',
  advanced_students uuid[] DEFAULT '{}',
  computed_at timestamptz DEFAULT now(),
  UNIQUE(lesson_id)
);

CREATE TABLE IF NOT EXISTS glossary_terms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  term text NOT NULL,
  definition text NOT NULL,
  example text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher_status ON lessons(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_lessons_class ON lessons(class_id);
CREATE INDEX IF NOT EXISTS idx_sections_lesson_order ON lesson_sections(lesson_id, order_index);
CREATE INDEX IF NOT EXISTS idx_questions_lesson_order ON quiz_questions(lesson_id, order_index);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON lesson_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_student ON lesson_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_student ON student_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_lesson ON student_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_lesson ON quiz_attempts(student_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_reflections_student ON learning_reflections(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goals_student ON learning_goals(student_id, is_complete);
CREATE INDEX IF NOT EXISTS idx_alerts_teacher ON teacher_alerts(teacher_id, is_dismissed, created_at DESC);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE socratic_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE glossary_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles read own and class members" ON profiles;
CREATE POLICY "profiles read own and class members" ON profiles
  FOR SELECT USING (
    id = app_user_id()
    OR EXISTS (
      SELECT 1 FROM classes c
      JOIN class_enrollments ce ON ce.class_id = c.id
      WHERE c.teacher_id = app_user_id() AND ce.student_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "profiles update own" ON profiles;
CREATE POLICY "profiles update own" ON profiles
  FOR UPDATE USING (id = app_user_id()) WITH CHECK (id = app_user_id());

DROP POLICY IF EXISTS "profiles insert own" ON profiles;
CREATE POLICY "profiles insert own" ON profiles
  FOR INSERT WITH CHECK (id = app_user_id());

DROP POLICY IF EXISTS "classes visible to teachers and enrolled students" ON classes;
CREATE POLICY "classes visible to teachers and enrolled students" ON classes
  FOR SELECT USING (
    teacher_id = app_user_id()
    OR EXISTS (
      SELECT 1 FROM class_enrollments ce
      WHERE ce.class_id = classes.id AND ce.student_id = app_user_id() AND ce.is_active
    )
  );

DROP POLICY IF EXISTS "teachers manage own classes" ON classes;
CREATE POLICY "teachers manage own classes" ON classes
  FOR ALL USING (teacher_id = app_user_id()) WITH CHECK (teacher_id = app_user_id());

DROP POLICY IF EXISTS "students join and read enrollments" ON class_enrollments;
CREATE POLICY "students join and read enrollments" ON class_enrollments
  FOR SELECT USING (
    student_id = app_user_id()
    OR EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND c.teacher_id = app_user_id())
  );

DROP POLICY IF EXISTS "students insert own enrollments" ON class_enrollments;
CREATE POLICY "students insert own enrollments" ON class_enrollments
  FOR INSERT WITH CHECK (student_id = app_user_id());

DROP POLICY IF EXISTS "lessons visible by ownership or assignment" ON lessons;
CREATE POLICY "lessons visible by ownership or assignment" ON lessons
  FOR SELECT USING (
    teacher_id = app_user_id()
    OR EXISTS (
      SELECT 1 FROM lesson_assignments la
      LEFT JOIN class_enrollments ce ON ce.class_id = la.class_id
      WHERE la.lesson_id = lessons.id
        AND la.is_active
        AND (la.student_id = app_user_id() OR ce.student_id = app_user_id())
    )
  );

DROP POLICY IF EXISTS "teachers manage own lessons" ON lessons;
CREATE POLICY "teachers manage own lessons" ON lessons
  FOR ALL USING (teacher_id = app_user_id()) WITH CHECK (teacher_id = app_user_id());

DROP POLICY IF EXISTS "lesson children visible with lesson" ON lesson_sections;
CREATE POLICY "lesson children visible with lesson" ON lesson_sections
  FOR SELECT USING (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id));

DROP POLICY IF EXISTS "teachers manage own lesson sections" ON lesson_sections;
CREATE POLICY "teachers manage own lesson sections" ON lesson_sections
  FOR ALL USING (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id AND l.teacher_id = app_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id AND l.teacher_id = app_user_id()));

DROP POLICY IF EXISTS "questions visible with lesson" ON quiz_questions;
CREATE POLICY "questions visible with lesson" ON quiz_questions
  FOR SELECT USING (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id));

DROP POLICY IF EXISTS "teachers manage own questions" ON quiz_questions;
CREATE POLICY "teachers manage own questions" ON quiz_questions
  FOR ALL USING (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id AND l.teacher_id = app_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id AND l.teacher_id = app_user_id()));

DROP POLICY IF EXISTS "assignments visible by class relationship" ON lesson_assignments;
CREATE POLICY "assignments visible by class relationship" ON lesson_assignments
  FOR SELECT USING (
    assigned_by = app_user_id()
    OR student_id = app_user_id()
    OR EXISTS (SELECT 1 FROM class_enrollments ce WHERE ce.class_id = lesson_assignments.class_id AND ce.student_id = app_user_id())
  );

DROP POLICY IF EXISTS "teachers manage assignments" ON lesson_assignments;
CREATE POLICY "teachers manage assignments" ON lesson_assignments
  FOR ALL USING (assigned_by = app_user_id()) WITH CHECK (assigned_by = app_user_id());

DROP POLICY IF EXISTS "students manage own progress" ON student_progress;
CREATE POLICY "students manage own progress" ON student_progress
  FOR ALL USING (student_id = app_user_id()) WITH CHECK (student_id = app_user_id());

DROP POLICY IF EXISTS "teachers read class progress" ON student_progress;
CREATE POLICY "teachers read class progress" ON student_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons l
      WHERE l.id = lesson_id AND l.teacher_id = app_user_id()
    )
  );

DROP POLICY IF EXISTS "students manage own quiz attempts" ON quiz_attempts;
CREATE POLICY "students manage own quiz attempts" ON quiz_attempts
  FOR ALL USING (student_id = app_user_id()) WITH CHECK (student_id = app_user_id());

DROP POLICY IF EXISTS "teachers read lesson quiz attempts" ON quiz_attempts;
CREATE POLICY "teachers read lesson quiz attempts" ON quiz_attempts
  FOR SELECT USING (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id AND l.teacher_id = app_user_id()));

DROP POLICY IF EXISTS "students manage own ai records" ON socratic_interactions;
CREATE POLICY "students manage own ai records" ON socratic_interactions
  FOR ALL USING (student_id = app_user_id()) WITH CHECK (student_id = app_user_id());

DROP POLICY IF EXISTS "students manage own reflections" ON learning_reflections;
CREATE POLICY "students manage own reflections" ON learning_reflections
  FOR ALL USING (student_id = app_user_id()) WITH CHECK (student_id = app_user_id());

DROP POLICY IF EXISTS "teachers read lesson reflections" ON learning_reflections;
CREATE POLICY "teachers read lesson reflections" ON learning_reflections
  FOR SELECT USING (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id AND l.teacher_id = app_user_id()));

DROP POLICY IF EXISTS "students manage own goals" ON learning_goals;
CREATE POLICY "students manage own goals" ON learning_goals
  FOR ALL USING (student_id = app_user_id()) WITH CHECK (student_id = app_user_id());

DROP POLICY IF EXISTS "students manage own knowledge" ON knowledge_nodes;
CREATE POLICY "students manage own knowledge" ON knowledge_nodes
  FOR ALL USING (student_id = app_user_id()) WITH CHECK (student_id = app_user_id());

DROP POLICY IF EXISTS "teachers read lesson knowledge" ON knowledge_nodes;
CREATE POLICY "teachers read lesson knowledge" ON knowledge_nodes
  FOR SELECT USING (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id AND l.teacher_id = app_user_id()));

DROP POLICY IF EXISTS "teachers manage own alerts" ON teacher_alerts;
CREATE POLICY "teachers manage own alerts" ON teacher_alerts
  FOR ALL USING (teacher_id = app_user_id()) WITH CHECK (teacher_id = app_user_id());

DROP POLICY IF EXISTS "teachers read own analytics" ON lesson_analytics;
CREATE POLICY "teachers read own analytics" ON lesson_analytics
  FOR SELECT USING (teacher_id = app_user_id());

DROP POLICY IF EXISTS "teachers manage own analytics" ON lesson_analytics;
CREATE POLICY "teachers manage own analytics" ON lesson_analytics
  FOR ALL USING (teacher_id = app_user_id()) WITH CHECK (teacher_id = app_user_id());

DROP POLICY IF EXISTS "glossary visible with lesson" ON glossary_terms;
CREATE POLICY "glossary visible with lesson" ON glossary_terms
  FOR SELECT USING (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id));

DROP POLICY IF EXISTS "teachers manage own glossary" ON glossary_terms;
CREATE POLICY "teachers manage own glossary" ON glossary_terms
  FOR ALL USING (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id AND l.teacher_id = app_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id AND l.teacher_id = app_user_id()));

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at
BEFORE UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
CREATE TRIGGER update_lessons_updated_at
BEFORE UPDATE ON lessons
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_learning_goals_updated_at ON learning_goals;
CREATE TRIGGER update_learning_goals_updated_at
BEFORE UPDATE ON learning_goals
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
