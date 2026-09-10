// apps/api/src/routes/auth.ts
import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { signupSchema, loginSchema } from '@music/validation';
import type { ApiResult } from '@music/types';
import { db } from '../db/client.js';
import { users, refreshTokens } from '../db/schema.js';
import {
  hashPassword,
  verifyPassword,
  createRefreshToken,
  createAccessToken,
  hashToken,
  toPublicUser,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from '../lib/auth.js';
import { withinRateLimit } from '../lib/rate-limit.js';
import { getSessionUserId } from '../lib/session.js';
import { env } from '../lib/env.js';

export const auth = new Hono();

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}
function err(error: string): ApiResult<never> {
  return { ok: false, error };
}

async function startSession(c: Context, userId: string) {
  const { token, tokenHash } = createRefreshToken();
  const accessToken = await createAccessToken(userId);
  
  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  
  const isProd = env.nodeEnv === 'production';
  const sameSite = isProd ? 'None' as const : 'Lax' as const;
  
  setCookie(c, REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite,
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_MS / 1000,
  });
  
  setCookie(c, ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite,
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_MS / 1000,
  });
}

// POST /auth/signup
auth.post('/signup', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0]?.message ?? 'invalid input'), 400);
  }
  const { email, password, displayName } = parsed.data;

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    // Same message a wrong-password login gets below — don't let this
    // endpoint be used to enumerate which emails already have accounts.
    return c.json(err('could not create account'), 409);
  }

  const passwordHash = await hashPassword(password);
  const [created] = await db.insert(users).values({ email, passwordHash, displayName }).returning();
  if (!created) return c.json(err('could not create account'), 500);

  await startSession(c, created.id);
  return c.json(ok(toPublicUser(created)), 201);
});

// POST /auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0]?.message ?? 'invalid input'), 400);
  }
  const { email, password } = parsed.data;

  if (!withinRateLimit(`login:${email}`, 8, 15 * 60 * 1000)) {
    return c.json(err('too many attempts, try again later'), 429);
  }

  const row = await db.query.users.findFirst({ where: eq(users.email, email) });
  // Same generic message whether the email doesn't exist or the password
  // is wrong, and verifyPassword still runs a dummy hash either way (see
  // below) so this branch and the real one take about the same time.
  if (!row) {
    await hashPassword(password); // burn equivalent time to a real check
    return c.json(err('invalid email or password'), 401);
  }

  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) {
    return c.json(err('invalid email or password'), 401);
  }

  await startSession(c, row.id);
  return c.json(ok(toPublicUser(row)));
});

// POST /auth/logout
auth.post('/logout', async (c) => {
  const token = getCookie(c, REFRESH_TOKEN_COOKIE);
  if (token) {
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, hashToken(token)));
  }
  deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: '/' });
  deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: '/' });
  return c.json(ok(null));
});

// POST /auth/refresh
auth.post('/refresh', async (c) => {
  const token = getCookie(c, REFRESH_TOKEN_COOKIE);
  if (!token) return c.json(err('not signed in'), 401);

  const rt = await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.tokenHash, hashToken(token)) });
  if (!rt || rt.expiresAt.getTime() < Date.now()) {
    deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: '/' });
    deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: '/' });
    return c.json(err('session expired'), 401);
  }

  const accessToken = await createAccessToken(rt.userId);
  const isProd = env.nodeEnv === 'production';
  
  setCookie(c, ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : ('Lax' as const),
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_MS / 1000,
  });

  return c.json(ok(null));
});

// GET /auth/me
auth.get('/me', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row) return c.json(err('not signed in'), 401);

  return c.json(ok(toPublicUser(row)));
});