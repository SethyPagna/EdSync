const ITERATIONS = 60_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function randomSalt() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return base64Url(salt);
}

function safeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

async function derivePassword(password: string, salt: string, iterations: number, length: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: DIGEST.toUpperCase().replace("SHA", "SHA-"),
      salt: new TextEncoder().encode(salt),
      iterations,
    },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = randomSalt();
  const derived = await derivePassword(password, salt, ITERATIONS, KEY_LENGTH);
  return `pbkdf2:${ITERATIONS}:${salt}:${base64Url(derived)}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [scheme, iterationsText, salt, hash] = storedHash.split(":");
  if (scheme !== "pbkdf2" || !iterationsText || !salt || !hash) return false;

  const iterations = Number(iterationsText);
  const expected = fromBase64Url(hash);
  const actual = await derivePassword(password, salt, iterations, expected.length);

  return safeEqual(expected, actual);
}
