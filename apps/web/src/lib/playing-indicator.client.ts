// src/lib/playing-indicator.client.ts
// Loaded once from Layout.astro. Every static island that renders a
// [data-vinyl][data-track-id] element (VinylArt, TrackRow) gets its
// .is-playing class toggled here, driven purely by the PLAY_TRACK_EVENT
// broadcast — no framework, no props drilling.
import { PLAY_TRACK_EVENT, type PlayTrackDetail, dispatchPlayTrack } from './events';

let currentPlayingId: string | null = null;
let currentIsPlaying = false;

function syncVinyls() {
  document.querySelectorAll<HTMLElement>('[data-vinyl]').forEach((el) => {
    const mine = el.dataset.trackId;
    el.classList.toggle('is-playing', !!mine && mine === currentPlayingId && currentIsPlaying);
  });
}

// Fired when the React player changes track or toggles play/pause.
window.addEventListener('musicdisco:play-state', ((e: CustomEvent<{ id: string; isPlaying: boolean }>) => {
  currentPlayingId = e.detail.id;
  currentIsPlaying = e.detail.isPlaying;
  syncVinyls();
}) as EventListener);

// Also sync immediately when Play is clicked (for responsiveness before React loads)
window.addEventListener(PLAY_TRACK_EVENT, ((e: CustomEvent<PlayTrackDetail>) => {
  currentPlayingId = String(e.detail.id);
  currentIsPlaying = true;
  syncVinyls();
}) as EventListener);

// When Astro swaps the DOM during a client-side navigation, new [data-vinyl]
// elements won't have the .is-playing class. Sync them immediately.
document.addEventListener('astro:page-load', () => {
  syncVinyls();
});

// Any plain HTML [data-play-button] anywhere on the page (AlbumCard, Hero,
// TrackRow…) dispatches a play event through this single delegated listener
// — static islands never need their own JS bundle for this.
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement)?.closest<HTMLButtonElement>('[data-play-button]');
  if (!btn) return;

  // Build a queue from sibling play buttons within the same track-list so
  // the player's next/prev buttons are enabled (they require queue.length ≥ 2).
  const trackList = btn.closest('.track-list');
  let queue: import('./events').PlayTrackDetail[] | undefined;
  let queueIndex: number | undefined;

  if (trackList) {
    const allButtons = Array.from(trackList.querySelectorAll<HTMLButtonElement>('[data-play-button]'));
    queue = allButtons.map((b) => ({
      id: b.dataset.trackId ?? '',
      title: b.dataset.title ?? '',
      artist: b.dataset.artist ?? '',
      album: b.dataset.album || undefined,
      artwork: b.dataset.artwork ?? '',
      previewUrl: b.dataset.preview ?? '',
      durationMs: b.dataset.duration ? Number(b.dataset.duration) : undefined,
      artistId: b.dataset.artistId || undefined,
      genre: b.dataset.genre || undefined,
    }));
    queueIndex = allButtons.indexOf(btn);
  }

  dispatchPlayTrack({
    id: btn.dataset.trackId ?? '',
    title: btn.dataset.title ?? '',
    artist: btn.dataset.artist ?? '',
    album: btn.dataset.album || undefined,
    artwork: btn.dataset.artwork ?? '',
    previewUrl: btn.dataset.preview ?? '',
    durationMs: btn.dataset.duration ? Number(btn.dataset.duration) : undefined,
    artistId: btn.dataset.artistId || undefined,
    genre: btn.dataset.genre || undefined,
    queue,
    queueIndex,
  });
});
