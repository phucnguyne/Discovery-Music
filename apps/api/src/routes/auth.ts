// apps/api/src/routes/auth.ts
import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { signupSchema, loginSchema } from '@music/validation';
import type { ApiResult } from '@music/types';
import { db } from '../db/client.js';
import { users, sessions } from '../db/schema.js';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  hashToken,
  toPublicUser,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from '../lib/auth.js';
import { withinRateLimit } from '../lib/rate-limit.js';
import { getSessionUserId } from '../lib/session.js';

export const auth = new Hono();

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}
function err(error: string): ApiResult<never> {
  return { ok: false, error };
}

async function startSession(c: Context, userId: string) {
  const { token, tokenHash } = createSessionToken();
  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  const isProd = process.env.NODE_ENV === 'production';
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    // In prod, apps/api and apps/web are on two different onrender.com
    // hostnames — different "sites" to a browser — so any request from
    // apps/web's pages to apps/api is cross-site. SameSite=Lax silently
    // drops the cookie on cross-site fetch(); it only ever worked in dev
    // because localhost:4321/4322 share a cookie jar (cookies aren't
    // port-scoped). SameSite=None requires Secure, which requires HTTPS —
    // fine in prod (Render is HTTPS-only), but breaks local http dev, so
    // this only flips to None when NODE_ENV=production.
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
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
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
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