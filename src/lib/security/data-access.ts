import type { SessionUser } from "@/lib/auth/session";
import type { DataRequest } from "@/lib/db/d1";

const SERVER_ONLY_TABLES = new Set([
  "auth_users",
  "auth_sessions",
  "auth_tokens",
  "ai_runs",
  "automation_jobs",
  "email_messages",
  "rate_limits",
  "security_events",
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

export function authorizeDataRequest(user: SessionUser, request: DataRequest) {
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

  if (
    [
      "learning_goals",
      "learning_reflections",
      "student_progress",
      "quiz_attempts",
      "socratic_interactions",
      "knowledge_nodes",
    ].includes(request.table) &&
    (request.action === "insert" || request.action === "upsert")
  ) {
    return valuesArray(request).every((row) => row.student_id === user.id)
      ? null
      : "Student records must belong to the signed-in student.";
  }

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
