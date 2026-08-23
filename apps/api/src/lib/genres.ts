// apps/api/src/lib/genres.ts
import { GENRES } from '@music/types';

// The iTunes Search API has no real "browse by genre" route, so each genre
// resolves to a representative search term. Swappable per-provider later.
const GENRE_TERMS: Record<string, string> = {
  pop: 'pop hits',
  'hip-hop': 'hip hop',
  rnb: 'r&b soul',
  electronic: 'electronic dance',
  rock: 'rock',
  indie: 'indie folk',
  lofi: 'lofi chill beats',
  kpop: 'kpop',
  jazz: 'jazz',
  classical: 'classical piano',
};

export function findGenre(slug: string) {
  const genre = GENRES.find((g) => g.slug === slug);
  if (!genre) return null;
  return { ...genre, term: GENRE_TERMS[slug] ?? genre.label };
}
