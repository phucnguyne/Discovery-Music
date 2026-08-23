# @music/web

Astro + React-islands frontend for Music Discovery. See the [root
README](../../README.md) for the full monorepo architecture.

## Islands architecture, in this app specifically

- Static `.astro` components (`AlbumCard`, `TrackRow`, `Hero`, `Sidebar`,
  `VinylArt`, `SectionHeader`) render as plain HTML — zero client JS.
- Two React islands ship JS: `components/react/MusicPlayer.tsx`
  (`client:load`, `transition:persist` — survives page navigation) and
  `components/react/SearchBar.tsx` (`client:load`).
- Static islands talk to the player through a `window` CustomEvent bus
  (`src/lib/events.ts`) instead of props — see `AlbumCard.astro`'s
  `data-play-button` attributes and `src/lib/playing-indicator.client.ts`.

## Data

This app no longer calls iTunes directly. `src/lib/api.ts` is the single
`@music/api-client` instance every page and the `SearchBar` island import.
Point it at a running `@music/api` via `PUBLIC_API_BASE_URL` in `.env`
(copy `.env.example`).

## Run it

```bash
pnpm install        # from the monorepo root
pnpm dev:api         # in one terminal
pnpm --filter @music/web dev   # in another
```
