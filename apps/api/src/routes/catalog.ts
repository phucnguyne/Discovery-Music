// apps/api/src/routes/catalog.ts
import { Hono, type Context } from 'hono';
import type { ApiResult, ArtistProfile, SearchResults } from '@music/types';
import {
  searchQuerySchema,
  searchTracksQuerySchema,
  artistTracksQuerySchema,
  genreSlugSchema,
  artistIdSchema,
  artistNameSchema,
  albumIdSchema,
} from '@music/validation';
import { CACHE_TTL_MS } from '@music/config';
import { cached } from '../lib/cache.js';
import { findGenre } from '../lib/genres.js';
import * as itunes from '../lib/itunes-provider.js';
import { withinRateLimit, clientIp } from '../lib/rate-limit.js';

export const catalog = new Hono();

catalog.use('*', async (c, next) => {
  if (!withinRateLimit(`catalog:${clientIp(c)}`, 120, 60 * 1000)) {
    return c.json(fail('too many requests, try again shortly'), 429);
  }
  await next();
});

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function fail(error: string): ApiResult<never> {
  return { ok: false, error };
}

/** Mirrors the in-process cache's TTL as an HTTP Cache-Control header, so
 * a repeat request within that window can be served by the browser (or
 * any CDN in front) without a round trip at all — not just skip iTunes,
 * skip the network entirely. `public` is safe here: none of these catalog
 * routes read cookies or vary per-user. */
function setCacheHeader(c: Context, ttlMs: number) {
  c.header('Cache-Control', `public, max-age=${Math.floor(ttlMs / 1000)}`);
}

// GET /catalog/search?q=...
catalog.get('/search', async (c) => {
  if (!withinRateLimit(`search:${clientIp(c)}`, 60, 60 * 1000)) {
    return c.json(fail('too many searches, slow down a moment'), 429);
  }

  const parsed = searchQuerySchema.safeParse({ q: c.req.query('q') });
  if (!parsed.success) {
    return c.json(fail(parsed.error.issues[0]?.message ?? 'invalid query'), 400);
  }
  const { q } = parsed.data;

  const results = await cached<SearchResults>(`search:${q}`, CACHE_TTL_MS.search, async () => {
    const [tracks, albums, artists] = await Promise.all([
      itunes.searchTracks(q, 16),
      itunes.searchAlbums(q, 8),
      itunes.searchArtists(q, 6),
    ]);
    return { tracks, albums, artists };
  });

  setCacheHeader(c, CACHE_TTL_MS.search);
  return c.json(ok(results));
});

// GET /catalog/search/tracks?q=...&offset=10
catalog.get('/search/tracks', async (c) => {
  if (!withinRateLimit(`search:${clientIp(c)}`, 60, 60 * 1000)) {
    return c.json(fail('too many searches, slow down a moment'), 429);
  }

  const parsed = searchTracksQuerySchema.safeParse({
    q: c.req.query('q'),
    offset: c.req.query('offset') ?? '0',
  });
  if (!parsed.success) {
    return c.json(fail(parsed.error.issues[0]?.message ?? 'invalid query'), 400);
  }
  const { q, offset } = parsed.data;
  const result = await cached(`search-tracks:${q}:${offset}`, CACHE_TTL_MS.search, () =>
    itunes.searchTracksPage(q, offset, 10),
  );

  setCacheHeader(c, CACHE_TTL_MS.search);
  return c.json(ok(result));
});

// GET /catalog/charts/trending?country=us
catalog.get('/charts/trending', async (c) => {
  const country = c.req.query('country') ?? 'us';
  if (!/^[a-z]{2}$/i.test(country)) return c.json(fail('invalid country code'), 400);
  const countryCode = country.toLowerCase();
  const tracks = await cached(`charts:trending:${countryCode}`, CACHE_TTL_MS.charts, () =>
    itunes.fetchTopSongs(countryCode, 10),
  );
  setCacheHeader(c, CACHE_TTL_MS.charts);
  return c.json(ok(tracks));
});

// GET /catalog/charts/new-releases?country=us
catalog.get('/charts/new-releases', async (c) => {
  const country = c.req.query('country') ?? 'us';
  if (!/^[a-z]{2}$/i.test(country)) return c.json(fail('invalid country code'), 400);
  const countryCode = country.toLowerCase();
  const albums = await cached(`charts:new-releases:${countryCode}`, CACHE_TTL_MS.charts, () =>
    itunes.fetchTopAlbums(countryCode, 10),
  );
  setCacheHeader(c, CACHE_TTL_MS.charts);
  return c.json(ok(albums));
});

// GET /catalog/genres/:slug
catalog.get('/genres/:slug', async (c) => {
  const parsed = genreSlugSchema.safeParse({ slug: c.req.param('slug') });
  if (!parsed.success) return c.json(fail('invalid genre'), 400);

  const genre = findGenre(parsed.data.slug);
  if (!genre) return c.json(fail('unknown genre'), 404);

  const result = await cached(`genre:${genre.slug}`, CACHE_TTL_MS.charts, async () => {
    const [tracks, albums] = await Promise.all([
      itunes.searchTracks(genre.term, 16),
      itunes.searchAlbums(genre.term, 8),
    ]);
    return { genre: { slug: genre.slug, label: genre.label }, tracks, albums };
  });

  setCacheHeader(c, CACHE_TTL_MS.charts);
  return c.json(ok(result));
});

// GET /catalog/artists/resolve?name=...
catalog.get('/artists/resolve', async (c) => {
  const parsed = artistNameSchema.safeParse({ name: c.req.query('name') });
  if (!parsed.success) {
    return c.json(fail(parsed.error.issues[0]?.message ?? 'invalid artist name'), 400);
  }

  const { name } = parsed.data;
  const artist = await cached(`artist-name:${name.toLocaleLowerCase()}`, CACHE_TTL_MS.artist, async () => {
    const candidates = await itunes.searchArtists(name, 20);
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
    return candidates.find((candidate) => normalize(candidate.name) === normalize(name)) ?? null;
  });

  if (!artist) return c.json(fail('artist not found'), 404);
  setCacheHeader(c, CACHE_TTL_MS.artist);
  return c.json(ok(artist));
});

// GET /catalog/artists/:id
catalog.get('/artists/:id', async (c) => {
  const parsed = artistIdSchema.safeParse({ id: c.req.param('id') });
  if (!parsed.success) return c.json(fail('invalid artist id'), 400);
  const { id } = parsed.data;

  const profile = await cached<ArtistProfile | null>(`artist:${id}`, CACHE_TTL_MS.artist, async () => {
    const [artist, albums, trackPage] = await Promise.all([
      itunes.lookupArtist(id),
      itunes.lookupArtistAlbums(id, 200),
      itunes.lookupArtistTopTracks(id, 0, 10),
    ]);
    if (!artist) return null;
    return {
      artist,
      albums,
      topTracks: trackPage.tracks,
      hasMoreTopTracks: trackPage.hasMore,
    };
  });

  if (!profile) return c.json(fail('artist not found'), 404);
  setCacheHeader(c, CACHE_TTL_MS.artist);
  return c.json(ok(profile));
});

// GET /catalog/artists/:id/tracks?offset=10
catalog.get('/artists/:id/tracks', async (c) => {
  const parsedId = artistIdSchema.safeParse({ id: c.req.param('id') });
  const parsedQuery = artistTracksQuerySchema.safeParse({
    offset: c.req.query('offset') ?? '0',
  });
  if (!parsedId.success) return c.json(fail('invalid artist id'), 400);
  if (!parsedQuery.success) {
    return c.json(fail(parsedQuery.error.issues[0]?.message ?? 'invalid offset'), 400);
  }

  const { id } = parsedId.data;
  const { offset } = parsedQuery.data;
  const page = await cached(`artist-tracks:${id}:${offset}`, CACHE_TTL_MS.artist, () =>
    itunes.lookupArtistTopTracks(id, offset, 10),
  );
  setCacheHeader(c, CACHE_TTL_MS.artist);
  return c.json(ok(page));
});

// GET /catalog/albums/:id — an album's own info plus its full tracklist.
// This is the "New releases" cards' click target: chart albums come with
// an id but no artistId (see itunes-provider's chart mapping), so linking
// to /artist/:id isn't possible for them — this route doesn't need one.
catalog.get('/albums/:id', async (c) => {
  const parsed = albumIdSchema.safeParse({ id: c.req.param('id') });
  if (!parsed.success) return c.json(fail('invalid album id'), 400);
  const { id } = parsed.data;

  const result = await cached(`album:${id}`, CACHE_TTL_MS.artist, () => itunes.lookupAlbum(id, 200));

  if (!result) return c.json(fail('album not found'), 404);
  setCacheHeader(c, CACHE_TTL_MS.artist);
  return c.json(ok(result));
});