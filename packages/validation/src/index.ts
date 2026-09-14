// packages/validation/src/index.ts
import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'q is required').max(200),
});

export const genreSlugSchema = z.object({
  slug: z.string().trim().min(1).max(60),
});

export const artistIdSchema = z.object({
  id: z.string().trim().regex(/^\d+$/, 'artist id must be numeric'),
});

export const albumIdSchema = z.object({
  id: z.string().trim().regex(/^\d+$/, 'album id must be numeric'),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

// Auth — deliberately conservative: 72 chars is scrypt/bcrypt's practical
// input ceiling, and requiring one letter + one number blocks the
// most trivially-guessed passwords without being obnoxious about it.
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email('invalid email').max(254),
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(72, 'password must be at most 72 characters')
    .regex(/[a-zA-Z]/, 'password must contain a letter')
    .regex(/[0-9]/, 'password must contain a number'),
  displayName: z.string().trim().min(1, 'display name is required').max(60),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('invalid email').max(254),
  password: z.string().min(1, 'password is required').max(72),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const recordListenSchema = z.object({
  artistId: z.string().trim().min(1, 'artistId is required').max(64),
  genre: z.string().trim().min(1).max(60).optional(),
  // Everything below is optional so recording a listen never fails just
  // because a chart-sourced track (see itunes-provider's chart mapping)
  // is missing some of it — those plays still count for recommendations,
  // they just won't show up in "Recently played" (see schema.ts's comment
  // on listening_events for why).
  trackId: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  artistName: z.string().trim().min(1).max(200).optional(),
  albumTitle: z.string().trim().max(300).optional(),
  coverUrl: z.string().trim().max(2000).optional(),
  previewUrl: z.string().trim().max(2000).optional(),
  durationMs: z.number().int().positive().optional(),
});

export type RecordListenInput = z.infer<typeof recordListenSchema>;

// Shared by POST /me/favorites and POST /me/playlists/:id/tracks — both
// just snapshot a Track (see schema.ts's comment on why there's no
// permanent tracks table to reference instead).
export const trackSnapshotSchema = z.object({
  trackId: z.string().trim().min(1, 'trackId is required').max(64),
  title: z.string().trim().min(1, 'title is required').max(300),
  artistId: z.string().trim().min(1, 'artistId is required').max(64),
  artistName: z.string().trim().min(1, 'artistName is required').max(200),
  albumTitle: z.string().trim().max(300).optional(),
  coverUrl: z.string().trim().max(2000).optional(),
  previewUrl: z.string().trim().max(2000).optional(),
  durationMs: z.number().int().positive().optional(),
  genre: z.string().trim().max(60).optional(),
});

export type TrackSnapshotInput = z.infer<typeof trackSnapshotSchema>;

export const createPlaylistSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100),
});

export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;

// PATCH /me — either field alone is fine, but changing the password
// requires proving you know the current one first (same reasoning most
// account-settings pages use: a lingering session cookie on a shared
// machine shouldn't be enough to lock the real owner out).
export const updateAccountSchema = z
  .object({
    displayName: z.string().trim().min(1, 'display name is required').max(60).optional(),
    currentPassword: z.string().min(1).max(72).optional(),
    newPassword: z
      .string()
      .min(8, 'new password must be at least 8 characters')
      .max(72)
      .regex(/[a-zA-Z]/, 'new password must contain a letter')
      .regex(/[0-9]/, 'new password must contain a number')
      .optional(),
  })
  .refine((data) => !data.newPassword || !!data.currentPassword, {
    message: 'current password is required to set a new password',
    path: ['currentPassword'],
  })
  .refine((data) => data.displayName !== undefined || data.newPassword !== undefined, {
    message: 'nothing to update',
  });

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type GenreSlugParam = z.infer<typeof genreSlugSchema>;
export type ArtistIdParam = z.infer<typeof artistIdSchema>;
export type AlbumIdParam = z.infer<typeof albumIdSchema>;
export type Pagination = z.infer<typeof paginationSchema>;