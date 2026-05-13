import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1";
const LEGACY_PREFIX = "v1";

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

  const key = normalizeEncryptionKey();
  if (!key) return "";

  const parts = text.split(":");
  const usesCurrentFormat = text.startsWith(`${PREFIX}:`) && parts.length === 5;
  const usesLegacyFormat = parts[0] === LEGACY_PREFIX && parts.length === 4;
  if (!usesCurrentFormat && !usesLegacyFormat) return "";

  try {
    const offset = usesCurrentFormat ? 1 : 0;
    const encoding = usesCurrentFormat ? "base64url" : "base64";
    const iv = Buffer.from(parts[1 + offset], encoding);
    const tag = Buffer.from(parts[2 + offset], encoding);
    const encrypted = Buffer.from(parts[3 + offset], encoding);
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
