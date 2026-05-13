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

export default {
  async queue(batch: MessageBatch<AutomationJob>, env: Env) {
    for (const message of batch.messages) {
      const job = message.body;
      await env.EDSYNC_DB.prepare(
        "UPDATE automation_jobs SET status = ?, attempts = attempts + 1, updated_at = datetime('now') WHERE id = ?",
      )
        .bind("running", job.id)
        .run();

      await env.EDSYNC_DB.prepare(
        "UPDATE automation_jobs SET status = ?, result = ?, updated_at = datetime('now') WHERE id = ?",
      )
        .bind("completed", JSON.stringify({ handledBy: "cloudflare-worker" }), job.id)
        .run();

      message.ack();
    }
  },
};
