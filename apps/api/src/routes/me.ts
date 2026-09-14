// apps/api/src/routes/me.ts
import { Hono } from 'hono';
import { eq, desc, and, inArray } from 'drizzle-orm';
import {
  recordListenSchema,
  updateAccountSchema,
  trackSnapshotSchema,
  createPlaylistSchema,
} from '@music/validation';
import type {
  ApiResult,
  ListeningEvent,
  RecentlyPlayedTrack,
  FavoriteTrack,
  PlaylistSummary,
  PlaylistDetail,
} from '@music/types';
import { db } from '../db/client.js';
import { listeningEvents, favorites, playlists, playlistTracks, users } from '../db/schema.js';
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
    trackId: parsed.data.trackId,
    title: parsed.data.title,
    artistName: parsed.data.artistName,
    albumTitle: parsed.data.albumTitle,
    coverUrl: parsed.data.coverUrl,
    previewUrl: parsed.data.previewUrl,
    durationMs: parsed.data.durationMs,
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

// GET /me/recently-played?limit=30 — same table as listening-events above,
// filtered to rows that actually have a track snapshot (skips any legacy
// rows recorded before this feature existed, or a chart-sourced play that
// only had artistId/genre — see recordListenSchema's comment).
me.get('/recently-played', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const requested = Number(c.req.query('limit') ?? 30);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 100) : 30;

  const rows = await db.query.listeningEvents.findMany({
    where: eq(listeningEvents.userId, userId),
    orderBy: [desc(listeningEvents.playedAt)],
    limit: limit * 3, // over-fetch since some rows get filtered out below, then trim
  });

  const tracks: RecentlyPlayedTrack[] = rows
    .filter((row): row is typeof row & { trackId: string; title: string; artistName: string } =>
      Boolean(row.trackId && row.title && row.artistName),
    )
    .slice(0, limit)
    .map((row) => ({
      id: row.trackId,
      title: row.title,
      artistId: row.artistId,
      artistName: row.artistName,
      albumTitle: row.albumTitle ?? undefined,
      coverUrl: row.coverUrl ?? '',
      previewUrl: row.previewUrl ?? undefined,
      durationMs: row.durationMs ?? undefined,
      genre: row.genre ?? undefined,
      playedAt: row.playedAt.toISOString(),
    }));

  return c.json(ok(tracks));
});

// POST /me/favorites — idempotent: favoriting an already-favorited track
// is a harmless no-op (ON CONFLICT DO NOTHING via the table's unique
// constraint on (userId, trackId)), not an error.
me.post('/favorites', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const body = await c.req.json().catch(() => null);
  const parsed = trackSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0]?.message ?? 'invalid input'), 400);
  }

  await db
    .insert(favorites)
    .values({ userId, ...parsed.data })
    .onConflictDoNothing({ target: [favorites.userId, favorites.trackId] });

  return c.json(ok(null), 201);
});

// DELETE /me/favorites/:trackId
me.delete('/favorites/:trackId', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const trackId = c.req.param('trackId');
  await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.trackId, trackId)));
  return c.json(ok(null));
});

// POST /me/favorites/check — body { trackIds: string[] } -> which of them
// are already favorited. Lets a page with many tracks (search results, a
// whole album) find out real favorite-state for all of them in one round
// trip instead of one request per track.
me.post('/favorites/check', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(ok<string[]>([])); // logged out = nothing is favorited, not an error

  const body = await c.req.json().catch(() => null);
  const trackIds = Array.isArray(body?.trackIds) ? body.trackIds.filter((t: unknown) => typeof t === 'string') : [];
  if (trackIds.length === 0) return c.json(ok<string[]>([]));

  const rows = await db.query.favorites.findMany({
    where: and(eq(favorites.userId, userId), inArray(favorites.trackId, trackIds)),
    columns: { trackId: true },
  });
  return c.json(ok(rows.map((r) => r.trackId)));
});

// GET /me/favorites — most-recently-favorited first.
me.get('/favorites', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const rows = await db.query.favorites.findMany({
    where: eq(favorites.userId, userId),
    orderBy: [desc(favorites.createdAt)],
  });

  const tracks: FavoriteTrack[] = rows.map((row) => ({
    id: row.trackId,
    title: row.title,
    artistId: row.artistId,
    artistName: row.artistName,
    albumTitle: row.albumTitle ?? undefined,
    coverUrl: row.coverUrl ?? '',
    previewUrl: row.previewUrl ?? undefined,
    durationMs: row.durationMs ?? undefined,
    genre: row.genre ?? undefined,
    favoritedAt: row.createdAt.toISOString(),
  }));
  return c.json(ok(tracks));
});

// POST /me/playlists — create a new (empty) playlist.
me.post('/playlists', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const body = await c.req.json().catch(() => null);
  const parsed = createPlaylistSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0]?.message ?? 'invalid input'), 400);
  }

  const [created] = await db.insert(playlists).values({ userId, name: parsed.data.name }).returning();
  if (!created) return c.json(err('could not create playlist'), 500);

  const summary: PlaylistSummary = {
    id: created.id,
    name: created.name,
    createdAt: created.createdAt.toISOString(),
    trackCount: 0,
  };
  return c.json(ok(summary), 201);
});

// GET /me/playlists — every playlist this user owns, newest first, with a
// track count each (one extra query per playlist — fine at this scale;
// worth a JOIN+GROUP BY if a user ever has hundreds of playlists).
me.get('/playlists', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const rows = await db.query.playlists.findMany({
    where: eq(playlists.userId, userId),
    orderBy: [desc(playlists.createdAt)],
  });

  const summaries: PlaylistSummary[] = await Promise.all(
    rows.map(async (row) => {
      const tracks = await db.query.playlistTracks.findMany({ where: eq(playlistTracks.playlistId, row.id) });
      return {
        id: row.id,
        name: row.name,
        createdAt: row.createdAt.toISOString(),
        trackCount: tracks.length,
      };
    }),
  );
  return c.json(ok(summaries));
});

// DELETE /me/playlists/:id — only the owner can delete it; a stranger's
// playlist id just 404s rather than confirming it exists.
me.delete('/playlists/:id', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const id = c.req.param('id');
  const owned = await db.query.playlists.findFirst({ where: and(eq(playlists.id, id), eq(playlists.userId, userId)) });
  if (!owned) return c.json(err('playlist not found'), 404);

  await db.delete(playlists).where(eq(playlists.id, id));
  return c.json(ok(null));
});

// GET /me/playlists/:id — a playlist's own info plus its tracks, oldest
// added first (the order you built it in).
me.get('/playlists/:id', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const id = c.req.param('id');
  const playlist = await db.query.playlists.findFirst({ where: and(eq(playlists.id, id), eq(playlists.userId, userId)) });
  if (!playlist) return c.json(err('playlist not found'), 404);

  const rows = await db.query.playlistTracks.findMany({
    where: eq(playlistTracks.playlistId, id),
    orderBy: [playlistTracks.addedAt],
  });

  const tracks: PlaylistDetail['tracks'] = rows.map((row) => ({
    id: row.trackId,
    title: row.title,
    artistId: row.artistId,
    artistName: row.artistName,
    albumTitle: row.albumTitle ?? undefined,
    coverUrl: row.coverUrl ?? '',
    previewUrl: row.previewUrl ?? undefined,
    durationMs: row.durationMs ?? undefined,
    genre: row.genre ?? undefined,
    addedAt: row.addedAt.toISOString(),
  }));

  const detail: PlaylistDetail = {
    playlist: { id: playlist.id, name: playlist.name, createdAt: playlist.createdAt.toISOString(), trackCount: tracks.length },
    tracks,
  };
  return c.json(ok(detail));
});

// POST /me/playlists/:id/tracks — idempotent, same reasoning as
// POST /me/favorites (unique constraint on (playlistId, trackId)).
me.post('/playlists/:id/tracks', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const id = c.req.param('id');
  const owned = await db.query.playlists.findFirst({ where: and(eq(playlists.id, id), eq(playlists.userId, userId)) });
  if (!owned) return c.json(err('playlist not found'), 404);

  const body = await c.req.json().catch(() => null);
  const parsed = trackSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err(parsed.error.issues[0]?.message ?? 'invalid input'), 400);
  }

  await db
    .insert(playlistTracks)
    .values({ playlistId: id, ...parsed.data })
    .onConflictDoNothing({ target: [playlistTracks.playlistId, playlistTracks.trackId] });

  return c.json(ok(null), 201);
});

// DELETE /me/playlists/:id/tracks/:trackId
me.delete('/playlists/:id/tracks/:trackId', async (c) => {
  const userId = await getSessionUserId(c);
  if (!userId) return c.json(err('not signed in'), 401);

  const id = c.req.param('id');
  const owned = await db.query.playlists.findFirst({ where: and(eq(playlists.id, id), eq(playlists.userId, userId)) });
  if (!owned) return c.json(err('playlist not found'), 404);

  const trackId = c.req.param('trackId');
  await db
    .delete(playlistTracks)
    .where(and(eq(playlistTracks.playlistId, id), eq(playlistTracks.trackId, trackId)));
  return c.json(ok(null));
});