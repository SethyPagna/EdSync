import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `pbkdf2:${ITERATIONS}:${salt}:${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [scheme, iterationsText, salt, hash] = storedHash.split(":");
  if (scheme !== "pbkdf2" || !iterationsText || !salt || !hash) return false;

  const iterations = Number(iterationsText);
  const expected = Buffer.from(hash, "base64url");
  const actual = await pbkdf2Async(password, salt, iterations, expected.length, DIGEST);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
