// src/lib/add-to-playlist-button.client.ts
// Loaded once from Layout.astro. Same "static button, no own state"
// pattern as playing-indicator.client.ts — this button doesn't know how
// to fetch/show the user's playlists (that needs real state), it just
// announces the request; <AddToPlaylistMenu/> (mounted once, globally,
// in Layout.astro) is the only thing listening.
import { dispatchAddToPlaylistRequest } from './events';

document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement)?.closest<HTMLButtonElement>('[data-add-to-playlist-button]');
  if (!btn) return;

  dispatchAddToPlaylistRequest({
    id: btn.dataset.trackId ?? '',
    title: btn.dataset.title ?? '',
    artist: btn.dataset.artist ?? '',
    artistId: btn.dataset.artistId ?? '',
    album: btn.dataset.album || undefined,
    artwork: btn.dataset.artwork ?? '',
    previewUrl: btn.dataset.preview || undefined,
    durationMs: btn.dataset.duration ? Number(btn.dataset.duration) : undefined,
    genre: btn.dataset.genre || undefined,
  });
});