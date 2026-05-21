import type { SessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import type { DataRequest } from "@/lib/db/d1";
import type { TableName } from "@/lib/db/schema";

const SERVER_ONLY_TABLES = new Set([
  "auth_users",
  "auth_sessions",
  "auth_tokens",
  "ai_runs",
  "automation_jobs",
  "email_messages",
  "rate_limits",
  "security_events",
  "admin_users",
  "admin_audit_logs",
  "feature_flags",
  "ai_provider_configs",
  "gradebook_categories",
  "gradebook_scores",
  "learning_work_items",
  "learning_work_questions",
  "learning_submissions",
  "discussion_threads",
  "discussion_posts",
  "student_notes",
  "email_outbox_events",
  "tenants",
  "tenant_portals",
  "tenant_memberships",
  "tenant_domains",
  "tenant_runtime_bindings",
  "tenant_object_links",
  "permission_catalog",
  "role_profiles",
  "learning_events",
  "gradebook_replay_runs",
  "standards_packages",
  "standards_launches",
  "xapi_statements",
  "certification_rules",
  "learner_certifications",
  "automation_rules",
  "achievements_catalog",
  "user_achievements",
  "billing_customers",
  "billing_products",
  "billing_prices",
  "billing_bundles",
  "billing_subscriptions",
  "billing_invoices",
  "billing_transactions",
  "entitlements",
  "billing_coupons",
  "billing_webhook_events",
  "offline_sync_items",
  "analytics_rollups",
  "studio_documents",
  "studio_assets",
  "practice_attempts",
  "practice_attempt_items",
  "practice_review_cards",
]);

const STUDENT_OWNED_TABLES = new Set<TableName>([
  "learning_goals",
  "learning_reflections",
  "student_progress",
  "quiz_attempts",
  "socratic_interactions",
  "knowledge_nodes",
]);

function hasFilter(request: DataRequest, column: string, value: unknown) {
  return (request.filters ?? []).some(
    (filter) => filter.op === "eq" && filter.column === column && filter.value === value,
  );
}

function valuesArray(request: DataRequest) {
  if (!request.values) return [];
  return Array.isArray(request.values) ? request.values : [request.values];
}

function eqValue(request: DataRequest, column: string) {
  return (request.filters ?? []).find((filter) => filter.op === "eq" && filter.column === column)?.value;
}

async function lessonBelongsToTeacher(userId: string, lessonId: unknown) {
  if (typeof lessonId !== "string" || !lessonId) return false;
  const [lesson] = await d1Query<{ id: string }>("SELECT id FROM lessons WHERE id = ? AND teacher_id = ? LIMIT 1", [lessonId, userId]);
  return Boolean(lesson);
}

async function classBelongsToTeacher(userId: string, classId: unknown) {
  if (typeof classId !== "string" || !classId) return false;
  const [klass] = await d1Query<{ id: string }>("SELECT id FROM classes WHERE id = ? AND teacher_id = ? LIMIT 1", [classId, userId]);
  return Boolean(klass);
}

async function lessonChildBelongsToTeacher(userId: string, table: "lesson_sections" | "quiz_questions" | "glossary_terms", id: unknown) {
  if (typeof id !== "string" || !id) return false;
  const [row] = await d1Query<{ id: string }>(
    `SELECT child.id
       FROM ${table} child
       JOIN lessons l ON l.id = child.lesson_id
      WHERE child.id = ? AND l.teacher_id = ?
      LIMIT 1`,
    [id, userId],
  );
  return Boolean(row);
}

async function lessonAssignmentBelongsToTeacher(userId: string, assignmentId: unknown) {
  if (typeof assignmentId !== "string" || !assignmentId) return false;
  const [assignment] = await d1Query<{ id: string }>(
    `SELECT la.id
       FROM lesson_assignments la
       JOIN lessons l ON l.id = la.lesson_id
      WHERE la.id = ? AND (l.teacher_id = ? OR la.assigned_by = ?)
      LIMIT 1`,
    [assignmentId, userId, userId],
  );
  return Boolean(assignment);
}

async function classEnrollmentBelongsToTeacher(userId: string, enrollmentId: unknown) {
  if (typeof enrollmentId !== "string" || !enrollmentId) return false;
  const [enrollment] = await d1Query<{ id: string }>(
    `SELECT ce.id
       FROM class_enrollments ce
       JOIN classes c ON c.id = ce.class_id
      WHERE ce.id = ? AND c.teacher_id = ?
      LIMIT 1`,
    [enrollmentId, userId],
  );
  return Boolean(enrollment);
}

async function authorizeTeacherOwnedWrite(user: SessionUser, request: DataRequest) {
  if (!["update", "delete"].includes(request.action)) return null;

  if (request.table === "classes") {
    if (hasFilter(request, "teacher_id", user.id)) return null;
    return (await classBelongsToTeacher(user.id, eqValue(request, "id"))) ? null : "Class changes must target a class owned by the signed-in teacher.";
  }

  if (request.table === "lessons") {
    if (hasFilter(request, "teacher_id", user.id)) return null;
    return (await lessonBelongsToTeacher(user.id, eqValue(request, "id"))) ? null : "Lesson changes must target a lesson owned by the signed-in teacher.";
  }

  if (request.table === "lesson_sections" || request.table === "quiz_questions" || request.table === "glossary_terms") {
    const lessonId = eqValue(request, "lesson_id");
    if (await lessonBelongsToTeacher(user.id, lessonId)) return null;
    return (await lessonChildBelongsToTeacher(user.id, request.table, eqValue(request, "id")))
      ? null
      : "Lesson content changes must target content owned by the signed-in teacher.";
  }

  if (request.table === "lesson_assignments") {
    if (await lessonBelongsToTeacher(user.id, eqValue(request, "lesson_id"))) return null;
    return (await lessonAssignmentBelongsToTeacher(user.id, eqValue(request, "id")))
      ? null
      : "Assignment changes must target a lesson owned by the signed-in teacher.";
  }

  return null;
}

async function authorizeTeacherOwnedInsert(user: SessionUser, request: DataRequest) {
  if (!["insert", "upsert"].includes(request.action)) return null;
  if (request.table !== "lesson_sections" && request.table !== "quiz_questions" && request.table !== "glossary_terms") return null;

  const rows = valuesArray(request);
  for (const row of rows) {
    if (!(await lessonBelongsToTeacher(user.id, row.lesson_id))) {
      return "Lesson content can only be added to lessons owned by the signed-in teacher.";
    }
  }
  return null;
}

async function recordBelongsToStudent(userId: string, table: TableName, id: unknown) {
  if (typeof id !== "string" || !id) return false;
  const [row] = await d1Query<{ id: string }>(`SELECT id FROM ${table} WHERE id = ? AND student_id = ? LIMIT 1`, [id, userId]);
  return Boolean(row);
}

async function authorizeStudentOwnedWrite(user: SessionUser, request: DataRequest) {
  if (!STUDENT_OWNED_TABLES.has(request.table)) return null;

  if (request.action === "insert" || request.action === "upsert") {
    return valuesArray(request).every((row) => row.student_id === user.id)
      ? null
      : "Student records must belong to the signed-in student.";
  }

  if (request.action === "update" || request.action === "delete") {
    if (hasFilter(request, "student_id", user.id)) return null;
    return (await recordBelongsToStudent(user.id, request.table, eqValue(request, "id")))
      ? null
      : "Student record changes must target the signed-in student.";
  }

  return null;
}

async function authorizeClassEnrollmentWrite(user: SessionUser, request: DataRequest) {
  if (request.table !== "class_enrollments") return null;
  if (user.user_metadata.role === "admin") return null;

  if (request.action === "insert" || request.action === "upsert") {
    const rows = valuesArray(request);
    if (user.user_metadata.role === "student") {
      return rows.every((row) => row.student_id === user.id) ? null : "Students can only join classes as themselves.";
    }
    if (user.user_metadata.role === "teacher") {
      for (const row of rows) {
        if (!(await classBelongsToTeacher(user.id, row.class_id))) {
          return "Teachers can only manage enrollments for their own classes.";
        }
      }
      return null;
    }
  }

  if (request.action === "update" || request.action === "delete") {
    if (user.user_metadata.role === "student") {
      return hasFilter(request, "student_id", user.id) ? null : "Students can only change their own class enrollment.";
    }
    if (user.user_metadata.role === "teacher") {
      if (await classBelongsToTeacher(user.id, eqValue(request, "class_id"))) return null;
      return (await classEnrollmentBelongsToTeacher(user.id, eqValue(request, "id")))
        ? null
        : "Teachers can only manage enrollments for their own classes.";
    }
  }

  return null;
}

export async function authorizeDataRequest(user: SessionUser, request: DataRequest) {
  if (SERVER_ONLY_TABLES.has(request.table)) {
    return "This table is server-only.";
  }

  if (request.table === "profiles") {
    if (request.action === "update" || request.action === "delete") {
      return hasFilter(request, "id", user.id) ? null : "Profiles can only be changed by their owner.";
    }
    if (request.action === "insert" || request.action === "upsert") {
      return valuesArray(request).every((row) => row.id === user.id)
        ? null
        : "Profiles can only be created by their owner.";
    }
  }

  if (request.table === "classes") {
    if (request.action === "insert" || request.action === "upsert") {
      return valuesArray(request).every((row) => row.teacher_id === user.id)
        ? null
        : "Classes must belong to the signed-in teacher.";
    }
  }

  if (request.table === "lessons") {
    if (request.action === "insert" || request.action === "upsert") {
      return valuesArray(request).every((row) => row.teacher_id === user.id)
        ? null
        : "Lessons must belong to the signed-in teacher.";
    }
  }

  const teacherOwnedInsertDenied = await authorizeTeacherOwnedInsert(user, request);
  if (teacherOwnedInsertDenied) return teacherOwnedInsertDenied;

  const teacherOwnedWriteDenied = await authorizeTeacherOwnedWrite(user, request);
  if (teacherOwnedWriteDenied) return teacherOwnedWriteDenied;

  const classEnrollmentWriteDenied = await authorizeClassEnrollmentWrite(user, request);
  if (classEnrollmentWriteDenied) return classEnrollmentWriteDenied;

  const studentOwnedWriteDenied = await authorizeStudentOwnedWrite(user, request);
  if (studentOwnedWriteDenied) return studentOwnedWriteDenied;

  if (request.table === "lesson_assignments" && (request.action === "insert" || request.action === "upsert")) {
    return valuesArray(request).every((row) => row.assigned_by === user.id)
      ? null
      : "Assignments must be created by the signed-in teacher.";
  }

  if (request.table === "storage_objects" || request.table === "media_assets") {
    return "Use the storage API for file records.";
  }

  return null;
}
