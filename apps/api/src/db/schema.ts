// apps/api/src/db/schema.ts
//
// Single Drizzle Postgres schema, used by BOTH drivers wired up in
// client.ts: PGlite (embedded, file-backed, zero-setup local dev) and
// node-postgres (real Postgres — Neon, Supabase, anything else) for
// production. Same SQL dialect either way, so this file never needs a
// SQLite-specific twin — only the driver in client.ts changes.
import { pgTable, uuid, text, integer, timestamp, index, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Refresh tokens are long-lived tokens stored in the DB (hashed)
// to securely issue new access tokens when they expire.
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('refresh_tokens_user_id_idx').on(table.userId)],
);

// There's no permanent "tracks" table — iTunes data is fetched on demand
// and never stored otherwise — so listening_events, favorites, and
// playlist_tracks below each snapshot the @music/types Track fields they
// need at the moment of the action (played/favorited/added). The track
// columns here are nullable rather than notNull() specifically so this
// migration doesn't fail against rows written before this feature existed
// (which only ever had artistId/genre) — those old rows just won't have
// a title/coverUrl to show and get filtered out of "Recently played".
export const listeningEvents = pgTable(
  'listening_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    artistId: text('artist_id').notNull(),
    genre: text('genre'),
    trackId: text('track_id'),
    title: text('title'),
    artistName: text('artist_name'),
    albumTitle: text('album_title'),
    coverUrl: text('cover_url'),
    previewUrl: text('preview_url'),
    durationMs: integer('duration_ms'),
    playedAt: timestamp('played_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('listening_events_user_id_idx').on(table.userId)],
);

export const favorites = pgTable(
  'favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trackId: text('track_id').notNull(),
    title: text('title').notNull(),
    artistId: text('artist_id').notNull(),
    artistName: text('artist_name').notNull(),
    albumTitle: text('album_title'),
    coverUrl: text('cover_url'),
    previewUrl: text('preview_url'),
    durationMs: integer('duration_ms'),
    genre: text('genre'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('favorites_user_id_idx').on(table.userId),
    // One favorite per (user, track) — POST /me/favorites relies on this
    // to make re-favoriting an already-favorited track a harmless no-op
    // (ON CONFLICT DO NOTHING) instead of a duplicate row.
    unique('favorites_user_track_unique').on(table.userId, table.trackId),
  ],
);

export const playlists = pgTable(
  'playlists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('playlists_user_id_idx').on(table.userId)],
);

export const playlistTracks = pgTable(
  'playlist_tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    trackId: text('track_id').notNull(),
    title: text('title').notNull(),
    artistId: text('artist_id').notNull(),
    artistName: text('artist_name').notNull(),
    albumTitle: text('album_title'),
    coverUrl: text('cover_url'),
    previewUrl: text('preview_url'),
    durationMs: integer('duration_ms'),
    genre: text('genre'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('playlist_tracks_playlist_id_idx').on(table.playlistId),
    // Adding the same track to a playlist twice is a no-op, not a duplicate row.
    unique('playlist_tracks_playlist_track_unique').on(table.playlistId, table.trackId),
  ],
);