// apps/api/src/lib/auth.ts
//
// Password hashing + session tokens. Deliberately built on Node's own
// `crypto` (scrypt + timingSafeEqual + randomBytes) instead of an npm
// package like argon2/bcrypt — those ship native bindings that need to
// compile on install, which is one more way `pnpm install` can fail on a
// contributor's machine. scrypt is a Node-documented, OWASP-endorsed KDF
// with no native dependency at all.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const KEY_LEN = 64;
const SALT_LEN = 16;

/** "salt:hash", both hex — self-contained, no separate salt column needed. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN).toString('hex');
  const derived = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

/** Constant-time compare — never short-circuits on the first mismatched
 * byte, so response timing can't leak how much of the password was right. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false; // malformed row, never a match
  const derived = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/** Random 256-bit token for the cookie, plus the SHA-256 hash of it that's
 * safe to store in the DB. Only the hash ever touches disk — a leaked DB
 * dump doesn't hand out working session cookies. */
export function createSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}