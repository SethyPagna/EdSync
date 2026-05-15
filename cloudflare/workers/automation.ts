/// <reference types="@cloudflare/workers-types" />

export type Env = {
  EDSYNC_DB: D1Database;
  EDSYNC_ASSETS: R2Bucket;
  EDSYNC_QUEUE: Queue;
};

type AutomationJob = {
  id: string;
  job_type: string;
  payload?: Record<string, unknown>;
};

async function runAutomation(job: AutomationJob, env: Env) {
  if (job.job_type === "automation_rule.created") {
    return { handledBy: "cloudflare-worker", message: "Automation rule queued for future trigger evaluation." };
  }

  if (job.job_type.startsWith("ai_provider.")) {
    return {
      handledBy: "cloudflare-worker",
      providerJob: job.job_type,
      message: "AI provider control-plane change recorded for audit and health automation.",
    };
  }

  if (job.job_type === "certification.expiry_check") {
    const tenantId = String(job.payload?.tenantId || "");
    if (!tenantId) return { handledBy: "cloudflare-worker", skipped: "missing tenant" };
    const expiring = await env.EDSYNC_DB.prepare(
      `SELECT lc.user_id, cr.title, lc.expires_at
         FROM learner_certifications lc
         JOIN certification_rules cr ON cr.id = lc.rule_id
        WHERE lc.tenant_id = ?
          AND lc.status = 'active'
          AND lc.expires_at IS NOT NULL
          AND lc.expires_at <= datetime('now', '+' || cr.notify_before_days || ' days')
        LIMIT 100`,
    )
      .bind(tenantId)
      .all();
    return { handledBy: "cloudflare-worker", expiring: expiring.results?.length ?? 0 };
  }

  return { handledBy: "cloudflare-worker", message: "No processor registered for this job type." };
}

export default {
  async fetch() {
    return Response.json({
      ok: true,
      service: "edsync-automation",
      queue: "ready",
      checked_at: new Date().toISOString(),
    });
  },

  async queue(batch: MessageBatch<AutomationJob>, env: Env) {
    for (const message of batch.messages) {
      const job = message.body;
      await env.EDSYNC_DB.prepare(
        "UPDATE automation_jobs SET status = ?, attempts = attempts + 1, updated_at = datetime('now') WHERE id = ?",
      )
        .bind("running", job.id)
        .run();

      const result = await runAutomation(job, env);

      await env.EDSYNC_DB.prepare(
        "UPDATE automation_jobs SET status = ?, result = ?, updated_at = datetime('now') WHERE id = ?",
      )
        .bind("completed", JSON.stringify(result), job.id)
        .run();

      message.ack();
    }
  },
};
