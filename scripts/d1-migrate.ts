import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile, run } from "./lib/ops";

loadEnvFile(".env.local");
loadEnvFile(".env");

const databaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME || "edsync-dev-d1";
const migrationsDir = "database/migrations";
const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();

for (const file of files) {
  const sqlPath = join(migrationsDir, file);
  run("npx", ["wrangler", "d1", "execute", databaseName, "--remote", "--file", sqlPath]);
}

if (process.argv.includes("--seed")) {
  const seedSql = readFileSync("database/seed.sql", "utf8").trim();
  if (seedSql) {
    run("npx", ["wrangler", "d1", "execute", databaseName, "--remote", "--file", "database/seed.sql"]);
  }
}
