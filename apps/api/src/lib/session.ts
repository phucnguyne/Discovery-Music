// apps/api/src/lib/session.ts
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { refreshTokens } from '../db/schema.js';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_MS,
  verifyAccessToken,
  createAccessToken,
  hashToken,
} from './auth.js';
import { env } from './env.js';

/** Resolves the signed-in user's id from the request's cookies. 
 * First checks the short-lived access token. If missing or expired, 
 * attempts to transparently refresh using the long-lived refresh token. */
export async function getSessionUserId(c: Context): Promise<string | null> {
  const accessToken = getCookie(c, ACCESS_TOKEN_COOKIE);
  if (accessToken) {
    const userId = await verifyAccessToken(accessToken);
    if (userId) return userId;
  }

  // Fallback: try refresh token
  const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE);
  if (!refreshToken) return null;

  const rt = await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.tokenHash, hashToken(refreshToken)) });
  if (!rt || rt.expiresAt.getTime() < Date.now()) {
    deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: '/' });
    deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: '/' });
    return null;
  }

  // Transparently refresh the access token
  const newAccessToken = await createAccessToken(rt.userId);
  const isProd = env.nodeEnv === 'production';
  setCookie(c, ACCESS_TOKEN_COOKIE, newAccessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : ('Lax' as const),
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_MS / 1000,
  });

  return rt.userId;
}
