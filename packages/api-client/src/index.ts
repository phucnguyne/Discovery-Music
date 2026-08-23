// packages/api-client/src/index.ts
//
// One typed surface over apps/api. Web calls this from Astro frontmatter
// (server-side) and from the React SearchBar island (browser-side); a
// future Expo app would import this exact same package.
import type { ApiResult, Album, Artist, ArtistProfile, SearchResults, Track } from '@music/types';
import { API_BASE_URL } from '@music/config';

export interface MusicApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class MusicApiError extends Error {}

export function createMusicApiClient(options: MusicApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? API_BASE_URL;
  const doFetch = options.fetchImpl ?? fetch;

  async function request<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, { headers: { Accept: 'application/json' } });
    } catch (err) {
      throw new MusicApiError(`Could not reach @music/api at ${baseUrl}: ${(err as Error).message}`);
    }
    const body = (await res.json()) as ApiResult<T>;
    if (!body.ok) throw new MusicApiError(body.error);
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
  };
}

export type MusicApiClient = ReturnType<typeof createMusicApiClient>;
export type { Track, Album, Artist, SearchResults, ArtistProfile };
