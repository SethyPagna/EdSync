import { AUTOMATION_TRIGGERS, normalizeAutomationRulePayload, type NormalizedAutomationRule } from "../../../src/lib/automation/rules";

const PAGE_SIZE = 50;
const MAX_RULES_PER_SWEEP = 16;
const MAX_CANDIDATES_PER_RULE = 30;
const MAX_D1_OPERATIONS = 36;
const MAX_ACTIONS = 12;
const SWEEP_STATE_ID = "automation-rule-sweep-state";

type StoredRule = {
  id: string;
  tenant_id: string;
  title: string;
  trigger_key: string;
  conditions: string;
  actions: string;
  enabled: number;
};

type Candidate = { cursor: string };

type RuleCandidate = Candidate & {
  recipient_id: string;
  source_id: string;
  source_title?: string;
  due_at?: string;
  expires_at?: string;
  activity_at?: string;
  percent?: number;
};

type SweepResult = {
  rulesProcessed: number;
  rulesSkipped: number;
  candidatesExamined: number;
  notificationsCreated: number;
  badgesAwarded: number;
  capacityReached: boolean;
};

type RuleContext = {
  env: AutomationEnv;
  stored: StoredRule;
  rule: NormalizedAutomationRule;
  result: SweepResult;
  budget: { used: number; insufficient: boolean };
  badgeIds: string[];
  notify: boolean;
};

function readRule(stored: StoredRule): NormalizedAutomationRule | null {
  try {
    const rule = normalizeAutomationRulePayload({
      title: stored.title,
      triggerKey: stored.trigger_key,
      conditions: JSON.parse(stored.conditions),
      actions: JSON.parse(stored.actions),
      enabled: Boolean(stored.enabled),
    });
    return rule.actions.length <= MAX_ACTIONS ? rule : null;
  } catch {
    return null;
  }
}

function badgeCatalogId(tenantId: string, ruleId: string, badge: string) {
  return `automation-badge:${tenantId}:${ruleId}:${badge}`;
}

async function insertNotice(context: RuleContext, input: {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string;
  sourceId: string;
}) {
  const write = await context.env.EDSYNC_DB.prepare(
    `INSERT OR IGNORE INTO notifications
       (id, user_id, type, title, message, action_url, priority, channels, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'normal', '["in_app"]', ?, datetime('now'))`,
  ).bind(
    input.id,
    input.recipientId,
    input.type,
    input.title,
    input.message,
    input.actionUrl,
    JSON.stringify({ tenantId: context.stored.tenant_id, ruleId: context.stored.id, sourceId: input.sourceId }),
  ).run();
  context.budget.used += 1;
  context.result.notificationsCreated += write.meta.changes ?? 0;
}

async function awardBadges(context: RuleContext, recipientId: string) {
  for (const achievementId of context.badgeIds) {
    const badge = achievementId.slice(achievementId.lastIndexOf(":") + 1);
    await context.env.EDSYNC_DB.prepare(
      `INSERT OR IGNORE INTO achievements_catalog
         (id, tenant_id, title, description, icon, criteria, points, created_at, updated_at)
       VALUES (?, ?, ?, 'Awarded for a mastery score.', 'award', ?, 0, datetime('now'), datetime('now'))`,
    ).bind(
      achievementId,
      context.stored.tenant_id,
      badge.replace(/[_-]/g, " "),
      JSON.stringify({ source: "automation", ruleId: context.stored.id, badge }),
    ).run();
    context.budget.used += 1;
    const write = await context.env.EDSYNC_DB.prepare(
      `INSERT OR IGNORE INTO user_achievements
         (id, tenant_id, user_id, achievement_id, earned_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    ).bind(
      `automation-award:${context.stored.id}:${recipientId}:${badge}`,
      context.stored.tenant_id,
      recipientId,
      achievementId,
    ).run();
    context.budget.used += 1;
    context.result.badgesAwarded += write.meta.changes ?? 0;
  }
}

async function pageCandidates<T extends Candidate>(
  context: RuleContext,
  sql: string,
  parameters: Array<string | number>,
  process: (candidate: T) => Promise<void>,
) {
  const writesPerCandidate = context.badgeIds.length * 2 + (context.notify ? 1 : 0);
  const affordable = Math.floor((MAX_D1_OPERATIONS - context.budget.used - 2) / writesPerCandidate);
  const limit = Math.min(PAGE_SIZE, MAX_CANDIDATES_PER_RULE, affordable);
  if (limit < 1) {
    context.budget.insufficient = true;
    context.result.capacityReached = true;
    return;
  }
  const query = await context.env.EDSYNC_DB.prepare(sql).bind(...parameters, "", limit).all<T>();
  context.budget.used += 1;
  const candidates = query.results ?? [];
  for (const candidate of candidates) {
    context.result.candidatesExamined += 1;
    await process(candidate);
  }
  if (candidates.length === limit) context.result.capacityReached = true;
}

async function runInactive(context: RuleContext) {
  const days = Number(context.rule.conditions.inactiveDays);
  await pageCandidates<RuleCandidate>(
    context,
    `WITH learner_activity AS (
       SELECT tm.user_id AS cursor, tm.user_id AS recipient_id, tm.user_id AS source_id,
              MAX(
                COALESCE(datetime(tm.created_at), datetime('now')),
                COALESCE((SELECT MAX(datetime(le.created_at)) FROM learning_events le
                           WHERE le.tenant_id = tm.tenant_id AND le.actor_id = tm.user_id),
                          COALESCE(datetime(tm.created_at), datetime('now'))),
                COALESCE((SELECT MAX(datetime(sp.last_active))
                            FROM student_progress sp
                            JOIN lessons l ON l.id = sp.lesson_id
                            LEFT JOIN tenant_object_links lesson_link
                              ON lesson_link.object_table = 'lessons' AND lesson_link.object_id = l.id
                            LEFT JOIN tenant_object_links class_link
                              ON class_link.object_table = 'classes' AND class_link.object_id = l.class_id
                           WHERE sp.student_id = tm.user_id
                             AND (lesson_link.tenant_id = tm.tenant_id
                               OR (lesson_link.id IS NULL AND class_link.tenant_id = tm.tenant_id
                                 AND EXISTS (SELECT 1 FROM class_enrollments ce
                                              WHERE ce.class_id = l.class_id AND ce.student_id = tm.user_id
                                                AND ce.is_active = 1)))), COALESCE(datetime(tm.created_at), datetime('now')))
              ) AS activity_at
         FROM tenant_memberships tm
         JOIN profiles p ON p.id = tm.user_id AND p.role = 'student'
        WHERE tm.tenant_id = ? AND tm.status = 'active'
     )
     SELECT * FROM learner_activity la
      WHERE datetime(la.activity_at) <= datetime('now', '-' || ? || ' days')
        AND NOT EXISTS (SELECT 1 FROM notifications n
                         WHERE n.id = 'automation:' || ? || ':inactive:' || la.recipient_id || ':' || la.activity_at)
        AND la.cursor > ?
      ORDER BY la.cursor LIMIT ?`,
    [context.stored.tenant_id, days, context.stored.id],
    async (candidate) => {
      await insertNotice(context, {
        id: `automation:${context.stored.id}:inactive:${candidate.recipient_id}:${candidate.activity_at}`,
        recipientId: candidate.recipient_id,
        type: AUTOMATION_TRIGGERS.learnerInactive,
        title: "Ready to continue?",
        message: "Your learning space is ready when you are.",
        actionUrl: "/student/dashboard",
        sourceId: candidate.source_id,
      });
    },
  );
}

async function runMastery(context: RuleContext) {
  const minimum = Number(context.rule.conditions.scoreGte);
  const missingEffects: string[] = [];
  const effectParams: string[] = [];
  if (context.notify) {
    missingEffects.push("NOT EXISTS (SELECT 1 FROM notifications n WHERE n.id = 'automation:' || ? || ':score:' || gs.id)");
    effectParams.push(context.stored.id);
  }
  for (const badgeId of context.badgeIds) {
    missingEffects.push("NOT EXISTS (SELECT 1 FROM user_achievements ua WHERE ua.user_id = gs.student_id AND ua.achievement_id = ?)");
    effectParams.push(badgeId);
  }
  await pageCandidates<RuleCandidate>(
    context,
    `SELECT gs.id AS cursor, gs.student_id AS recipient_id, gs.id AS source_id,
            gs.title AS source_title, gs.percent
       FROM gradebook_scores gs
       JOIN tenant_memberships learner ON learner.tenant_id = ? AND learner.user_id = gs.student_id AND learner.status = 'active'
       LEFT JOIN tenant_object_links score_link
         ON score_link.object_table = 'gradebook_scores' AND score_link.object_id = gs.id
       LEFT JOIN tenant_object_links class_link
         ON class_link.object_table = 'classes' AND class_link.object_id = gs.class_id
       LEFT JOIN class_enrollments ce
         ON ce.class_id = gs.class_id AND ce.student_id = gs.student_id AND ce.is_active = 1
      WHERE gs.status = 'graded' AND gs.percent >= ?
        AND (score_link.id IS NULL OR score_link.tenant_id = ?)
        AND ((gs.class_id IS NULL AND score_link.tenant_id = ?)
          OR (gs.class_id IS NOT NULL AND class_link.tenant_id = ? AND ce.id IS NOT NULL))
        AND (${missingEffects.join(" OR ")})
        AND gs.id > ?
      ORDER BY gs.id LIMIT ?`,
    [context.stored.tenant_id, minimum, context.stored.tenant_id, context.stored.tenant_id, context.stored.tenant_id, ...effectParams],
    async (candidate) => {
      if (context.badgeIds.length) await awardBadges(context, candidate.recipient_id);
      if (context.notify) await insertNotice(context, {
        id: `automation:${context.stored.id}:score:${candidate.source_id}`,
        recipientId: candidate.recipient_id,
        type: AUTOMATION_TRIGGERS.scoreMastery,
        title: "Mastery reached",
        message: `You scored ${Math.round(candidate.percent ?? 0)}% on ${candidate.source_title ?? "your work"}.`,
        actionUrl: "/student/grades",
        sourceId: candidate.source_id,
      });
    },
  );
}

async function runDeadline(context: RuleContext) {
  const hours = Number(context.rule.conditions.hoursBeforeDue);
  await pageCandidates<RuleCandidate>(
    context,
    `SELECT wi.id || char(31) || ce.student_id AS cursor,
            ce.student_id AS recipient_id, wi.id AS source_id, wi.title AS source_title, wi.due_at
       FROM learning_work_items wi
       JOIN tenant_object_links work_link
         ON work_link.object_table = 'learning_work_items' AND work_link.object_id = wi.id AND work_link.tenant_id = ?
       JOIN classes c ON c.id = wi.class_id AND c.is_active = 1
       JOIN tenant_object_links class_link
         ON class_link.object_table = 'classes' AND class_link.object_id = c.id AND class_link.tenant_id = work_link.tenant_id
       JOIN class_enrollments ce ON ce.class_id = c.id AND ce.is_active = 1
       JOIN tenant_memberships learner
         ON learner.tenant_id = work_link.tenant_id AND learner.user_id = ce.student_id AND learner.status = 'active'
      WHERE wi.status = 'published' AND wi.due_at > datetime('now')
        AND wi.due_at <= datetime('now', '+' || ? || ' hours')
        AND NOT EXISTS (SELECT 1 FROM learning_submissions ls
                         WHERE ls.work_item_id = wi.id AND ls.student_id = ce.student_id
                           AND ls.status IN ('submitted', 'returned', 'graded'))
        AND NOT EXISTS (SELECT 1 FROM notifications n
                         WHERE n.id = 'automation:' || ? || ':deadline:' || wi.id || ':' || ce.student_id || ':' || wi.due_at)
        AND (wi.id || char(31) || ce.student_id) > ?
      ORDER BY cursor LIMIT ?`,
    [context.stored.tenant_id, hours, context.stored.id],
    async (candidate) => {
      await insertNotice(context, {
        id: `automation:${context.stored.id}:deadline:${candidate.source_id}:${candidate.recipient_id}:${candidate.due_at}`,
        recipientId: candidate.recipient_id,
        type: AUTOMATION_TRIGGERS.deadlineUpcoming,
        title: "Work due soon",
        message: `${candidate.source_title ?? "Your work"} is due on ${candidate.due_at?.slice(0, 16) ?? "soon"}.`,
        actionUrl: "/student/work",
        sourceId: candidate.source_id,
      });
    },
  );
}

async function runCertification(context: RuleContext) {
  const days = Number(context.rule.conditions.daysBeforeExpiry);
  await pageCandidates<RuleCandidate>(
    context,
    `SELECT lc.id AS cursor, lc.user_id AS recipient_id, lc.id AS source_id,
            cr.title AS source_title, lc.expires_at
       FROM learner_certifications lc
       JOIN certification_rules cr ON cr.id = lc.rule_id AND cr.tenant_id = lc.tenant_id
       JOIN tenant_memberships learner
         ON learner.tenant_id = lc.tenant_id AND learner.user_id = lc.user_id AND learner.status = 'active'
      WHERE lc.tenant_id = ? AND lc.status = 'active'
        AND lc.expires_at > datetime('now')
        AND lc.expires_at <= datetime('now', '+' || ? || ' days')
        AND NOT EXISTS (SELECT 1 FROM notifications n
                         WHERE n.id = 'certification-expiry:' || lc.id || ':' || lc.expires_at)
        AND lc.id > ?
      ORDER BY lc.id LIMIT ?`,
    [context.stored.tenant_id, days],
    async (candidate) => {
      await insertNotice(context, {
        id: `certification-expiry:${candidate.source_id}:${candidate.expires_at}`,
        recipientId: candidate.recipient_id,
        type: AUTOMATION_TRIGGERS.certificationExpiring,
        title: "Certification expiring",
        message: `${candidate.source_title ?? "Your certification"} expires on ${candidate.expires_at?.slice(0, 10) ?? "soon"}.`,
        actionUrl: "/student/profile",
        sourceId: candidate.source_id,
      });
    },
  );
}

async function runSubmitted(context: RuleContext) {
  const workTypes = context.rule.conditions.workTypes as string[];
  const needsReview = context.rule.conditions.needsReview === true;
  const placeholders = workTypes.map(() => "?").join(", ");
  await pageCandidates<RuleCandidate>(
    context,
    `SELECT a.id AS cursor, wi.teacher_id AS recipient_id, a.id AS source_id, wi.title AS source_title
       FROM learning_submission_attempts a
       JOIN learning_submissions ls ON ls.id = a.submission_id AND ls.student_id = a.student_id
       JOIN learning_work_items wi ON wi.id = a.work_item_id AND wi.id = ls.work_item_id
       JOIN tenant_object_links work_link
         ON work_link.object_table = 'learning_work_items' AND work_link.object_id = wi.id AND work_link.tenant_id = ?
       JOIN tenant_memberships learner
         ON learner.tenant_id = work_link.tenant_id AND learner.user_id = a.student_id AND learner.status = 'active'
       JOIN tenant_memberships teacher
         ON teacher.tenant_id = work_link.tenant_id AND teacher.user_id = wi.teacher_id AND teacher.status = 'active'
       LEFT JOIN tenant_object_links class_link
         ON class_link.object_table = 'classes' AND class_link.object_id = wi.class_id
       LEFT JOIN class_enrollments ce
         ON ce.class_id = wi.class_id AND ce.student_id = a.student_id AND ce.is_active = 1
      WHERE wi.status = 'published' AND wi.work_type IN (${placeholders})
        AND (wi.class_id IS NULL OR (class_link.tenant_id = work_link.tenant_id AND ce.id IS NOT NULL))
        AND ls.status IN (${needsReview ? "'submitted'" : "'submitted', 'returned', 'graded'"})
        ${needsReview ? "AND a.attempt_number = (SELECT MAX(latest.attempt_number) FROM learning_submission_attempts latest WHERE latest.submission_id = ls.id)" : ""}
        AND NOT EXISTS (SELECT 1 FROM notifications n
                         WHERE n.id = 'automation:' || ? || ':submission:' || a.id)
        AND a.id > ?
      ORDER BY a.id LIMIT ?`,
    [context.stored.tenant_id, ...workTypes, context.stored.id],
    async (candidate) => {
      await insertNotice(context, {
        id: `automation:${context.stored.id}:submission:${candidate.source_id}`,
        recipientId: candidate.recipient_id,
        type: AUTOMATION_TRIGGERS.workSubmitted,
        title: "Submission ready to review",
        message: `${candidate.source_title ?? "Work"} has a new submission.`,
        actionUrl: "/teacher/work",
        sourceId: candidate.source_id,
      });
    },
  );
}

async function executeRule(context: RuleContext) {
  switch (context.rule.triggerKey) {
    case AUTOMATION_TRIGGERS.learnerInactive:
      return runInactive(context);
    case AUTOMATION_TRIGGERS.scoreMastery:
      return runMastery(context);
    case AUTOMATION_TRIGGERS.deadlineUpcoming:
      return runDeadline(context);
    case AUTOMATION_TRIGGERS.certificationExpiring:
      return runCertification(context);
    case AUTOMATION_TRIGGERS.workSubmitted:
      return runSubmitted(context);
  }
}

export async function runEnabledAutomationRules(env: AutomationEnv): Promise<SweepResult> {
  const result: SweepResult = {
    rulesProcessed: 0,
    rulesSkipped: 0,
    candidatesExamined: 0,
    notificationsCreated: 0,
    badgesAwarded: 0,
    capacityReached: false,
  };
  const budget = { used: 0, insufficient: false };
  const state = await env.EDSYNC_DB.prepare(
    "SELECT result FROM automation_jobs WHERE id = ? AND job_type = 'automation_rule.sweep_state' LIMIT 1",
  ).bind(SWEEP_STATE_ID).first<{ result: string | null }>();
  budget.used += 1;
  let cursor = "";
  try {
    const parsed: unknown = JSON.parse(state?.result ?? "{}");
    if (parsed && typeof parsed === "object" && "cursor" in parsed && typeof parsed.cursor === "string") {
      cursor = parsed.cursor;
    }
  } catch {
    cursor = "";
  }
  const readRules = async (operator: ">" | "<=", lastId: string, limit: number) => {
    const query = await env.EDSYNC_DB.prepare(
      `SELECT ar.id, ar.tenant_id, ar.title, ar.trigger_key, ar.conditions, ar.actions, ar.enabled
         FROM automation_rules ar
         JOIN tenants t ON t.id = ar.tenant_id AND t.status = 'active'
        WHERE ar.enabled = 1 AND ar.id ${operator} ?
        ORDER BY ar.id LIMIT ?`,
    ).bind(lastId, limit).all<StoredRule>();
    budget.used += 1;
    return query.results ?? [];
  };
  const after = await readRules(">", cursor, MAX_RULES_PER_SWEEP + 1);
  const before = cursor && after.length < MAX_RULES_PER_SWEEP + 1
    ? await readRules("<=", cursor, MAX_RULES_PER_SWEEP + 1 - after.length)
    : [];
  const ordered = [...after, ...before];
  if (ordered.length > MAX_RULES_PER_SWEEP) result.capacityReached = true;
  let lastVisitedId = cursor;
  for (const stored of ordered.slice(0, MAX_RULES_PER_SWEEP)) {
    const rule = readRule(stored);
    if (!rule) {
      result.rulesSkipped += 1;
      lastVisitedId = stored.id;
      continue;
    }
    const badgeIds = [...new Set(rule.actions
      .filter((action) => action.type === "award_badge")
      .map((action) => badgeCatalogId(stored.tenant_id, stored.id, String(action.badge))))];
    const context: RuleContext = {
      env,
      stored,
      rule,
      result,
      budget,
      badgeIds,
      notify: rule.actions.some((action) => action.type === "notify"),
    };
    await executeRule(context);
    if (budget.insufficient) break;
    result.rulesProcessed += 1;
    lastVisitedId = stored.id;
  }
  if (ordered.length > 0 && lastVisitedId !== cursor) {
    await env.EDSYNC_DB.prepare(
      `INSERT INTO automation_jobs
         (id, job_type, status, payload, result, attempts, created_at, updated_at)
       VALUES (?, 'automation_rule.sweep_state', 'completed', '{}', ?, 0, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET result = excluded.result, updated_at = datetime('now')
       WHERE automation_jobs.job_type = 'automation_rule.sweep_state'`,
    ).bind(SWEEP_STATE_ID, JSON.stringify({ cursor: lastVisitedId })).run();
    budget.used += 1;
  }
  return result;
}
