CREATE INDEX IF NOT EXISTS idx_lessons_teacher_updated
  ON lessons(teacher_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_lessons_class_status
  ON lessons(class_id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_lesson_sections_lesson_order
  ON lesson_sections(lesson_id, order_index);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_lesson_order
  ON quiz_questions(lesson_id, order_index);

CREATE INDEX IF NOT EXISTS idx_lesson_assignments_student_active
  ON lesson_assignments(student_id, is_active, due_date);

CREATE INDEX IF NOT EXISTS idx_student_progress_lesson_status
  ON student_progress(lesson_id, status, last_active);

CREATE INDEX IF NOT EXISTS idx_learning_submissions_student_work
  ON learning_submissions(student_id, work_item_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_billing_products_catalog
  ON billing_products(tenant_id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_tenant_object_links_tenant_object
  ON tenant_object_links(tenant_id, object_table, object_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at);
