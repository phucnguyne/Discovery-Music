// packages/config/src/index.ts
//
// Central place for cross-app constants. Real secrets still belong in each
// app's own .env — this is only for values every app needs to agree on.
// Guarded so importing this module never throws inside a browser bundle
// (where `process` doesn't exist) even if the value ends up unused there.
const env: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

export const API_PORT = Number(env.API_PORT ?? 4322);

export const API_BASE_URL = env.PUBLIC_API_BASE_URL ?? `http://localhost:${API_PORT}`;

// Needed once auth cookies exist: browsers refuse credentialed cross-origin
// requests against a wildcard `Access-Control-Allow-Origin`, so @music/api
// has to echo back a known, explicit origin instead of '*'.
export const WEB_ORIGIN = env.WEB_ORIGIN ?? 'http://localhost:4321';

export const CACHE_TTL_MS = {
  search: 60_000, // 1 min — user is actively typing, keep it fresh
  charts: 15 * 60_000, // 15 min — trending/new-releases move slowly
  artist: 30 * 60_000, // 30 min — artist catalogs rarely change
} as const;