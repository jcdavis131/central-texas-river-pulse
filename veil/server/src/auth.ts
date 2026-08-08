import { randomBytes, scrypt, timingSafeEqual, type BinaryLike, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// promisify resolves to scrypt's no-options overload; re-type to include options.
const scryptAsync = promisify(scrypt) as (
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Server-side auth password (distinct from the vault master password). This
 * gates the sync API; the vault itself stays end-to-end encrypted under the
 * separate master password the server never sees.
 */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)) as Buffer;
  return { hash: derived.toString("hex"), salt: salt.toString("hex") };
}

export async function verifyPassword(
  password: string,
  hashHex: string,
  saltHex: string,
): Promise<boolean> {
  const salt = Buffer.from(saltHex, "hex");
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiry(now = Date.now()): string {
  return new Date(now + SESSION_TTL_MS).toISOString();
}

export function isExpired(expiresAtIso: string, now = Date.now()): boolean {
  return new Date(expiresAtIso).getTime() < now;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
