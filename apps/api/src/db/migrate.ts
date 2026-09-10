// apps/api/src/db/migrate.ts
//
// `pnpm db:migrate` — applies everything in apps/api/drizzle/ (generated
// by `pnpm db:generate`) to whichever database client.ts currently points
// at. Safe to run repeatedly; Drizzle tracks what's already applied.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../lib/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, '..', '..', 'drizzle');

async function main() {
  const { db } = await import('./client.js');
  const databaseUrl = env.databaseUrl;

  if (databaseUrl) {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder });
  } else {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder });
  }

  // eslint-disable-next-line no-console
  console.log('@music/api: migrations applied');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('@music/api: migration failed', err);
  process.exit(1);
});
