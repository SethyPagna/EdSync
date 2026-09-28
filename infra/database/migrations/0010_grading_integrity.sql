-- EdSync grading integrity (bugs H4, M3, M4).
-- The D1 migration runner re-applies every file, so every statement here is idempotent.

-- 1. Work submission attempt history. One row per submission attempt; learning_submissions keeps the latest response.
CREATE TABLE IF NOT EXISTS learning_submission_attempts (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES learning_submissions(id) ON DELETE CASCADE,
  work_item_id TEXT NOT NULL REFERENCES learning_work_items(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  response TEXT DEFAULT '{}',
  is_late INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(submission_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_learning_submission_attempts_student_work
  ON learning_submission_attempts(student_id, work_item_id, attempt_number);

-- Existing submissions count as attempt 1 (lateness unknown, recorded as on time).
INSERT INTO learning_submission_attempts (
  id, submission_id, work_item_id, student_id, attempt_number, response, is_late, submitted_at, created_at
)
SELECT lower(hex(randomblob(16))), ls.id, ls.work_item_id, ls.student_id, 1, COALESCE(ls.response, '{}'), 0,
       COALESCE(ls.submitted_at, ls.created_at, datetime('now')), datetime('now')
  FROM learning_submissions ls
 WHERE COALESCE(ls.status, 'submitted') IN ('submitted', 'returned', 'graded')
   AND NOT EXISTS (
     SELECT 1 FROM learning_submission_attempts a WHERE a.submission_id = ls.id
   );

-- 2. Record who last wrote each gradebook row (metadata.gradedByRole = teacher | system | student).
--    Automated and student writes never replace a teacher-written row.
-- Manual grades and work-submission grades were always written by teachers.
UPDATE gradebook_scores
   SET metadata = json_set(
         CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END,
         '$.gradedByRole', 'teacher',
         '$.gradedBy', COALESCE(CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.gradedBy') END, teacher_id))
 WHERE source_type <> 'lesson_quiz'
   AND CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.gradedByRole') END IS NULL;

-- Lesson quiz rows last written through the teacher's manual grade endpoint.
UPDATE gradebook_scores
   SET metadata = json_set(
         CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END,
         '$.gradedByRole', 'teacher',
         '$.gradedBy', (
           SELECT le.actor_id
             FROM learning_events le
            WHERE le.id = CASE WHEN json_valid(gradebook_scores.metadata)
                               THEN json_extract(gradebook_scores.metadata, '$.lastEventId') END
         ))
 WHERE source_type = 'lesson_quiz'
   AND CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.gradedByRole') END IS NULL
   AND EXISTS (
     SELECT 1
       FROM learning_events le
      WHERE le.id = CASE WHEN json_valid(gradebook_scores.metadata)
                         THEN json_extract(gradebook_scores.metadata, '$.lastEventId') END
        AND le.event_type = 'grade.manual.recorded'
   );

-- Every other lesson quiz row was a score reported by the student's browser.
UPDATE gradebook_scores
   SET metadata = json_set(CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END, '$.gradedByRole', 'student')
 WHERE source_type = 'lesson_quiz'
   AND CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.gradedByRole') END IS NULL;

-- 3. Discussion threads created for work items belong to the work item's tenant.
INSERT OR IGNORE INTO tenant_object_links (id, tenant_id, portal_id, object_table, object_id, created_at)
SELECT lower(hex(randomblob(16))), work_link.tenant_id, work_link.portal_id, 'discussion_threads', dt.id, datetime('now')
  FROM discussion_threads dt
  JOIN tenant_object_links work_link
    ON work_link.object_table = 'learning_work_items'
   AND work_link.object_id = dt.work_item_id
 WHERE NOT EXISTS (
   SELECT 1
     FROM tenant_object_links thread_link
    WHERE thread_link.object_table = 'discussion_threads'
      AND thread_link.object_id = dt.id
 );
