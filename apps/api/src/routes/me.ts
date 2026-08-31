// apps/api/src/routes/me.ts
import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { recordListenSchema, updateAccountSchema } from '@music/validation';
import type { ApiResult, ListeningEvent } from '@music/types';
import { db } from '../db/client.js';
import { listeningEvents, users } from '../db/schema.js';
import { getSessionUserId } from '../lib/session.js';
import { hashPassword, verifyPassword, toPublicUser } from '../lib/auth.js';

export const me = new Hono();

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}
function err(error: string): ApiResult<never> {
  return { ok: false, error };
}

// PATCH /me — update displayName and/or password. See updateAccountSchema
// for why a password change also requires currentPassword.
me.patch('/', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const body = await c.req.json().catch(() => null);
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0]?.message ?? 'invalid input'), 400);
  }

  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row) return c.json(err('not signed in'), 401);

  const updates: Partial<typeof users.$inferInsert> = {};

  if (parsed.data.newPassword) {
    // Schema's refine() already guarantees currentPassword is present
    // whenever newPassword is.
    const currentValid = await verifyPassword(parsed.data.currentPassword as string, row.passwordHash);
    if (!currentValid) return c.json(err('current password is incorrect'), 401);
    updates.passwordHash = await hashPassword(parsed.data.newPassword);
  }
  if (parsed.data.displayName !== undefined) {
    updates.displayName = parsed.data.displayName;
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
  if (!updated) return c.json(err('could not update account'), 500);

  return c.json(ok(toPublicUser(updated)));
});

// POST /me/listening-events — the player fires this (fire-and-forget) the
// moment a track actually starts playing. Requires auth; logged-out plays
// simply aren't recorded — @music/api-client's recordListen() swallows the
// resulting 401 rather than surfacing it as a playback error.
me.post('/listening-events', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const body = await c.req.json().catch(() => null);
  const parsed = recordListenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0]?.message ?? 'invalid input'), 400);
  }

  await db.insert(listeningEvents).values({
    userId,
    artistId: parsed.data.artistId,
    genre: parsed.data.genre,
  });
  return c.json(ok(null), 201);
});

// GET /me/listening-events?limit=50 — most-recent-first history, exactly
// the shape packages/domain's pickRecommendationSeed/rankGenrePreference
// expect. apps/web's index.astro is the only current caller.
me.get('/listening-events', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const requested = Number(c.req.query('limit') ?? 50);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 200) : 50;

  const rows = await db.query.listeningEvents.findMany({
    where: eq(listeningEvents.userId, userId),
    orderBy: [desc(listeningEvents.playedAt)],
    limit,
  });

  const events: ListeningEvent[] = rows.map((row) => ({
    artistId: row.artistId,
    genre: row.genre ?? undefined,
    playedAt: row.playedAt.toISOString(),
  }));
  return c.json(ok(events));
});
