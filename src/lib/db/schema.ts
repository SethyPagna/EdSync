export const TABLES = [
  "profiles",
  "classes",
  "class_enrollments",
  "lessons",
  "lesson_sections",
  "quiz_questions",
  "lesson_assignments",
  "student_progress",
  "quiz_attempts",
  "socratic_interactions",
  "learning_reflections",
  "learning_goals",
  "knowledge_nodes",
  "teacher_alerts",
  "lesson_analytics",
  "glossary_terms",
  "auth_users",
  "auth_sessions",
  "auth_tokens",
  "storage_objects",
  "notifications",
  "email_messages",
  "media_assets",
  "content_extractions",
  "announcements",
  "schedule_events",
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
  "rate_limits",
  "security_events",
  "ai_runs",
  "automation_jobs",
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
  "content_blocks",
  "course_versions",
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
] as const;

export type TableName = (typeof TABLES)[number];

export const JSON_COLUMNS: Record<string, string[]> = {
  profiles: ["subjects", "interests", "preferences", "achievements"],
  classes: ["settings"],
  lessons: ["objectives", "tags", "prerequisites", "personalization"],
  lesson_sections: ["metadata"],
  quiz_questions: ["options"],
  student_progress: ["sections_completed", "knowledge_gaps", "metadata"],
  socratic_interactions: ["conversation_history"],
  teacher_alerts: ["metadata"],
  notifications: ["channels", "metadata"],
  email_messages: ["metadata"],
  media_assets: ["metadata"],
  content_extractions: ["metadata"],
  announcements: ["metadata"],
  schedule_events: ["metadata"],
  admin_audit_logs: ["metadata"],
  feature_flags: ["metadata"],
  ai_provider_configs: ["supported_models"],
  gradebook_scores: ["metadata"],
  learning_work_items: ["rubric", "settings"],
  learning_work_questions: ["options", "metadata"],
  learning_submissions: ["response"],
  discussion_posts: ["metadata"],
  student_notes: ["metadata"],
  email_outbox_events: ["recipients", "metadata"],
  security_events: ["metadata"],
  lesson_analytics: [
    "concept_mastery",
    "common_mistakes",
    "struggling_students",
    "advanced_students",
  ],
  knowledge_nodes: ["evidence"],
  ai_runs: ["request", "response", "metadata"],
  automation_jobs: ["payload", "result"],
  tenants: ["settings"],
  tenant_portals: ["theme", "catalog_settings"],
  tenant_memberships: ["permissions"],
  tenant_runtime_bindings: ["settings"],
  role_profiles: ["permissions"],
  learning_events: ["payload"],
  gradebook_replay_runs: ["result"],
  content_blocks: ["data", "tags"],
  course_versions: ["snapshot"],
  standards_packages: ["manifest"],
  standards_launches: ["runtime_data"],
  xapi_statements: ["statement"],
  certification_rules: ["settings"],
  learner_certifications: ["evidence"],
  automation_rules: ["conditions", "actions"],
  achievements_catalog: ["criteria"],
  billing_customers: ["metadata"],
  billing_products: ["metadata"],
  billing_transactions: ["metadata"],
  entitlements: ["metadata"],
  billing_coupons: ["metadata"],
  billing_webhook_events: ["payload"],
  offline_sync_items: ["payload"],
  analytics_rollups: ["metrics"],
  studio_documents: ["content", "metadata"],
  studio_assets: ["metadata"],
  practice_attempts: ["summary"],
  practice_attempt_items: ["metadata"],
  practice_review_cards: ["metadata"],
};

export const DATE_COLUMNS = new Set([
  "created_at",
  "updated_at",
  "last_active_at",
  "enrolled_at",
  "due_date",
  "started_at",
  "completed_at",
  "last_active",
  "computed_at",
  "expires_at",
  "revoked_at",
  "read_at",
  "sent_at",
  "last_checked_at",
  "graded_at",
  "submitted_at",
  "publish_at",
  "expires_at",
  "starts_at",
  "ends_at",
  "due_at",
  "next_review_at",
]);

export function assertTableName(table: string): asserts table is TableName {
  if (!TABLES.includes(table as TableName)) {
    throw new Error(`Unsupported EdSync table: ${table}`);
  }
}

export function serializeRow<T extends Record<string, unknown>>(table: string, row: T) {
  const jsonColumns = new Set(JSON_COLUMNS[table] ?? []);
  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    if (jsonColumns.has(key) && value !== null && typeof value !== "string") {
      next[key] = JSON.stringify(value);
    } else if (value instanceof Date) {
      next[key] = value.toISOString();
    } else if (typeof value === "boolean") {
      next[key] = value ? 1 : 0;
    } else {
      next[key] = value;
    }
  }

  return next;
}

export function deserializeRow<T = Record<string, unknown>>(
  table: string,
  row: Record<string, unknown>,
): T {
  const jsonColumns = new Set(JSON_COLUMNS[table] ?? []);
  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (jsonColumns.has(key) && typeof value === "string") {
      try {
        next[key] = JSON.parse(value);
      } catch {
        next[key] = value;
      }
      continue;
    }

    if (
      [
        "is_active",
        "ai_generated",
        "is_required",
        "is_diagnostic",
        "is_micro_check",
        "is_final_quiz",
        "diagnostic_completed",
        "is_complete",
        "is_read",
        "is_dismissed",
        "teacher_visibility",
        "enabled",
        "allow_late",
        "is_locked",
        "success",
        "is_default",
        "is_system",
        "active",
      ].includes(key) &&
      typeof value === "number"
    ) {
      next[key] = Boolean(value);
      continue;
    }

    next[key] = value;
  }

  return next as T;
}
