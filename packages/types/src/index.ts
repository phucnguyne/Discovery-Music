// packages/types/src/index.ts
//
// Domain shapes shared across apps/web, apps/api, and (later) apps/mobile.
// Nothing here knows about iTunes, Astro, React, or any transport — these
// are the shapes apps agree on, not the shapes any one provider returns.

export interface Artist {
  id: string;
  name: string;
  genre?: string;
  profileUrl?: string;
}

export interface Album {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  coverUrl: string;
  releaseDate?: string;
  trackCount?: number;
  genre?: string;
  viewUrl?: string;
  /** Optional top track used to make the album playable in UI cards. */
  topTrack?: Track;
}

export interface Track {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId?: string;
  albumTitle?: string;
  coverUrl: string;
  durationMs?: number;
  genre?: string;
  releaseDate?: string;
  /** 30s clip URL. Optional — some catalog entries have none. */
  previewUrl?: string;
}

export interface Genre {
  slug: string;
  label: string;
}

/** Public-safe user shape — never includes passwordHash or session
 * internals. This is what @music/api sends back and what apps/web sees. */
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string; // ISO date
}

/** One play, as both apps/api (writing rows) and packages/domain (ranking
 * them) need to agree on it — lives here rather than in domain so
 * packages/api-client can return it without depending on packages/domain. */
export interface ListeningEvent {
  genre?: string;
  artistId: string;
  playedAt: string; // ISO date
}

/** A Track as it appears in "Recently played" — same fields, plus when. */
export interface RecentlyPlayedTrack extends Track {
  playedAt: string; // ISO date
}

/** A Track as it appears in "Favorite songs". */
export interface FavoriteTrack extends Track {
  favoritedAt: string; // ISO date
}

/** A playlist's own metadata — not its tracks, see PlaylistDetail for those. */
export interface PlaylistSummary {
  id: string;
  name: string;
  createdAt: string; // ISO date
  trackCount: number;
}

/** A Track as it appears inside a playlist. */
export interface PlaylistTrackItem extends Track {
  addedAt: string; // ISO date
}

export interface PlaylistDetail {
  playlist: PlaylistSummary;
  tracks: PlaylistTrackItem[];
}

export interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
}

export interface ArtistProfile {
  artist: Artist;
  topTracks: Track[];
  albums: Album[];
}

/** Playback state broadcast to other devices via SSE sync. */
export interface PlaybackSyncEvent {
  trackId: string;
  positionMs: number;
  isPlaying: boolean;
  updatedAt: string; // ISO date
}

/** Generic wrapper every API route returns, so clients can branch on `ok`
 * without throwing on expected "upstream had nothing" cases. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const GENRES: Genre[] = [
  { slug: 'pop', label: 'Pop' },
  { slug: 'hip-hop', label: 'Hip-Hop / Rap' },
  { slug: 'rnb', label: 'R&B / Soul' },
  { slug: 'electronic', label: 'Electronic' },
  { slug: 'rock', label: 'Rock' },
  { slug: 'indie', label: 'Indie' },
  { slug: 'lofi', label: 'Lo-fi / Chill' },
  { slug: 'kpop', label: 'K-Pop' },
  { slug: 'jazz', label: 'Jazz' },
  { slug: 'classical', label: 'Classical' },
];