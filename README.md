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
        (cache + Postgres           │
         via Drizzle;         iTunes Search API
        PGlite dev / Neon      + Apple charts feed
         etc. in prod)         (Spotify/etc. later)
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

## Database & accounts

`apps/api` now persists users/sessions through Drizzle over Postgres. Which
Postgres you get is decided entirely by `DATABASE_URL`:

```bash
# Local dev — do nothing. First `pnpm dev:api` run creates
# apps/api/data/pglite/ (an embedded, file-backed Postgres — PGlite),
# migrated automatically the first time you run:
pnpm --filter @music/api db:migrate

# Production — point at a real Postgres and run the same migration:
DATABASE_URL=postgres://user:pass@host/db pnpm --filter @music/api db:migrate
```

Same `apps/api/src/db/schema.ts` either way — see that file and
`apps/api/src/db/client.ts` for the full explanation. Changing the schema:
`pnpm --filter @music/api db:generate` writes a new SQL file to
`apps/api/drizzle/`, then run `db:migrate` again to apply it.

Auth is `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/me` on
`apps/api` (`apps/api/src/routes/auth.ts`) — email + password only for now,
session cookie based (httpOnly, 30-day expiry). `apps/web` reaches these
through `@music/api-client`'s `signup`/`login`/`logout`/`me` methods.
Cross-origin cookies mean CORS can no longer use a wildcard origin once
this is live — set `WEB_ORIGIN` in `apps/api/.env` if `apps/web` isn't on
its default dev port.

Also added: `POST /me/listening-events` (fire-and-forget, called from
`MusicPlayer.tsx` the moment a track actually starts) and `GET
/me/listening-events` (feeds `packages/domain`'s `pickRecommendationSeed`
on the home page — real listening history now, not the cold-start random
pick, once a signed-in user has played anything). `PATCH /me` updates
`displayName` and/or password (`apps/web`'s `/account` page).

## Deploying

Three moving pieces: a Postgres database (Supabase), and two long-running
Node services (`apps/api`, `apps/web`) — neither is a static site or a
serverless function, both need a host that keeps a process running.
`render.yaml` at the repo root is a ready-made
[Render Blueprint](https://render.com/docs/infrastructure-as-code) for
exactly that, with a genuinely free tier for a low-traffic/demo project
(the tradeoff: a free service spins down after 15 min idle, so the first
request after a quiet stretch takes ~30-50s to wake back up — fine for a
personal project, not for something latency-sensitive).

**1. Database — Supabase**

Create a project at [supabase.com](https://supabase.com) (free tier). Once
it's up: **Connect → Session pooler**, not "Direct connection" — Supabase's
direct connection resolves to an IPv6-only address by default, which most
PaaS hosts (including Render) can't reach outbound, so it'll fail with
"connection refused"/"no route to host" if you use it. The Session pooler
string is IPv4-compatible and, unlike the Transaction pooler, supports the
persistent connections and prepared statements this app's `pg.Pool` uses —
it looks like:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Run the migration against it once, from your own machine:

```bash
DATABASE_URL="postgres://...pooler.supabase.com:5432/postgres" pnpm --filter @music/api db:migrate
```

**2. Push to GitHub**, then in Render: **New → Blueprint**, pick the repo.
Render reads `render.yaml` and proposes both services
(`music-api`, `music-web`). Before clicking deploy, you'll be prompted for
the `sync: false` env vars — for the first pass, set:

- `music-api`'s `DATABASE_URL` → the Supabase Session pooler string above
- `music-api`'s `WEB_ORIGIN` → leave as a placeholder for now (e.g. `https://music-web.onrender.com` — Render names services `<name>.onrender.com` when that subdomain is free, matching the blueprint's `name:` field)
- `music-web`'s `PUBLIC_API_BASE_URL` → same idea: `https://music-api.onrender.com`

**3. After both deploy once**, open each service's page on Render and
confirm its real public URL under the service name at the top. If either
guessed URL above didn't match, go back to Environment on the *other*
service and correct it:

- `music-api`'s `WEB_ORIGIN` must exactly equal `music-web`'s real URL (scheme + host, no trailing slash) — CORS matches it literally.
- `music-web`'s `PUBLIC_API_BASE_URL` must equal `music-api`'s real URL — this one's baked into the browser bundle at build time, so changing it triggers (and needs) a redeploy of `music-web`, not just a restart.

Once both agree, sign up on the live site and confirm login/logout and
search actually work end-to-end — that exercises the full chain (browser
→ `music-web` → `music-api` → Supabase, plus the CORS+cookie path) in one
go.

## Known limitations (carried over / new)

- iTunes previews are 30 seconds only — an API limitation, not this app's.
- Genre pages resolve a curated search term per genre
  (`apps/api/src/lib/genres.ts`) since iTunes has no real "browse by genre"
  route.
- "Trending" / "New releases" now hit Apple's real Marketing Tools charts
  feed (`rss.marketingtools.apple.com`), not a search-term stand-in — see
  `fetchTopSongs`/`fetchTopAlbums` in `apps/api/src/lib/itunes-provider.ts`.
  That feed doesn't return `artistId`, preview URL, or track duration, so
  chart-sourced tracks/albums render without an artist link or a play
  button. `apps/web`'s `AlbumCard` renders as a static (non-link) card
  when `artistId` is empty rather than pointing at a broken `/artist/`
  route.
- The in-memory cache and rate-limiter in `apps/api` are per-process — fine
  for one API instance, not for horizontal scaling. That's the
  Redis-shaped seam mentioned above.
- Accounts exist now (email + password, `apps/api/src/routes/auth.ts`),
  backed by Drizzle over an embedded PGlite database in dev (zero setup —
  see `apps/api/src/db/client.ts`) or real Postgres in production via
  `DATABASE_URL` (Supabase, Neon, etc. — same schema, no code changes).
  `packages/domain`'s recommendation logic now reads real
  `listening_events` rows (via `GET /me/listening-events`) once a
  signed-in user has played anything; it only falls back to the
  cold-start random pick for a brand-new account with no plays yet.
- This sandbox's outbound network only allowlists npm/GitHub-type domains,
  so I could verify the whole request chain (`web → api → cache → iTunes`)
  end-to-end, but iTunes itself returns nothing here — every route still
  responded correctly with empty-but-valid data instead of erroring. Run
  it somewhere with normal internet access and real results will show up.
  The `/auth` routes, by contrast, were tested for real against the local
  PGlite database (signup, login, logout, wrong-password, duplicate-email,
  weak-password, and CORS/cookie behavior all verified end-to-end).
