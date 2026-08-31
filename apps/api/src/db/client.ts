// apps/api/src/db/client.ts
//
// Two drivers, one schema (schema.ts). Which one you get is decided
// entirely by whether DATABASE_URL is set:
//
//   - unset  -> PGlite: a real Postgres compiled to WASM, persisted to a
//     local file under apps/api/data/. No server, no Docker, no account —
//     `pnpm dev:api` just works, same as SQLite would, but it IS Postgres.
//   - set    -> node-postgres against a real server (Neon, Supabase, your
//     own box). Point it at Neon's connection string in production and
//     nothing else in this file, or in schema.ts, or in any route,
//     changes.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PGLITE_DATA_DIR = path.join(__dirname, '..', '..', 'data', 'pglite');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  // PGlite's own directory creation is non-recursive and throws ENOENT if
  // even the parent (apps/api/data/) doesn't exist yet — this repo has no
  // data/ folder until the first run.
  mkdirSync(PGLITE_DATA_DIR, { recursive: true });
}

// eslint-disable-next-line no-console
console.log(databaseUrl ? '@music/api: using Postgres via DATABASE_URL' : `@music/api: using embedded PGlite at ${PGLITE_DATA_DIR}`);

export const db = databaseUrl
  ? drizzlePg(new Pool({ connectionString: databaseUrl }), { schema })
  : drizzlePglite(new PGlite(PGLITE_DATA_DIR), { schema });

// Both drivers expose this same shape, so route code and lib/auth.ts never
// need to know which one is live underneath.
export type Db = typeof db;
