// packages/api-client/src/index.ts
//
// One typed surface over apps/api. Web calls this from Astro frontmatter
// (server-side) and from the React SearchBar island (browser-side); a
// future Expo app would import this exact same package.
import type { ApiResult, Album, Artist, ArtistProfile, SearchResults, Track, User } from '@music/types';
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

    signup: (input: { email: string; password: string; displayName: string }) =>
      request<User>('/auth/signup', { method: 'POST', body: JSON.stringify(input) }),
    login: (input: { email: string; password: string }) =>
      request<User>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    logout: () => request<null>('/auth/logout', { method: 'POST' }),
    /** Never throws for "not signed in" — returns null instead, since that
     * is an expected, common state (every logged-out page load) rather
     * than an error worth a try/catch at every call site.
     *
     * `cookieHeader` is only needed when calling this from Astro
     * frontmatter (server-side): that fetch has no browser cookie jar of
     * its own, so pass `Astro.request.headers.get('cookie')` through
     * explicitly. Client-side (React islands, browser fetch) can omit it —
     * `credentials: 'include'` above already handles it there. */
    me: async (cookieHeader?: string | null): Promise<User | null> => {
      try {
        return await request<User>('/auth/me', cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined);
      } catch (err) {
        if (err instanceof MusicApiError && err.status === 401) return null;
        throw err;
      }
    },
  };
}

export type MusicApiClient = ReturnType<typeof createMusicApiClient>;
export type { Track, Album, Artist, SearchResults, ArtistProfile, User };