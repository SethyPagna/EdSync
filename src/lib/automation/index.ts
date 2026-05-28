import { d1Query } from "@/lib/db/d1";

export async function enqueueAutomationJob(input: {
  tenantId: string;
  jobType: string;
  payload: Record<string, unknown>;
}) {
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO automation_jobs (id, job_type, payload, status, attempts, created_at, updated_at)
     VALUES (?, ?, ?, 'queued', 0, datetime('now'), datetime('now'))`,
    [id, input.jobType, JSON.stringify({ tenantId: input.tenantId, ...input.payload })],
  );
  return id;
}
