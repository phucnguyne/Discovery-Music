<div align="center">

# 🎵 Discovery Music

**A full-stack music discovery app for exploring songs, albums, artists, and
genres — with previews, favorites, playlists, and recommendations.**

[![Astro](https://img.shields.io/badge/Astro-7-BC52EE?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Hono](https://img.shields.io/badge/Hono-4-E36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev)
[![pnpm](https://img.shields.io/badge/pnpm-11-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-compatible-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)

[Getting Started](#-getting-started) · [API Reference](#-api-reference) · [Deployment](#-deployment)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔎 **Music search** | Search songs, albums, and artists with live suggestions and a full results page |
| ➕ **Load more** | Load 10 additional songs at a time on the search results page |
| 📈 **Charts** | Browse trending songs and new releases from Apple’s charts feed |
| 🎸 **Genres** | Explore curated song and album results across 10 genres |
| 👤 **Artist profiles** | View artist details, top tracks, and albums |
| 💿 **Album tracklists** | Open an album to browse its tracks and available previews |
| ▶️ **Music player** | Play 30-second previews and keep playback while navigating |
| ❤️ **Favorites** | Save songs to a personal favorites library |
| 📂 **Playlists** | Create playlists and add or remove songs |
| 🕘 **Listening history** | View recently played songs and use listening history for recommendations |
| 🔐 **Accounts** | Sign up, log in, manage account details, and use secure session cookies |
| ♿ **Accessible UI** | Keyboard focus styles, skip link, accessible controls, and screen-reader status messages |
| 🔒 **API protections** | Input validation, rate limiting, security headers, origin checks, and request-size limits |

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────┐
│                  Browser / Web client                     │
│             Astro SSR pages + React islands               │
└────────────────────────────┬──────────────────────────────┘
                             │ HTTPS / JSON / session cookies
┌────────────────────────────▼──────────────────────────────┐
│                   @music/api-client                       │
│               Shared typed API interface                  │
└────────────────────────────┬──────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────┐
│                   @music/api (Hono)                       │
│  Auth · Catalog · Favorites · Playlists · Listening history│
└─────────────┬───────────────────────────────┬─────────────┘
              │                               │
┌─────────────▼──────────────┐  ┌─────────────▼─────────────┐
│ Drizzle ORM + PostgreSQL   │  │ In-process cache and      │
│ PGlite for local development│  │ rate limiter              │
└────────────────────────────┘  └─────────────┬─────────────┘
                                               │
                                  ┌────────────▼─────────────┐
                                  │ iTunes Search API and    │
                                  │ Apple charts feed        │
                                  └──────────────────────────┘
```

The API owns the external music-provider integration and maps its responses
to shared `@music/types`. The web app calls the API through the shared typed
client rather than calling iTunes directly. Shared packages also contain
validation schemas and recommendation logic.

The monorepo is structured so another client, such as a future mobile app,
can reuse the shared API client, types, validation, and domain packages.
There is no mobile application in this repository yet.

---

## 🛠️ Tech Stack

### Frontend

| Tool | Purpose |
|------|---------|
| Astro 7 | Server-rendered pages and application shell |
| React 19 | Interactive islands such as search and music playback |
| TypeScript | Type-safe UI and client code |
| CSS | Shared design tokens, responsive layouts, and component styles |
| Astro Transitions | Client-side navigation while preserving persistent player islands |

### Backend

| Tool | Purpose |
|------|---------|
| Hono | HTTP API and middleware |
| Drizzle ORM | Database access and schema management |
| PGlite | Embedded PostgreSQL for local development |
| PostgreSQL | Production database option, including Supabase or Neon |
| Zod | Shared request validation |
| Node.js crypto | Password hashing and token utilities |

### Monorepo and data

| Tool | Purpose |
|------|---------|
| pnpm workspaces | Package and app management |
| Turborepo | Workspace dev, build, and typecheck tasks |
| iTunes Search API | Song, album, and artist catalog search |
| Apple charts feed | Trending songs and new releases |

---

## 📁 Project Structure

```
music-discovery-monorepo/
├── apps/
│   ├── api/                         # Hono API
│   │   ├── src/
│   │   │   ├── db/                  # Drizzle schema, client, migrations
│   │   │   ├── lib/                 # Auth, cache, providers, rate limiting
│   │   │   ├── routes/              # Auth, catalog, and user routes
│   │   │   └── index.ts             # Middleware and server entry point
│   │   └── drizzle/                 # SQL migrations
│   └── web/                         # Astro + React frontend
│       └── src/
│           ├── components/          # Astro components and React islands
│           ├── layouts/             # Shared page layout and metadata
│           ├── lib/                 # API client and browser helpers
│           ├── pages/               # Home, search, genre, artist, album, account
│           └── styles/              # Global styles and design tokens
├── packages/
│   ├── api-client/                  # Typed client for @music/api
│   ├── config/                      # Shared ports, origins, and cache TTLs
│   ├── domain/                      # Recommendation and domain logic
│   ├── types/                       # Shared TypeScript types
│   └── validation/                  # Shared Zod schemas
├── render.yaml                      # Render Blueprint for web and API
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## 🎼 Music Data

The app uses public Apple music catalog endpoints and does not require an API
key for local development.

| Provider | Used for | Notes |
|----------|----------|-------|
| **iTunes Search API** | Search, artist and album lookups, genre results | Catalog entries may not have a preview |
| **Apple charts feed** | Trending songs and new releases | Some chart items do not include preview or artist identifiers |

Song previews are limited to 30 seconds. Genre pages use curated search terms
because the iTunes Search API does not provide a dedicated genre-browse
endpoint.

---

## 🚀 Getting Started

### Requirements

- Node.js `>=22.12.0`
- pnpm `11.24.0` (the version declared in `package.json`)

Enable pnpm through Corepack if it is not already available:

```bash
corepack enable
corepack prepare pnpm@11.24.0 --activate
```

### Install and configure

```bash
git clone https://github.com/phucnguyne/Discovery-Music.git
cd Discovery-Music
pnpm install
```

Create `apps/api/.env` with a JWT secret and the local web origin:

```dotenv
JWT_SECRET=replace-with-a-long-random-secret
WEB_ORIGIN=http://localhost:4321
```

For example, generate a secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

By default the API creates a local, file-backed PGlite database under
`apps/api/data/`. No database server or Docker setup is needed. To use a
PostgreSQL server instead, add its connection string:

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/database
```

Apply the database migrations before starting the API:

```bash
pnpm --filter @music/api db:migrate
```

Create `apps/web/.env` (or copy `apps/web/.env.example`) and set the API URL:

```dotenv
PUBLIC_API_BASE_URL=http://localhost:4322
# Optional: public website origin for canonical and Open Graph URLs
# PUBLIC_SITE_URL=https://music.example.com
```

### Start the application

Run both apps together:

```bash
pnpm dev
```

Or run each app in a separate terminal:

```bash
pnpm dev:api
pnpm dev:web
```

Open [http://localhost:4321](http://localhost:4321). The API listens on
[http://localhost:4322](http://localhost:4322) by default. Run the migration
command once when setting up a new local database.

### Build and typecheck

```bash
pnpm typecheck
pnpm build
```

---

## 📡 API Reference

The API is served by `apps/api`. Routes return JSON using the shape
`{ "ok": true, "data": ... }` for success and
`{ "ok": false, "error": "..." }` for errors.

### Catalog

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Health check |
| GET | `/catalog/search?q=...` | Search songs, albums, and artists |
| GET | `/catalog/search/tracks?q=...&offset=10` | Retrieve a 10-song page for “load more” |
| GET | `/catalog/charts/trending?country=us` | Trending songs |
| GET | `/catalog/charts/new-releases?country=us` | New-release albums |
| GET | `/catalog/genres/:slug` | Songs and albums for a known genre |
| GET | `/catalog/artists/:id` | Artist profile, albums, and top tracks |
| GET | `/catalog/artists/:id/tracks?offset=10` | Retrieve the next 10 artist tracks |
| GET | `/catalog/albums/:id` | Album details and tracklist |

Search requests are rate-limited. The tracks paging endpoint accepts
non-negative offsets in increments of 10; the upstream catalog limits the
maximum number of results.

Artist pages initially show 10 tracks and load additional tracks in batches
of 10. Artist album lookup requests up to 200 albums, the maximum requested
from the iTunes Lookup API.

Selecting an album on an artist page opens the local album detail page,
which retrieves and displays that album’s tracks (up to 200) with available
preview and library controls.

### Authentication

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/auth/signup` | Create an account and start a session |
| POST | `/auth/login` | Log in |
| POST | `/auth/logout` | Revoke the refresh token and clear cookies |
| POST | `/auth/refresh` | Issue a new access token |
| GET | `/auth/me` | Get the current user |

Authentication uses HTTP-only cookies. In production, configure `WEB_ORIGIN`
to the exact public origin of the web app so credentialed CORS requests are
allowed.

### User library (`/me`)

These routes require an authenticated session unless noted by the client:

| Method | Route | Description |
|--------|-------|-------------|
| PATCH | `/me` | Update display name or password |
| POST | `/me/listening-events` | Record a play for listening history |
| GET | `/me/listening-events?limit=50` | Get recent listening events |
| GET | `/me/recently-played?limit=30` | Get recently played songs |
| GET | `/me/favorites` | List favorite songs |
| POST | `/me/favorites` | Add a song to favorites |
| POST | `/me/favorites/check` | Check which songs are favorites |
| DELETE | `/me/favorites/:trackId` | Remove a favorite |
| GET | `/me/playlists` | List playlists |
| POST | `/me/playlists` | Create a playlist |
| GET | `/me/playlists/:id` | Get playlist details and tracks |
| DELETE | `/me/playlists/:id` | Delete a playlist |
| POST | `/me/playlists/:id/tracks` | Add a song to a playlist |
| DELETE | `/me/playlists/:id/tracks/:trackId` | Remove a song from a playlist |

---

## 🧪 Validation

The repository currently provides workspace typechecking and production
build commands:

```bash
pnpm typecheck
pnpm build
```

`pnpm typecheck` runs TypeScript checks for the API and Astro diagnostics for
the web app. `pnpm build` builds the API and web app through Turborepo.

---

## 🚢 Deployment

The repository includes a [Render Blueprint](render.yaml) that defines two
web services: `music-api` and `music-web`. A PostgreSQL database must also be
configured for production accounts and user data.

1. Create a PostgreSQL database with a provider such as Supabase or Neon.
2. Apply the migrations against the production database:

   ```bash
   DATABASE_URL="postgresql://..." pnpm --filter @music/api db:migrate
   ```

3. Deploy the repository through **New → Blueprint** in Render.
4. Configure `music-api` with:
   - `DATABASE_URL` — the PostgreSQL connection string.
   - `JWT_SECRET` — generate a strong secret; Render can generate one.
   - `WEB_ORIGIN` — the public origin of `music-web`, with scheme and host,
     and no trailing slash.
5. Configure `music-web` with:
   - `PUBLIC_API_BASE_URL` — the public origin of `music-api`.
   - Optionally, `PUBLIC_SITE_URL` — the public origin of `music-web` for
     canonical and Open Graph metadata.
6. After the first deploy, verify the actual service URLs and update the
   origin variables if Render assigned different URLs. Redeploy the web app
   after changing `PUBLIC_API_BASE_URL`, since it is included in the browser
   bundle at build time.

The API binds to `PORT` when provided by the host, otherwise to `API_PORT` or
port `4322`. The web service should bind to `0.0.0.0` in hosted environments.

---

## ⚠️ Known Limitations

- The in-process API cache and rate limiter are per instance. Multi-instance
  deployments should move them to shared infrastructure such as Redis.
- iTunes results and Apple charts may omit preview URLs, artist IDs, or other
  metadata; the UI handles these fields as optional.
- Previews are 30-second clips, subject to Apple’s catalog availability.
- Recommendations use listening history when available and a cold-start
  selection for accounts without listening events.
- The mobile app is not implemented yet.

---

## 🤝 Contributing

1. Create a branch for your change.
2. Make the change and run `pnpm typecheck` and `pnpm build`.
3. Open a pull request with a summary and validation results.

---

## 📄 License

No license file is currently included in this repository.

---

<div align="center">
  Built for discovering your next favorite song 🎧
</div>
