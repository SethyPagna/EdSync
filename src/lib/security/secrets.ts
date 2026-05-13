import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1";

function normalizeEncryptionKey(rawValue = process.env.APP_ENCRYPTION_KEY) {
  const value = String(rawValue || "").trim();
  if (!value) return null;

  if (/^[a-f0-9]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }

  try {
    const base64 = Buffer.from(value, "base64");
    if (base64.length === 32) return base64;
  } catch {
    // Fall through to utf8 handling.
  }

  const utf8 = Buffer.from(value, "utf8");
  return utf8.length === 32 ? utf8 : null;
}

export function isSecretEncryptionConfigured() {
  return Boolean(normalizeEncryptionKey());
}

export function encryptSecret(plainText: string) {
  const text = String(plainText || "");
  if (!text) return "";

  const key = normalizeEncryptionKey();
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY must be a 32-byte utf8 string, 32-byte base64 value, or 64-char hex value.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(cipherText: string) {
  const text = String(cipherText || "");
  if (!text) return "";
  if (!text.startsWith(`${PREFIX}:`)) return "";

  const key = normalizeEncryptionKey();
  if (!key) return "";

  const parts = text.split(":");
  if (parts.length !== 5) return "";

  try {
    const iv = Buffer.from(parts[2], "base64url");
    const tag = Buffer.from(parts[3], "base64url");
    const encrypted = Buffer.from(parts[4], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function maskSecret(value: string) {
  const key = String(value || "").trim();
  if (!key) return "";
  if (key.length <= 8) return `${key.slice(0, 2)}***${key.slice(-1)}`;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}
