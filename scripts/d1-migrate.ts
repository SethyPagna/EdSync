import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile, run } from "./lib/ops";

const DEFAULT_D1_DATABASE_NAME = "edsync-dev-d1";
const DATABASE_ROOT = "infra/database";
const MIGRATIONS_DIR = join(DATABASE_ROOT, "migrations");
const SEED_SQL_PATH = join(DATABASE_ROOT, "seed.sql");
const SQL_FILE_EXTENSION = ".sql";
const SEED_FLAG = "--seed";

loadEnvFile(".env.local");
loadEnvFile(".env");

const databaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME || DEFAULT_D1_DATABASE_NAME;
const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(SQL_FILE_EXTENSION))
  .sort();

for (const file of migrationFiles) {
  const sqlPath = join(MIGRATIONS_DIR, file);
  run("npx", ["wrangler", "d1", "execute", databaseName, "--remote", "--file", sqlPath]);
}

if (process.argv.includes(SEED_FLAG)) {
  const seedSql = readFileSync(SEED_SQL_PATH, "utf8").trim();
  if (seedSql) {
    run("npx", ["wrangler", "d1", "execute", databaseName, "--remote", "--file", SEED_SQL_PATH]);
  }
}
