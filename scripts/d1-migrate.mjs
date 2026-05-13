import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const databaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME || "edsync-dev-d1";
const migrationsDir = "database/migrations";
const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();

for (const file of files) {
  const sqlPath = join(migrationsDir, file);
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", databaseName, "--remote", "--file", sqlPath],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.argv.includes("--seed")) {
  const seedSql = readFileSync("database/seed.sql", "utf8").trim();
  if (seedSql) {
    const result = spawnSync(
      "npx",
      ["wrangler", "d1", "execute", databaseName, "--remote", "--file", "database/seed.sql"],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
