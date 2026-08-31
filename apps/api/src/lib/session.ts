// apps/api/src/lib/session.ts
import type { Context } from 'hono';
import { getCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sessions } from '../db/schema.js';
import { SESSION_COOKIE, hashToken } from './auth.js';

/** Resolves the signed-in user's id from the request's session cookie, or
 * null if there isn't one / it's expired. Shared by /auth/me and every
 * /me/* route so "what does a valid session look like" lives in one place. */
export async function getSessionUserId(c: Context): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;

  const session = await db.query.sessions.findFirst({ where: eq(sessions.tokenHash, hashToken(token)) });
  if (!session || session.expiresAt.getTime() < Date.now()) {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return null;
  }
  return session.userId;
}
