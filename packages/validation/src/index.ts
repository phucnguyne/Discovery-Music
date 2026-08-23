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

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type GenreSlugParam = z.infer<typeof genreSlugSchema>;
export type ArtistIdParam = z.infer<typeof artistIdSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
