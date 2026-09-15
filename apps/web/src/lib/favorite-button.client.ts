// src/lib/favorite-button.client.ts
// Loaded once from Layout.astro, same pattern as playing-indicator.client.
import { api } from './api';
import { MusicApiError } from '@music/api-client';

// Runs after every Astro view transition ('astro:page-load' fires once on
// the initial load too), since each navigation renders a fresh batch of
// [data-favorite-button] elements that haven't been checked yet — one
// request covers every track visible on the page instead of one per track.
document.addEventListener('astro:page-load', () => {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-favorite-button]');
  const trackIds = [...new Set([...buttons].map((b) => b.dataset.trackId).filter((id): id is string => Boolean(id)))];
  if (trackIds.length === 0) return;

  api.checkFavorites(trackIds).then((favoritedIds) => {
    const favoritedSet = new Set(favoritedIds);
    buttons.forEach((btn) => {
      if (btn.dataset.trackId && favoritedSet.has(btn.dataset.trackId)) {
        btn.setAttribute('aria-pressed', 'true');
      }
    });
  });
});

// Delegated click handler — survives navigations the same way the play
// button's does (see playing-indicator.client.ts), since `document` itself
// is never replaced by Astro's view transitions.
document.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement)?.closest<HTMLButtonElement>('[data-favorite-button]');
  if (!btn) return;

  const trackId = btn.dataset.trackId;
  if (!trackId) return;

  const wasFavorited = btn.getAttribute('aria-pressed') === 'true';
  // Optimistic: flip immediately, revert only if the request fails — a
  // heart toggle should feel instant, not wait on a round trip.
  btn.setAttribute('aria-pressed', String(!wasFavorited));

  try {
    if (wasFavorited) {
      await api.removeFavorite(trackId);
    } else {
      await api.addFavorite({
        id: trackId,
        title: btn.dataset.title ?? '',
        artistId: btn.dataset.artistId ?? '',
        artistName: btn.dataset.artist ?? '',
        albumTitle: btn.dataset.album || undefined,
        coverUrl: btn.dataset.artwork ?? '',
        previewUrl: btn.dataset.preview || undefined,
        durationMs: btn.dataset.duration ? Number(btn.dataset.duration) : undefined,
        genre: btn.dataset.genre || undefined,
      });
    }
  } catch (err) {
    btn.setAttribute('aria-pressed', String(wasFavorited)); // revert on failure
    if (err instanceof MusicApiError && err.status === 401) {
      window.location.href = '/login';
    }
  }
});