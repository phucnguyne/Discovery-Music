// src/lib/playing-indicator.client.ts
// Loaded once from Layout.astro. Every static island that renders a
// [data-vinyl][data-track-id] element (VinylArt, TrackRow) gets its
// .is-playing class toggled here, driven purely by the PLAY_TRACK_EVENT
// broadcast — no framework, no props drilling.
import { PLAY_TRACK_EVENT, type PlayTrackDetail, dispatchPlayTrack } from './events';

window.addEventListener(PLAY_TRACK_EVENT, ((e: CustomEvent<PlayTrackDetail>) => {
  const playingId = String(e.detail.id);
  document.querySelectorAll<HTMLElement>('[data-vinyl]').forEach((el) => {
    const mine = el.dataset.trackId;
    el.classList.toggle('is-playing', !!mine && mine === playingId);
  });
}) as EventListener);

// Any plain HTML [data-play-button] anywhere on the page (AlbumCard, Hero,
// TrackRow…) dispatches a play event through this single delegated listener
// — static islands never need their own JS bundle for this.
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement)?.closest<HTMLButtonElement>('[data-play-button]');
  if (!btn) return;
  dispatchPlayTrack({
    id: btn.dataset.trackId ?? '',
    title: btn.dataset.title ?? '',
    artist: btn.dataset.artist ?? '',
    album: btn.dataset.album || undefined,
    artwork: btn.dataset.artwork ?? '',
    previewUrl: btn.dataset.preview ?? '',
    durationMs: btn.dataset.duration ? Number(btn.dataset.duration) : undefined,
  });
});
