import { pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { existsSync, readFileSync } from "node:fs";

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) {
      process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `pbkdf2:${ITERATIONS}:${salt}:${derived.toString("base64url")}`;
}

async function d1Query(sql, params = []) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !token) {
    throw new Error("Missing Cloudflare D1 env vars.");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.errors?.map((error) => error.message).join("; ") || response.statusText);
  }
  return payload.result?.[0]?.results ?? [];
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = String(process.env.ADMIN_INITIAL_PASSWORD || "");
const fullName = String(process.env.ADMIN_FULL_NAME || "EdSync Admin").trim();

if (!email || !password || password.length < 12) {
  throw new Error("ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD with at least 12 characters are required.");
}

const existing = await d1Query("SELECT id FROM auth_users WHERE lower(email) = lower(?) LIMIT 1", [email]);
const id = existing[0]?.id || crypto.randomUUID();

if (!existing[0]) {
  await d1Query(
    `INSERT INTO auth_users (id, email, password_hash, email_verified_at, created_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
    [id, email, await hashPassword(password)],
  );
  await d1Query(
    `INSERT INTO profiles (
       id, email, full_name, role, subjects, interests, preferences, achievements,
       total_xp, streak_days, last_active_at, created_at, updated_at
     ) VALUES (?, ?, ?, 'teacher', '[]', '[]', '{"theme":"light","text_size":"medium"}', '[]', 0, 0, datetime('now'), datetime('now'), datetime('now'))`,
    [id, email, fullName],
  );
} else {
  await d1Query("UPDATE profiles SET full_name = COALESCE(full_name, ?), updated_at = datetime('now') WHERE id = ?", [
    fullName,
    id,
  ]);
}

await d1Query("INSERT OR IGNORE INTO admin_users (user_id, created_at) VALUES (?, datetime('now'))", [id]);
await d1Query(
  `INSERT INTO admin_audit_logs (id, admin_id, action, entity_type, entity_id, metadata, created_at)
   VALUES (?, ?, 'bootstrap', 'admin_user', ?, '{}', datetime('now'))`,
  [crypto.randomUUID(), id, id],
);

console.log(`Admin ready for ${email}.`);
