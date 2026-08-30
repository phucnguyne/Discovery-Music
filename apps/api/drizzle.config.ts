// apps/api/drizzle.config.ts
// Used only by `drizzle-kit generate` (reads schema.ts, writes SQL diffs
// to drizzle/). It needs *a* dialect to generate correct SQL syntax, so
// it's pinned to 'postgresql' — matching schema.ts's pg-core imports —
// regardless of which driver client.ts picks at runtime.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  // Only read at generate-time for `drizzle-kit push`/`studio`, which talk
  // to a live database directly instead of just diffing schema.ts. Not
  // needed for plain `generate`.
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://placeholder/placeholder',
  },
});