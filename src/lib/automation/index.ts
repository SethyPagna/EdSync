import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Queue } from "@cloudflare/workers-types";
import { d1Query } from "@/lib/db/d1";

export type AutomationQueueMessage = {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
};

function queueBinding(): Queue<AutomationQueueMessage> | null {
  try {
    return (getCloudflareContext().env as CloudflareEnv & { EDSYNC_QUEUE?: Queue<AutomationQueueMessage> }).EDSYNC_QUEUE ?? null;
  } catch {
    return null;
  }
}

export async function enqueueAutomationJob(input: {
  tenantId: string;
  jobType: string;
  payload: Record<string, unknown>;
}) {
  const id = crypto.randomUUID();
  const payload = { ...input.payload, tenantId: input.tenantId };
  await d1Query(
    `INSERT INTO automation_jobs (id, job_type, payload, status, attempts, created_at, updated_at)
     VALUES (?, ?, ?, 'queued', 0, datetime('now'), datetime('now'))`,
    [id, input.jobType, JSON.stringify(payload)],
  );
  const queue = queueBinding();
  if (queue) {
    try {
      await queue.send({ id, job_type: input.jobType, payload });
    } catch (error) {
      await d1Query(
        "UPDATE automation_jobs SET last_error = ?, updated_at = datetime('now') WHERE id = ?",
        [error instanceof Error ? error.message : "Queue send failed", id],
      );
    }
  }
  return id;
}
