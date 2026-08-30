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

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type GenreSlugParam = z.infer<typeof genreSlugSchema>;
export type ArtistIdParam = z.infer<typeof artistIdSchema>;
export type Pagination = z.infer<typeof paginationSchema>;