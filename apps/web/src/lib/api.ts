// apps/web/src/lib/api.ts
//
// The only place apps/web knows about @music/api's URL. Astro/Vite expose
// PUBLIC_-prefixed env vars to both server code and browser bundles, so
// this same file works from .astro frontmatter and from React islands.
import { createMusicApiClient } from '@music/api-client';

const baseUrl = import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:4322';

export const api = createMusicApiClient({ baseUrl });
