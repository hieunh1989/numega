import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(derived as ArrayBuffer).toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  const [algorithm, salt, encoded] = String(stored || "").split(":");
  if (algorithm !== "scrypt" || !salt || !encoded) return false;

  const expected = Buffer.from(encoded, "hex");
  const actual = Buffer.from(await scrypt(password, salt, expected.length) as ArrayBuffer);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
