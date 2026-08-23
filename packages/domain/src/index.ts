// packages/domain/src/index.ts
//
// Deliberately not ML. Per the project notes: start with genre/artist
// similarity from listening history, only reach for embeddings/vector
// search later if the simple version isn't enough.
import type { Genre } from '@music/types';

export interface ListeningEvent {
  genre?: string;
  artistId: string;
  playedAt: string; // ISO date
}

/** Counts plays per genre and returns genres ranked by preference, most
 * listened first. Ties broken by recency of the most recent play. */
export function rankGenrePreference(history: ListeningEvent[]): string[] {
  const counts = new Map<string, { count: number; lastPlayed: number }>();

  for (const event of history) {
    if (!event.genre) continue;
    const ts = new Date(event.playedAt).getTime();
    const entry = counts.get(event.genre) ?? { count: 0, lastPlayed: 0 };
    entry.count += 1;
    entry.lastPlayed = Math.max(entry.lastPlayed, Number.isNaN(ts) ? 0 : ts);
    counts.set(event.genre, entry);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].lastPlayed - a[1].lastPlayed)
    .map(([genre]) => genre);
}

/** Picks the next genre to surface as "Because you listened to X" — the
 * top preference, or a random genre for cold-start (no history yet). */
export function pickRecommendationSeed(history: ListeningEvent[], allGenres: Genre[]): Genre {
  const ranked = rankGenrePreference(history);
  if (ranked.length > 0) {
    const match = allGenres.find((g) => g.slug === ranked[0] || g.label === ranked[0]);
    if (match) return match;
  }
  return allGenres[Math.floor(Math.random() * allGenres.length)];
}

/** Two artists are "similar" here only by sharing a primary genre — a
 * placeholder for real collaborative filtering later. */
export function isSimilarArtist(genreA?: string, genreB?: string): boolean {
  if (!genreA || !genreB) return false;
  return genreA.toLowerCase() === genreB.toLowerCase();
}
