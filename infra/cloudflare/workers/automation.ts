import type { MessageBatch, ScheduledEvent } from "@cloudflare/workers-types";

type Env = AutomationEnv;

type StoredJob = {
  id: string;
  job_type: string;
  payload: string;
  attempts: number;
};

type QueueBody = { id?: unknown };

type ExpiringCertification = {
  id: string;
  user_id: string;
  title: string;
  expires_at: string;
};

function payloadOf(job: StoredJob): Record<string, unknown> {
  const value: unknown = JSON.parse(job.payload);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid job payload");
  return value as Record<string, unknown>;
}

function stringField(payload: Record<string, unknown>, key: string) {
  return typeof payload[key] === "string" ? payload[key] : "";
}

async function notifyExpiringCertifications(env: Env, tenantId?: string) {
  const rows = await env.EDSYNC_DB.prepare(
    `SELECT lc.id, lc.user_id, cr.title, lc.expires_at
       FROM learner_certifications lc
       JOIN certification_rules cr ON cr.id = lc.rule_id AND cr.tenant_id = lc.tenant_id
      WHERE lc.status = 'active'
        AND lc.expires_at IS NOT NULL
        AND lc.expires_at > datetime('now')
        AND lc.expires_at <= datetime('now', '+' || MAX(0, MIN(365, COALESCE(cr.notify_before_days, 30))) || ' days')
        AND (? IS NULL OR lc.tenant_id = ?)
      ORDER BY lc.expires_at ASC
      LIMIT 100`,
  )
    .bind(tenantId ?? null, tenantId ?? null)
    .all<ExpiringCertification>();

  let created = 0;
  for (const row of rows.results ?? []) {
    const result = await env.EDSYNC_DB.prepare(
      `INSERT OR IGNORE INTO notifications
         (id, user_id, type, title, message, action_url, priority, channels, metadata, created_at)
       VALUES (?, ?, 'certification.expiring', 'Certification expiring', ?, '/student/profile', 'normal', '["in_app"]', ?, datetime('now'))`,
    )
      .bind(
        `certification-expiry:${row.id}:${row.expires_at}`,
        row.user_id,
        `${row.title} expires on ${row.expires_at.slice(0, 10)}.`,
        JSON.stringify({ certificationId: row.id, expiresAt: row.expires_at }),
      )
      .run();
    created += result.meta.changes ?? 0;
  }
  return created;
}

async function runJob(job: StoredJob, env: Env) {
  const payload = payloadOf(job);
  const tenantId = stringField(payload, "tenantId");
  if (!tenantId) throw new Error("Missing tenant ID");

  if (job.job_type === "certification.expiry_check") {
    return { notificationsCreated: await notifyExpiringCertifications(env, tenantId) };
  }

  if (job.job_type.startsWith("automation_rule.")) {
    const ruleId = stringField(payload, "ruleId");
    if (!ruleId) throw new Error("Missing automation rule ID");
    const rule = await env.EDSYNC_DB.prepare(
      "SELECT id, enabled, trigger_key FROM automation_rules WHERE id = ? AND tenant_id = ? LIMIT 1",
    )
      .bind(ruleId, tenantId)
      .first<{ id: string; enabled: number; trigger_key: string }>();
    return rule
      ? { ruleId: rule.id, enabled: Boolean(rule.enabled), triggerKey: rule.trigger_key }
      : { ruleId, removed: true };
  }

  if (job.job_type.startsWith("ai_provider.")) {
    return { providerId: stringField(payload, "providerId"), event: job.job_type };
  }

  throw new Error(`No processor registered for ${job.job_type}`);
}

async function processJob(env: Env, id: string) {
  const job = await env.EDSYNC_DB.prepare(
    `UPDATE automation_jobs
        SET status = 'running', attempts = attempts + 1, updated_at = datetime('now')
      WHERE id = ? AND (status = 'queued' OR (status = 'running' AND updated_at < datetime('now', '-10 minutes')))
      RETURNING id, job_type, payload, attempts`,
  )
    .bind(id)
    .first<StoredJob>();
  if (!job) return;

  try {
    const result = await runJob(job, env);
    await env.EDSYNC_DB.prepare(
      "UPDATE automation_jobs SET status = 'completed', result = ?, last_error = NULL, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(JSON.stringify(result), id)
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation job failed";
    await env.EDSYNC_DB.prepare(
      "UPDATE automation_jobs SET status = ?, last_error = ?, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(job.attempts >= 3 ? "failed" : "queued", message.slice(0, 1000), id)
      .run();
    throw error;
  }
}

export default {
  async fetch(request: Request) {
    if (new URL(request.url).pathname !== "/health") return new Response(null, { status: 404 });
    return Response.json({ ok: true, service: "edsync-automation" });
  },

  async queue(batch: MessageBatch<QueueBody>, env: Env) {
    for (const message of batch.messages) {
      const id = message.body?.id;
      if (typeof id !== "string" || !id) {
        message.ack();
        continue;
      }
      try {
        await processJob(env, id);
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({ event: "automation_job_failed", jobId: id, attempt: message.attempts, error: error instanceof Error ? error.message : "Unknown error" }));
        if (message.attempts >= 3) message.ack();
        else message.retry({ delaySeconds: 60 });
      }
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env) {
    const pending = await env.EDSYNC_DB.prepare(
      `SELECT id FROM automation_jobs
        WHERE status = 'queued' OR (status = 'running' AND updated_at < datetime('now', '-10 minutes'))
        ORDER BY created_at ASC LIMIT 100`,
    ).all<{ id: string }>();
    for (const job of pending.results ?? []) {
      try {
        await processJob(env, job.id);
      } catch (error) {
        console.error(JSON.stringify({ event: "automation_recovery_failed", jobId: job.id, error: error instanceof Error ? error.message : "Unknown error" }));
      }
    }
    await notifyExpiringCertifications(env);
  },
};
