# Music Discovery — Monorepo

```
                    Music Discovery
                          │
              ┌───────────┴───────────┐
              │                       │
           Web App              Mobile App
            Astro               (not built yet —
              │                  see note below)
       React Islands
              │
              └───────────┬───────────
                          │
                     Shared API
                    (@music/api)
                          │
                  ┌───────┴────────┐
                  │                │
              Backend          External APIs
           (in-memory cache        │
            today, Redis      iTunes Search API
              later)           (Spotify/etc. later)
```

**Mobile/Expo is intentionally not built yet.** Everything below is scoped
to `apps/web` + `apps/api` + the shared `packages/*`, structured so an
`apps/mobile` (Expo) can be dropped in later and reuse `packages/types`,
`packages/api-client`, `packages/validation`, and `packages/domain` as-is —
per the "don't share UI, do share types/client/domain logic" split.

## Structure

```
music-discovery/
├── apps/
│   ├── web/              # Astro + React islands (see apps/web/README.md)
│   └── api/               # Hono backend — owns the iTunes integration
│
├── packages/
│   ├── types/              # Track, Album, Artist, Genre, ApiResult<T>
│   ├── validation/         # Zod schemas (search query, artist id, genre slug)
│   ├── api-client/         # Typed client apps/web (and later apps/mobile) call
│   ├── domain/             # Non-ML "because you listened to X" logic
│   └── config/              # Shared ports / base URLs / cache TTLs
│
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Why a backend now, not just apps/web hitting iTunes directly

The previous version of this project had `apps/web` calling
`itunes.apple.com` straight from Astro frontmatter and from the browser.
That doesn't scale to a second client. Now:

- **`apps/api`** is the only thing that knows iTunes' response shape
  (`apps/api/src/lib/itunes-provider.ts`). It maps iTunes' fields onto
  `@music/types`, so swapping or adding a provider later (Spotify, Apple
  Music API, etc.) means editing one file, not every consumer.
- It caches upstream calls in-process (`apps/api/src/lib/cache.ts` — a
  documented stand-in for Redis, same `get/set(ttl)` shape so swapping it
  in later doesn't touch call sites).
- **`apps/web`** never imports anything iTunes-shaped anymore. It only
  imports `@music/api-client`, which only knows about `@music/api`.
- A future **`apps/mobile`** would import the exact same `@music/api-client`
  and `@music/types` — zero new integration code, by design.

## Run it

```bash
pnpm install

# both apps, via turbo
pnpm dev

# or individually
pnpm dev:api   # http://localhost:4322
pnpm dev:web   # http://localhost:4321, reads PUBLIC_API_BASE_URL
```

`apps/web` needs `apps/web/.env` (copy `.env.example`) pointing
`PUBLIC_API_BASE_URL` at the API — defaults to `http://localhost:4322` if
you don't set it, so a plain `pnpm dev` works out of the box.

```bash
pnpm build   # builds every package/app in dependency order via turbo
```

## Known limitations (carried over / new)

- iTunes previews are 30 seconds only — an API limitation, not this app's.
- Genre pages resolve a curated search term per genre
  (`apps/api/src/lib/genres.ts`) since iTunes has no real "browse by genre"
  route. "Trending" / "New releases" are representative search terms too,
  not a true charts API — swap the provider file when you have a real one.
- The in-memory cache in `apps/api` is per-process — fine for one API
  instance, not for horizontal scaling. That's the Redis-shaped seam
  mentioned above.
- No auth/accounts yet, so `packages/domain`'s recommendation logic always
  hits its cold-start path (random genre). It's already wired to rank a
  real `ListeningEvent[]` history once accounts exist — see
  `packages/domain/src/index.ts`.
- This sandbox's outbound network only allowlists npm/GitHub-type domains,
  so I could verify the whole request chain (`web → api → cache → iTunes`)
  end-to-end, but iTunes itself returns nothing here — every route still
  responded correctly with empty-but-valid data instead of erroring. Run
  it somewhere with normal internet access and real results will show up.
