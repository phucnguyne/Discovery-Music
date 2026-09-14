// packages/api-client/src/index.ts
//
// One typed surface over apps/api. Web calls this from Astro frontmatter
// (server-side) and from the React SearchBar island (browser-side); a
// future Expo app would import this exact same package.
import type {
  ApiResult,
  Album,
  Artist,
  ArtistProfile,
  ListeningEvent,
  RecentlyPlayedTrack,
  FavoriteTrack,
  PlaylistSummary,
  PlaylistDetail,
  SearchResults,
  Track,
  User,
} from '@music/types';
import { API_BASE_URL } from '@music/config';

export interface MusicApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class MusicApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export function createMusicApiClient(options: MusicApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? API_BASE_URL;
  const doFetch = options.fetchImpl ?? fetch;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        // Session cookie is httpOnly + cross-port in dev (4321 -> 4322), so
        // every call needs to opt in to sending/receiving it explicitly —
        // fetch doesn't do this by default for cross-origin requests.
        credentials: 'include',
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          ...init?.headers,
        },
      });
    } catch (err) {
      throw new MusicApiError(`Could not reach @music/api at ${baseUrl}: ${(err as Error).message}`);
    }
    const body = (await res.json()) as ApiResult<T>;
    if (!body.ok) throw new MusicApiError(body.error, res.status);
    return body.data;
  }

  return {
    search: (q: string) => request<SearchResults>(`/catalog/search?q=${encodeURIComponent(q)}`),
    trending: () => request<Track[]>('/catalog/charts/trending'),
    newReleases: () => request<Album[]>('/catalog/charts/new-releases'),
    genre: (slug: string) => request<{ genre: { slug: string; label: string }; tracks: Track[]; albums: Album[] }>(
      `/catalog/genres/${encodeURIComponent(slug)}`,
    ),
    artist: (id: string) => request<ArtistProfile>(`/catalog/artists/${encodeURIComponent(id)}`),
    album: (id: string) => request<{ album: Album; tracks: Track[] }>(`/catalog/albums/${encodeURIComponent(id)}`),

    signup: (input: { email: string; password: string; displayName: string }) =>
      request<User>('/auth/signup', { method: 'POST', body: JSON.stringify(input) }),
    login: (input: { email: string; password: string }) =>
      request<User>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    logout: () => request<null>('/auth/logout', { method: 'POST' }),
    /** Never throws — returns null for "not signed in" AND for "couldn't
     * even reach @music/api". This runs from TopBar on every single page,
     * so an API hiccup has to degrade to a logged-out header, not take
     * the whole site down with it.
     *
     * `cookieHeader` is only needed when calling this from Astro
     * frontmatter (server-side): that fetch has no browser cookie jar of
     * its own, so pass `Astro.request.headers.get('cookie')` through
     * explicitly. Client-side (React islands, browser fetch) can omit it —
     * `credentials: 'include'` above already handles it there. */
    me: async (cookieHeader?: string | null): Promise<User | null> => {
      try {
        return await request<User>('/auth/me', cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined);
      } catch {
        return null;
      }
    },

    updateAccount: (input: { displayName?: string; currentPassword?: string; newPassword?: string }) =>
      request<User>('/me', { method: 'PATCH', body: JSON.stringify(input) }),

    /** Fire-and-forget: called from the player the moment a track actually
     * starts. Never throws — not signed in, or @music/api being briefly
     * unreachable, is never worth interrupting playback over; the only
     * cost is that this one play doesn't shape future recommendations and
     * won't show up in "Recently played". Accepts a full Track (not just
     * artistId/genre) so it can double as the "Recently played" source —
     * see apps/api's listening_events table. */
    recordListen: async (track: Track): Promise<void> => {
      try {
        await request<null>('/me/listening-events', {
          method: 'POST',
          body: JSON.stringify({
            artistId: track.artistId,
            genre: track.genre,
            trackId: track.id,
            title: track.title,
            artistName: track.artistName,
            albumTitle: track.albumTitle,
            coverUrl: track.coverUrl,
            previewUrl: track.previewUrl,
            durationMs: track.durationMs,
          }),
        });
      } catch {
        // best-effort — see doc comment above
      }
    },

    /** Never throws — returns [] rather than surfacing "not signed in" or
     * an unreachable API as an error, matching me()'s philosophy: this
     * feeds packages/domain's cold-start fallback, so "no history" and
     * "couldn't check" both just mean "show the cold-start pick". */
    listeningHistory: async (cookieHeader?: string | null): Promise<ListeningEvent[]> => {
      try {
        return await request<ListeningEvent[]>(
          '/me/listening-events?limit=50',
          cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
        );
      } catch {
        return [];
      }
    },

    /** Never throws — an empty list reads the same as "you haven't played
     * anything yet" whether that's true or the API hiccuped. */
    recentlyPlayed: async (cookieHeader?: string | null): Promise<RecentlyPlayedTrack[]> => {
      try {
        return await request<RecentlyPlayedTrack[]>(
          '/me/recently-played?limit=30',
          cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
        );
      } catch {
        return [];
      }
    },

    favorites: (cookieHeader?: string | null) =>
      request<FavoriteTrack[]>('/me/favorites', cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined),
    /** Never throws — an unreachable API or logged-out state both just
     * mean "nothing shows as favorited yet", not an error worth surfacing
     * for what's a purely cosmetic heart-icon check. */
    checkFavorites: async (trackIds: string[]): Promise<string[]> => {
      if (trackIds.length === 0) return [];
      try {
        return await request<string[]>('/me/favorites/check', { method: 'POST', body: JSON.stringify({ trackIds }) });
      } catch {
        return [];
      }
    },
    addFavorite: (track: Track) =>
      request<null>('/me/favorites', {
        method: 'POST',
        body: JSON.stringify({
          trackId: track.id,
          title: track.title,
          artistId: track.artistId,
          artistName: track.artistName,
          albumTitle: track.albumTitle,
          coverUrl: track.coverUrl,
          previewUrl: track.previewUrl,
          durationMs: track.durationMs,
          genre: track.genre,
        }),
      }),
    removeFavorite: (trackId: string) => request<null>(`/me/favorites/${encodeURIComponent(trackId)}`, { method: 'DELETE' }),

    playlists: (cookieHeader?: string | null) =>
      request<PlaylistSummary[]>('/me/playlists', cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined),
    createPlaylist: (name: string) =>
      request<PlaylistSummary>('/me/playlists', { method: 'POST', body: JSON.stringify({ name }) }),
    deletePlaylist: (playlistId: string) => request<null>(`/me/playlists/${encodeURIComponent(playlistId)}`, { method: 'DELETE' }),
    playlist: (playlistId: string, cookieHeader?: string | null) =>
      request<PlaylistDetail>(
        `/me/playlists/${encodeURIComponent(playlistId)}`,
        cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
      ),
    addToPlaylist: (playlistId: string, track: Track) =>
      request<null>(`/me/playlists/${encodeURIComponent(playlistId)}/tracks`, {
        method: 'POST',
        body: JSON.stringify({
          trackId: track.id,
          title: track.title,
          artistId: track.artistId,
          artistName: track.artistName,
          albumTitle: track.albumTitle,
          coverUrl: track.coverUrl,
          previewUrl: track.previewUrl,
          durationMs: track.durationMs,
          genre: track.genre,
        }),
      }),
    removeFromPlaylist: (playlistId: string, trackId: string) =>
      request<null>(`/me/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`, {
        method: 'DELETE',
      }),
  };
}

export type MusicApiClient = ReturnType<typeof createMusicApiClient>;
export type {
  Track,
  Album,
  Artist,
  SearchResults,
  ArtistProfile,
  User,
  ListeningEvent,
  RecentlyPlayedTrack,
  FavoriteTrack,
  PlaylistSummary,
  PlaylistDetail,
};