-- Optional demo rows for a fresh EdSync D1 database. Create real users through signup
-- so password hashes and sessions are generated correctly.

INSERT OR IGNORE INTO auth_users (id, email, password_hash)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'teacher@edsync.demo', 'disabled'),
  ('22222222-2222-2222-2222-222222222222', 'student@edsync.demo', 'disabled');

INSERT OR IGNORE INTO profiles (
  id, email, full_name, role, school, grade_level, subjects, interests, total_xp, streak_days
) VALUES
  ('11111111-1111-1111-1111-111111111111', 'teacher@edsync.demo', 'Maya Chen', 'teacher', 'EdSync Demo School', 'Grade 8', '["Science","Mathematics"]', '["project-based learning","formative assessment"]', 0, 0),
  ('22222222-2222-2222-2222-222222222222', 'student@edsync.demo', 'Jordan Rivera', 'student', 'EdSync Demo School', 'Grade 8', '["Science"]', '["space","climate","visual learning"]', 860, 5);

INSERT OR IGNORE INTO classes (id, teacher_id, name, subject, grade_level, join_code)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Grade 8 Science', 'Science', 'Grade 8', 'EDSYNC8');

INSERT OR IGNORE INTO class_enrollments (id, class_id, student_id)
VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222');
