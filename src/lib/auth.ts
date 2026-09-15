import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Password hashing using Node's built-in scrypt (no external dependency).
// Each password gets a unique random salt; verification is constant-time.

export function hashPassword(password: string): {
  hash: string;
  salt: string;
} {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): boolean {
  const candidate = scryptSync(password, salt, 64);
  const known = Buffer.from(hash, "hex");
  if (candidate.length !== known.length) return false;
  return timingSafeEqual(candidate, known);
}

export function newToken(): string {
  return randomBytes(24).toString("hex");
}
