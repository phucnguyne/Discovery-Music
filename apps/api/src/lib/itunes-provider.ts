// apps/api/src/lib/itunes-provider.ts
//
// This is now the single integration point with iTunes. Neither apps/web
// nor a future apps/mobile talk to itunes.apple.com directly anymore —
// they only see @music/types shapes coming back from apps/api. Swapping
// or adding a provider (Spotify, etc.) means editing this file, not every
// app that consumes music data.
import type { Album, Artist, Track } from '@music/types';

const SEARCH_URL = 'https://itunes.apple.com/search';
const LOOKUP_URL = 'https://itunes.apple.com/lookup';
// Real Apple-curated charts, separate service from the Search API above.
// NOTE: this feed does NOT include artistId, only artistName — so charted
// items can't deep-link to an artist profile the way search results can.
const CHARTS_BASE_URL = 'https://rss.marketingtools.apple.com/api/v2';

interface RawTrack {
  wrapperType: 'track';
  trackId: number;
  trackName: string;
  artistId: number;
  artistName: string;
  collectionId?: number;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
  releaseDate?: string;
}

interface RawAlbum {
  wrapperType: 'collection';
  collectionId: number;
  collectionName: string;
  artistId: number;
  artistName: string;
  artworkUrl100?: string;
  trackCount?: number;
  primaryGenreName?: string;
  releaseDate?: string;
  collectionViewUrl?: string;
}

interface RawArtist {
  wrapperType: 'artist';
  artistId: number;
  artistName: string;
  primaryGenreName?: string;
  artistViewUrl?: string;
}

// Shape of items inside rss.marketingtools.apple.com's `feed.results[]`.
// Deliberately separate from RawTrack/RawAlbum above — this is a different
// upstream with a different (smaller) set of fields, no wrapperType tag,
// and no artistId.
interface RawChartSong {
  id: string;
  name: string;
  artistName: string;
  releaseDate?: string;
  artworkUrl100?: string;
  url?: string;
  genres?: { genreId: string; name: string; url: string }[];
}

interface RawChartAlbum {
  id: string;
  name: string;
  artistName: string;
  releaseDate?: string;
  artworkUrl100?: string;
  url?: string;
  genres?: { genreId: string; name: string; url: string }[];
}

interface ChartFeedResponse<T> {
  feed: { title: string; results: T[] };
}

async function safeFetchJSON<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
function artworkSrc(url: string | undefined, size = 600): string {
  if (!url) return '';
  return url.replace(/\/\d+x\d+bb\.(jpg|png)/, `/${size}x${size}bb.$1`);
}

function toTrack(t: RawTrack): Track {
  return {
    id: String(t.trackId),
    title: t.trackName,
    artistId: String(t.artistId),
    artistName: t.artistName,
    albumId: t.collectionId ? String(t.collectionId) : undefined,
    albumTitle: t.collectionName,
    coverUrl: artworkSrc(t.artworkUrl100, 600),
    durationMs: t.trackTimeMillis,
    genre: t.primaryGenreName,
    releaseDate: t.releaseDate,
    previewUrl: t.previewUrl,
  };
}

function toAlbum(a: RawAlbum): Album {
  return {
    id: String(a.collectionId),
    title: a.collectionName,
    artistId: String(a.artistId),
    artistName: a.artistName,
    coverUrl: artworkSrc(a.artworkUrl100, 600),
    releaseDate: a.releaseDate,
    trackCount: a.trackCount,
    genre: a.primaryGenreName,
    viewUrl: a.collectionViewUrl,
  };
}

function toArtist(a: RawArtist): Artist {
  return {
    id: String(a.artistId),
    name: a.artistName,
    genre: a.primaryGenreName,
    profileUrl: a.artistViewUrl,
  };
}

// artistId is unavailable from this feed. Using '' (not a fake numeric id)
// so downstream code can check `track.artistId === ''` to hide/disable
// "go to artist" links instead of navigating to a wrong or invented artist.
function chartSongToTrack(s: RawChartSong): Track {
  return {
    id: s.id,
    title: s.name,
    artistId: '',
    artistName: s.artistName,
    coverUrl: artworkSrc(s.artworkUrl100, 600),
    genre: s.genres?.[0]?.name,
    releaseDate: s.releaseDate,
    // Chart feed has no 30s preview URL either — search API is still the
    // only source of previewUrl in this codebase.
    previewUrl: undefined,
  };
}

function chartAlbumToAlbum(a: RawChartAlbum): Album {
  return {
    id: a.id,
    title: a.name,
    artistId: '',
    artistName: a.artistName,
    coverUrl: artworkSrc(a.artworkUrl100, 600),
    releaseDate: a.releaseDate,
    genre: a.genres?.[0]?.name,
    viewUrl: a.url,
  };
}

export async function searchTracks(term: string, limit = 12): Promise<Track[]> {
  const url = `${SEARCH_URL}?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
  const data = await safeFetchJSON<{ results: RawTrack[] }>(url);
  return (data?.results ?? []).filter((r) => r.wrapperType === 'track').map(toTrack);
}

export async function searchAlbums(term: string, limit = 12): Promise<Album[]> {
  const url = `${SEARCH_URL}?term=${encodeURIComponent(term)}&media=music&entity=album&limit=${limit}`;
  const data = await safeFetchJSON<{ results: RawAlbum[] }>(url);
  return (data?.results ?? []).filter((r) => r.wrapperType === 'collection').map(toAlbum);
}

export async function searchArtists(term: string, limit = 8): Promise<Artist[]> {
  const url = `${SEARCH_URL}?term=${encodeURIComponent(term)}&media=music&entity=musicArtist&limit=${limit}`;
  const data = await safeFetchJSON<{ results: RawArtist[] }>(url);
  return (data?.results ?? []).filter((r) => r.wrapperType === 'artist').map(toArtist);
}

export async function lookupArtist(artistId: string): Promise<Artist | null> {
  const url = `${LOOKUP_URL}?id=${artistId}&entity=musicArtist`;
  const data = await safeFetchJSON<{ results: RawArtist[] }>(url);
  const found = data?.results.find((r) => r.wrapperType === 'artist');
  return found ? toArtist(found) : null;
}

export async function lookupArtistAlbums(artistId: string, limit = 12): Promise<Album[]> {
  const url = `${LOOKUP_URL}?id=${artistId}&entity=album&limit=${limit}`;
  const data = await safeFetchJSON<{ results: (RawAlbum | RawArtist)[] }>(url);
  return (data?.results.filter((r) => r.wrapperType === 'collection') as RawAlbum[] | undefined ?? []).map(toAlbum);
}

export async function lookupArtistTopTracks(artistId: string, limit = 10): Promise<Track[]> {
  const url = `${LOOKUP_URL}?id=${artistId}&entity=song&limit=${limit}&sort=recent`;
  const data = await safeFetchJSON<{ results: (RawTrack | RawArtist)[] }>(url);
  return (data?.results.filter((r) => r.wrapperType === 'track') as RawTrack[] | undefined ?? []).map(toTrack);
}

export async function fetchTopSongs(country = 'us', limit = 10): Promise<Track[]> {
  const url = `${CHARTS_BASE_URL}/${country}/music/most-played/${limit}/songs.json`;
  const data = await safeFetchJSON<ChartFeedResponse<RawChartSong>>(url);
  return (data?.feed.results ?? []).map(chartSongToTrack);
}

export async function fetchTopAlbums(country = 'us', limit = 10): Promise<Album[]> {
  const url = `${CHARTS_BASE_URL}/${country}/music/most-played/${limit}/albums.json`;
  const data = await safeFetchJSON<ChartFeedResponse<RawChartAlbum>>(url);
  return (data?.feed.results ?? []).map(chartAlbumToAlbum);
}