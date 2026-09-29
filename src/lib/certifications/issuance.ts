import { d1Query } from "@/lib/db/d1";
import { DEFAULT_TENANT_ID } from "@/lib/tenancy";
import { tenantObjectJoin, tenantObjectPredicate } from "@/lib/tenancy/object-scope";

// Ten candidates need at most 22 statements, leaving room for session, tenant, and route queries on D1 Free.
const PAGE_SIZE = 10;

type Candidate = {
  cursor: string;
  rule_id: string;
  course_id: string;
  user_id: string;
  expires_after_days: number | null;
  settings: string | Record<string, unknown> | null;
  progress_id: string | null;
  completed_at: string | null;
  grade_id: string | null;
  percent: number | null;
  graded_at: string | null;
};

type Existing = { id: string; status: string; issued_at: string | null };

export type IssueCertificationsInput = {
  tenantId: string;
  studentId?: string;
  ruleId?: string;
  ownerId?: string;
  cursor?: string;
  now?: Date;
};

export type IssueCertificationsResult = {
  examined: number;
  issued: number;
  renewed: number;
  nextCursor: string | null;
};

function sqliteDate(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function timestamp(value: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function settingsOf(value: Candidate["settings"]): Record<string, unknown> {
  try {
    const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function evidenceOf(candidate: Candidate) {
  const settings = settingsOf(candidate.settings);
  const requested = Array.isArray(settings.evidence)
    ? settings.evidence.filter((item): item is string => item === "completion" || item === "score")
    : [];
  const requirements = new Set(requested.length ? requested : ["completion"]);
  const threshold = typeof settings.scoreGte === "number" && Number.isFinite(settings.scoreGte)
    ? Math.min(100, Math.max(0, settings.scoreGte))
    : null;
  if (threshold !== null) requirements.add("score");
  if (requirements.has("completion") && (!candidate.progress_id || !candidate.completed_at)) return null;
  if (requirements.has("score") && (!candidate.grade_id || candidate.percent === null || candidate.percent < (threshold ?? 0))) return null;
  const dates = [requirements.has("completion") ? candidate.completed_at : null, requirements.has("score") ? candidate.graded_at : null];
  const eligibilityAt = Math.max(...dates.map(timestamp));
  if (!eligibilityAt) return null;
  return {
    courseId: candidate.course_id,
    requirements: Array.from(requirements),
    progressId: candidate.progress_id,
    completedAt: candidate.completed_at,
    gradeId: candidate.grade_id,
    percent: candidate.percent,
    gradedAt: candidate.graded_at,
    scoreGte: threshold,
    eligibilityAt: sqliteDate(new Date(eligibilityAt)),
  };
}

export async function issueEligibleCertifications(input: IssueCertificationsInput): Promise<IssueCertificationsResult> {
  const now = input.now ?? new Date();
  const nowText = sqliteDate(now);
  await d1Query(
    `UPDATE learner_certifications SET status = 'expired'
      WHERE tenant_id = ? AND status = 'active' AND expires_at IS NOT NULL
        AND datetime(expires_at) <= datetime(?)
        AND (? IS NULL OR user_id = ?) AND (? IS NULL OR rule_id = ?)`,
    [input.tenantId, nowText, input.studentId ?? null, input.studentId ?? null, input.ruleId ?? null, input.ruleId ?? null],
  );

  const rows = await d1Query<Candidate>(
    `SELECT cr.id || char(31) || tm.user_id AS cursor,
            cr.id AS rule_id, cr.course_id, cr.expires_after_days, cr.settings,
            tm.user_id, sp.id AS progress_id, sp.completed_at,
            gs.id AS grade_id, gs.percent, COALESCE(gs.graded_at, gs.updated_at, gs.created_at) AS graded_at
       FROM certification_rules cr
       JOIN lessons l ON l.id = cr.course_id AND l.status = 'published'
       ${tenantObjectJoin({ objectTable: "lessons", objectAlias: "l", linkAlias: "lesson_link" })}
       LEFT JOIN classes c ON c.id = l.class_id
       ${tenantObjectJoin({ objectTable: "classes", objectAlias: "c", linkAlias: "class_link" })}
       JOIN tenant_memberships tm ON tm.tenant_id = cr.tenant_id AND tm.status = 'active'
       JOIN profiles p ON p.id = tm.user_id AND p.role = 'student'
       LEFT JOIN student_progress sp ON sp.student_id = tm.user_id AND sp.lesson_id = l.id AND sp.status = 'completed'
       LEFT JOIN gradebook_scores gs ON gs.student_id = tm.user_id AND gs.source_type = 'lesson_quiz'
              AND gs.source_id = l.id AND gs.status = 'graded'
      WHERE cr.tenant_id = ?
        AND (lesson_link.id IS NULL OR lesson_link.tenant_id = ?)
        AND (class_link.id IS NULL OR class_link.tenant_id = ?)
        AND (${tenantObjectPredicate({ linkAlias: "lesson_link" })}
          OR (l.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
        AND (sp.id IS NOT NULL OR gs.id IS NOT NULL)
        AND (? IS NULL OR cr.id = ?)
        AND (? IS NULL OR tm.user_id = ?)
        AND (? IS NULL OR CASE WHEN json_valid(cr.settings) THEN json_extract(cr.settings, '$.ownerId') END = ?)
        AND (cr.id || char(31) || tm.user_id) > ?
      ORDER BY cr.id, tm.user_id LIMIT ?`,
    [
      "lessons", "classes", input.tenantId,
      input.tenantId, input.tenantId,
      input.tenantId, input.tenantId, DEFAULT_TENANT_ID,
      input.tenantId, input.tenantId, DEFAULT_TENANT_ID,
      input.ruleId ?? null, input.ruleId ?? null,
      input.studentId ?? null, input.studentId ?? null,
      input.ownerId ?? null, input.ownerId ?? null,
      input.cursor ?? "", PAGE_SIZE,
    ],
  );

  let issued = 0;
  let renewed = 0;
  for (const row of rows) {
    const evidence = evidenceOf(row);
    if (!evidence) continue;
    const settings = settingsOf(row.settings);
    const [existing] = await d1Query<Existing>(
      "SELECT id, status, issued_at FROM learner_certifications WHERE tenant_id = ? AND rule_id = ? AND user_id = ? LIMIT 1",
      [input.tenantId, row.rule_id, row.user_id],
    );
    const days = row.expires_after_days && row.expires_after_days > 0 ? row.expires_after_days : null;
    const expiresAt = days ? sqliteDate(new Date(now.getTime() + days * 86_400_000)) : null;
    if (existing) {
      if (settings.renewal === "none") continue;
      const renewalDays = settings.renewal === "annual" ? 365 : settings.renewal === "biennial" ? 730 : 0;
      if (renewalDays && now.getTime() - timestamp(existing.issued_at) < renewalDays * 86_400_000) continue;
      if (existing.status !== "expired" || timestamp(evidence.eligibilityAt) <= timestamp(existing.issued_at)) continue;
      const updated = await d1Query<{ id: string }>(
        `UPDATE learner_certifications SET status = 'active', issued_at = ?, expires_at = ?, evidence = ?
          WHERE id = ? AND tenant_id = ? AND status = 'expired' AND datetime(issued_at) < datetime(?) RETURNING id`,
        [nowText, expiresAt, JSON.stringify(evidence), existing.id, input.tenantId, evidence.eligibilityAt],
      );
      renewed += updated.length;
      continue;
    }
    const inserted = await d1Query<{ id: string }>(
      `INSERT OR IGNORE INTO learner_certifications
         (id, tenant_id, rule_id, user_id, status, issued_at, expires_at, evidence)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?) RETURNING id`,
      [crypto.randomUUID(), input.tenantId, row.rule_id, row.user_id, nowText, expiresAt, JSON.stringify(evidence)],
    );
    issued += inserted.length;
  }
  return { examined: rows.length, issued, renewed, nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].cursor : null };
}
