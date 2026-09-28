import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { D1Database } from "@cloudflare/workers-types";

export const WRANGLER_APP_CONFIG = "infra/cloudflare/wrangler.app.jsonc";
export const LOCAL_STATE_DIR = ".wrangler/state";
export const MIGRATIONS_DIR = "infra/database/migrations";
const MIGRATIONS_TABLE = "d1_migrations";

type LocalBindings = { EDSYNC_DB: D1Database };

export type LocalD1 = {
  db: D1Database;
  dispose: () => Promise<void>;
};

// Same config, database id and persistence root as `next dev` (next.config.mjs), so scripts and the
// dev server share one hermetic database. Remote bindings are disabled: nothing here reaches Cloudflare.
export async function openLocalD1(): Promise<LocalD1> {
  process.env.WRANGLER_LOG ??= "error";
  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy<LocalBindings>({
    configPath: WRANGLER_APP_CONFIG,
    persist: { path: resolve(LOCAL_STATE_DIR, "v3") },
    remoteBindings: false,
    envFiles: [],
  });
  return { db: proxy.env.EDSYNC_DB, dispose: () => proxy.dispose() };
}

export function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export async function readAppliedMigrations(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT UNIQUE,
         applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
       )`,
    )
    .run();
  const { results } = await db.prepare(`SELECT name FROM ${MIGRATIONS_TABLE}`).all<{ name: string }>();
  return new Set(results.map((row) => row.name));
}

export async function applyMigration(db: D1Database, file: string) {
  const { unstable_splitSqlQuery } = await import("wrangler");
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  const statements = unstable_splitSqlQuery(sql).map((query) => db.prepare(query));
  statements.push(db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`).bind(file));
  await db.batch(statements);
}
