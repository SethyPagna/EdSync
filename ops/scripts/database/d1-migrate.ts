import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile, run } from "../shared/ops";
import { applyMigration, listMigrationFiles, MIGRATIONS_DIR, openLocalD1, readAppliedMigrations } from "./local-d1";

const DEFAULT_D1_DATABASE_NAME = "edsync-prod-d1";
const SEED_SQL_PATH = join("infra/database", "seed.sql");
const SEED_FLAG = "--seed";
const DRY_RUN_FLAG = "--dry-run";
const LOCAL_FLAG = "--local";

loadEnvFile(".env.local");
loadEnvFile(".env");

const shouldSeed = process.argv.includes(SEED_FLAG);
const dryRun = process.argv.includes(DRY_RUN_FLAG);
const local = process.argv.includes(LOCAL_FLAG);
const databaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME || DEFAULT_D1_DATABASE_NAME;
const migrationFiles = listMigrationFiles();

async function migrateLocal() {
  if (shouldSeed) {
    throw new Error("Seed the local database with db:seed:local instead of --seed.");
  }
  const { db, dispose } = await openLocalD1();
  try {
    const applied = await readAppliedMigrations(db);
    const pending = migrationFiles.filter((file) => !applied.has(file));
    if (pending.length === 0) {
      console.log(`Local D1 is up to date (${applied.size} migrations applied).`);
      return;
    }
    for (const file of pending) {
      if (dryRun) {
        console.log(`Would migrate local D1: ${join(MIGRATIONS_DIR, file)}`);
        continue;
      }
      await applyMigration(db, file);
      console.log(`Applied ${file} to local D1.`);
    }
  } finally {
    await dispose();
  }
}

function migrateRemote() {
  for (const file of migrationFiles) {
    const sqlPath = join(MIGRATIONS_DIR, file);
    if (dryRun) {
      console.log(`Would migrate ${databaseName}: ${sqlPath}`);
      continue;
    }
    run("npx", ["wrangler", "d1", "execute", databaseName, "--remote", "--file", sqlPath]);
  }

  if (!shouldSeed) return;
  const seedSql = readFileSync(SEED_SQL_PATH, "utf8").trim();
  if (!seedSql) return;
  if (dryRun) {
    console.log(`Would seed ${databaseName}: ${SEED_SQL_PATH}`);
    return;
  }
  run("npx", ["wrangler", "d1", "execute", databaseName, "--remote", "--file", SEED_SQL_PATH]);
}

if (local) {
  await migrateLocal().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
} else {
  migrateRemote();
}
