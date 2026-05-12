-- Demo data for local development and Supabase staging.
-- These UUIDs are stable so screenshots, smoke tests, and docs can reference them.

SET row_security = off;

INSERT INTO profiles (id, email, full_name, role, school, grade_level, subjects, interests, total_xp, streak_days)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'teacher@edsync.demo', 'Maya Chen', 'teacher', 'EdSync Demo School', 'Grade 8', ARRAY['Science','Mathematics'], ARRAY['project-based learning','formative assessment'], 0, 0),
  ('22222222-2222-2222-2222-222222222222', 'student@edsync.demo', 'Jordan Rivera', 'student', 'EdSync Demo School', 'Grade 8', ARRAY['Science'], ARRAY['space','climate','visual learning'], 860, 5)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  school = EXCLUDED.school,
  grade_level = EXCLUDED.grade_level,
  subjects = EXCLUDED.subjects,
  interests = EXCLUDED.interests,
  total_xp = EXCLUDED.total_xp,
  streak_days = EXCLUDED.streak_days;

INSERT INTO classes (id, teacher_id, name, description, subject, grade_level, join_code)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Grade 8 Science Studio',
  'A demo class focused on inquiry, retrieval practice, and reflective learning.',
  'Science',
  'Grade 8',
  'EDSYNC8'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  grade_level = EXCLUDED.grade_level,
  join_code = EXCLUDED.join_code;

INSERT INTO class_enrollments (class_id, student_id)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (class_id, student_id) DO NOTHING;

INSERT INTO lessons (
  id, teacher_id, class_id, title, description, objectives, subject, grade_level,
  status, difficulty, estimated_duration, tags, ai_generated, personalization
)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'How Ecosystems Stay Balanced',
  'Students learn how energy, populations, and environmental pressures interact in an ecosystem.',
  ARRAY['Explain food webs', 'Predict population changes', 'Use evidence to support ecosystem claims'],
  'Science',
  'Grade 8',
  'published',
  'intermediate',
  42,
  ARRAY['ecosystems','science','inquiry'],
  true,
  '{"recommended_for":["visual learners","students who like real-world cases"]}'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  personalization = EXCLUDED.personalization;

INSERT INTO lesson_sections (id, lesson_id, title, content, content_type, order_index, duration_minutes)
VALUES
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444444', 'Launch: The Pond Problem', '<p><strong>Core idea:</strong> Ecosystems shift when one part changes.</p><p>Imagine a pond where insects disappear. Fish lose food, birds lose fish, and algae may grow differently. Your job is to trace those changes like a detective.</p>', 'text', 0, 8),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444444', 'Food Webs And Energy', '<p><strong>Worked example:</strong> Grass stores energy from sunlight. A rabbit eats grass, a fox eats the rabbit, and decomposers recycle nutrients. Energy moves, but not all of it transfers.</p>', 'text', 1, 12),
  ('55555555-5555-5555-5555-555555555553', '44444444-4444-4444-4444-444444444444', 'Practice: Predict The Ripple', '<p>Choose one organism and predict what happens if its population doubles. Explain who benefits, who struggles, and what evidence would prove your claim.</p>', 'activity', 2, 14)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  content_type = EXCLUDED.content_type,
  order_index = EXCLUDED.order_index,
  duration_minutes = EXCLUDED.duration_minutes;

INSERT INTO quiz_questions (id, lesson_id, question_text, question_type, options, correct_answer, explanation, difficulty, is_diagnostic, is_micro_check, is_final_quiz, order_index)
VALUES
  ('66666666-6666-6666-6666-666666666661', '44444444-4444-4444-4444-444444444444', 'What does a food web show?', 'multiple_choice', '[{"id":"a","text":"Only one animal eating another","is_correct":false},{"id":"b","text":"How energy and matter move through connected organisms","is_correct":true},{"id":"c","text":"The weather in an ecosystem","is_correct":false},{"id":"d","text":"The age of every organism","is_correct":false}]', 'b', 'A food web shows connected feeding relationships and energy movement.', 'beginner', true, false, false, 0),
  ('66666666-6666-6666-6666-666666666662', '44444444-4444-4444-4444-444444444444', 'If rabbits increase sharply, what might happen first?', 'multiple_choice', '[{"id":"a","text":"More pressure on grass","is_correct":true},{"id":"b","text":"Foxes immediately disappear","is_correct":false},{"id":"c","text":"The sun produces less energy","is_correct":false},{"id":"d","text":"Decomposers stop working","is_correct":false}]', 'a', 'More rabbits would likely consume more grass first.', 'intermediate', false, true, false, 1)
ON CONFLICT (id) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation;

INSERT INTO lesson_assignments (lesson_id, class_id, assigned_by)
VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

INSERT INTO student_progress (student_id, lesson_id, status, sections_completed, score, diagnostic_completed, diagnostic_score, final_quiz_score, knowledge_gaps, started_at, last_active, metadata)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444',
  'in_progress',
  ARRAY['55555555-5555-5555-5555-555555555551'::uuid],
  74,
  true,
  80,
  null,
  ARRAY['energy transfer'],
  now() - interval '2 days',
  now() - interval '3 hours',
  '{"recommended_next":"Review energy transfer before the final quiz"}'
)
ON CONFLICT (student_id, lesson_id) DO UPDATE SET
  status = EXCLUDED.status,
  sections_completed = EXCLUDED.sections_completed,
  score = EXCLUDED.score,
  metadata = EXCLUDED.metadata,
  last_active = EXCLUDED.last_active;

INSERT INTO learning_goals (student_id, title, target_type, target_value, current_value, due_date)
VALUES ('22222222-2222-2222-2222-222222222222', 'Finish two science checkpoints', 'weekly_lessons', 2, 1, current_date + 5)
ON CONFLICT DO NOTHING;

INSERT INTO learning_reflections (student_id, lesson_id, confidence, reflection, ai_feedback, next_step)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444',
  3,
  'I understand food chains, but food webs still feel complicated.',
  'You already have the linear idea. Next, focus on how one organism can connect to several paths.',
  'Draw a three-organism chain, then add two more connections.'
)
ON CONFLICT DO NOTHING;

INSERT INTO teacher_alerts (teacher_id, student_id, lesson_id, alert_type, title, message, action_suggestion)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444',
  'intervention',
  'Jordan may need an energy-transfer check-in',
  'Recent progress shows a knowledge gap around energy transfer.',
  'Assign a quick diagram prompt before the final quiz.'
)
ON CONFLICT DO NOTHING;
