import { randomUUID, scryptSync, timingSafeEqual } from "crypto";

export function createId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export function hashPassword(password: string) {
  const salt = randomUUID();
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hashed] = storedHash.split(":");
  if (!salt || !hashed) {
    return false;
  }

  const passwordHash = scryptSync(password, salt, 64);
  const stored = Buffer.from(hashed, "hex");
  if (stored.length !== passwordHash.length) {
    return false;
  }

  return timingSafeEqual(stored, passwordHash);
}
