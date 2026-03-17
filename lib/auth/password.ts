import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

import { SAMPLE_LOGIN_PASSWORD } from "@/lib/auth/password-constants";

const HASH_PREFIX = "scrypt";

export function createPasswordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${HASH_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) {
    return false;
  }

  if (storedHash === "dummy-hash") {
    return password === SAMPLE_LOGIN_PASSWORD;
  }

  const [prefix, salt, hash] = storedHash.split("$");
  if (prefix !== HASH_PREFIX || !salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

export { SAMPLE_LOGIN_PASSWORD };
