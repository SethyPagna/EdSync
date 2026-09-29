import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import worker from "../../../infra/cloudflare/workers/automation";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE tenants (id TEXT PRIMARY KEY, status TEXT);
    CREATE TABLE tenant_memberships (tenant_id TEXT, user_id TEXT, status TEXT);
    CREATE TABLE automation_jobs (id TEXT PRIMARY KEY, job_type TEXT, status TEXT, payload TEXT, result TEXT, attempts INTEGER DEFAULT 0, last_error TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE automation_rules (id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT, enabled INTEGER, trigger_key TEXT, conditions TEXT, actions TEXT);
    CREATE TABLE certification_rules (id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT, notify_before_days INTEGER);
    CREATE TABLE learner_certifications (id TEXT PRIMARY KEY, tenant_id TEXT, rule_id TEXT, user_id TEXT, status TEXT, expires_at TEXT);
    CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, title TEXT, message TEXT, action_url TEXT, priority TEXT, channels TEXT, metadata TEXT, created_at TEXT);
  `);
  const env = {
    EDSYNC_DB: {
      prepare(sql: string) {
        return {
          bind(...values: SQLInputValue[]) {
            const statement = db.prepare(sql);
            return {
              async first() { return statement.get(...values) ?? null; },
              async all() { return { results: statement.all(...values) }; },
              async run() { return { meta: { changes: statement.run(...values).changes } }; },
            };
          },
          async all() { return { results: db.prepare(sql).all() }; },
        };
      },
    },
  } as unknown as Parameters<typeof worker.queue>[1];
  return { db, env };
}

function message(id: string, attempts = 1) {
  const ack = vi.fn();
  const retry = vi.fn();
  return { body: { id }, attempts, ack, retry };
}

async function deliver(env: Parameters<typeof worker.queue>[1], item: ReturnType<typeof message>) {
  await worker.queue({ messages: [item] } as unknown as Parameters<typeof worker.queue>[0], env);
}

describe("EdSync automation consumer", () => {
  it("claims a persisted job once and acknowledges a duplicate delivery", async () => {
    const { db, env } = fixture();
    try {
      db.prepare("INSERT INTO automation_rules (id, tenant_id, enabled, trigger_key) VALUES ('rule-1', 'tenant-a', 1, 'deadline.upcoming')").run();
      db.prepare("INSERT INTO automation_jobs (id, job_type, status, payload) VALUES (?, ?, 'queued', ?)").run("job-1", "automation_rule.updated", JSON.stringify({ tenantId: "tenant-a", ruleId: "rule-1" }));
      const first = message("job-1");
      await deliver(env, first);
      await deliver(env, message("job-1", 2));

      const job = db.prepare("SELECT status, attempts, result FROM automation_jobs WHERE id = 'job-1'").get() as { status: string; attempts: number; result: string };
      expect(job.status).toBe("completed");
      expect(job.attempts).toBe(1);
      expect(JSON.parse(job.result)).toEqual({ ruleId: "rule-1", enabled: true, triggerKey: "deadline.upcoming" });
      expect(first.ack).toHaveBeenCalledOnce();
    } finally {
      db.close();
    }
  });

  it("retries failures and marks the job failed on the third attempt", async () => {
    const { db, env } = fixture();
    try {
      db.prepare("INSERT INTO automation_jobs (id, job_type, status, payload) VALUES (?, ?, 'queued', ?)").run("job-2", "unsupported", JSON.stringify({ tenantId: "tenant-a" }));
      for (const attempt of [1, 2, 3]) {
        const item = message("job-2", attempt);
        await deliver(env, item);
        if (attempt < 3) expect(item.retry).toHaveBeenCalledOnce();
        else expect(item.ack).toHaveBeenCalledOnce();
      }
      expect(db.prepare("SELECT status, attempts FROM automation_jobs WHERE id = 'job-2'").get()).toMatchObject({ status: "failed", attempts: 3 });
    } finally {
      db.close();
    }
  });

  it("sends one in-app expiry notice per certification across repeated sweeps", async () => {
    const { db, env } = fixture();
    try {
      db.prepare("INSERT INTO tenants (id, status) VALUES ('tenant-a', 'active')").run();
      db.prepare("INSERT INTO tenant_memberships (tenant_id, user_id, status) VALUES ('tenant-a', 'learner-1', 'active')").run();
      db.prepare("INSERT INTO certification_rules (id, tenant_id, title, notify_before_days) VALUES ('rule-1', 'tenant-a', 'Safety training', 30)").run();
      db.prepare("INSERT INTO learner_certifications (id, tenant_id, rule_id, user_id, status, expires_at) VALUES ('cert-1', 'tenant-a', 'rule-1', 'learner-1', 'active', datetime('now', '+2 days'))").run();
      await worker.scheduled({} as Parameters<typeof worker.scheduled>[0], env);
      await worker.scheduled({} as Parameters<typeof worker.scheduled>[0], env);

      expect(db.prepare("SELECT COUNT(*) AS count FROM notifications").get()).toMatchObject({ count: 1 });
      expect(db.prepare("SELECT user_id, type FROM notifications").get()).toMatchObject({ user_id: "learner-1", type: "certification.expiring" });
    } finally {
      db.close();
    }
  });

  it("advances past already notified certifications on the next sweep", async () => {
    const { db, env } = fixture();
    try {
      db.prepare("INSERT INTO tenants (id, status) VALUES ('tenant-a', 'active')").run();
      db.prepare("INSERT INTO tenant_memberships (tenant_id, user_id, status) VALUES ('tenant-a', 'learner-1', 'active')").run();
      db.prepare("INSERT INTO certification_rules (id, tenant_id, title, notify_before_days) VALUES ('rule-1', 'tenant-a', 'Safety training', 30)").run();
      const insert = db.prepare("INSERT INTO learner_certifications (id, tenant_id, rule_id, user_id, status, expires_at) VALUES (?, 'tenant-a', 'rule-1', 'learner-1', 'active', datetime('now', '+2 days'))");
      for (let index = 0; index < 105; index += 1) insert.run(`cert-${index}`);

      await worker.scheduled({} as Parameters<typeof worker.scheduled>[0], env);
      await worker.scheduled({} as Parameters<typeof worker.scheduled>[0], env);

      expect(db.prepare("SELECT COUNT(*) AS count FROM notifications").get()).toMatchObject({ count: 105 });
    } finally {
      db.close();
    }
  });

  it("respects a tenant's configured certification automation", async () => {
    const { db, env } = fixture();
    try {
      db.prepare("INSERT INTO tenants (id, status) VALUES ('tenant-a', 'active')").run();
      db.prepare("INSERT INTO tenant_memberships (tenant_id, user_id, status) VALUES ('tenant-a', 'learner-1', 'active')").run();
      db.prepare("INSERT INTO certification_rules (id, tenant_id, title, notify_before_days) VALUES ('rule-1', 'tenant-a', 'Safety training', 30)").run();
      db.prepare("INSERT INTO learner_certifications (id, tenant_id, rule_id, user_id, status, expires_at) VALUES ('cert-1', 'tenant-a', 'rule-1', 'learner-1', 'active', datetime('now', '+2 days'))").run();
      db.prepare("INSERT INTO automation_rules (id, tenant_id, enabled, trigger_key) VALUES ('custom-cert', 'tenant-a', 0, 'certification.expiring')").run();

      await worker.scheduled({} as Parameters<typeof worker.scheduled>[0], env);

      expect(db.prepare("SELECT COUNT(*) AS count FROM notifications").get()).toMatchObject({ count: 0 });
    } finally {
      db.close();
    }
  });
});
