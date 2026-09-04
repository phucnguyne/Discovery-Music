// apps/api/src/db/schema.ts
//
// Single Drizzle Postgres schema, used by BOTH drivers wired up in
// client.ts: PGlite (embedded, file-backed, zero-setup local dev) and
// node-postgres (real Postgres — Neon, Supabase, anything else) for
// production. Same SQL dialect either way, so this file never needs a
// SQLite-specific twin — only the driver in client.ts changes.
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';

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

// Not wired into any route yet — this is the storage-shaped seam for
// packages/domain's ListeningEvent (see README "Known limitations" /
// packages/domain/src/index.ts), so recommendations have somewhere real
// to read from once "Recently played" is built.
export const listeningEvents = pgTable(
  'listening_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    artistId: text('artist_id').notNull(),
    genre: text('genre'),
    playedAt: timestamp('played_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('listening_events_user_id_idx').on(table.userId)],
);
