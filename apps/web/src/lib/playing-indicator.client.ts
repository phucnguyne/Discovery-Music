// src/lib/playing-indicator.client.ts
// Loaded once from Layout.astro. Every static island that renders a
// [data-vinyl][data-track-id] element (VinylArt, TrackRow) gets its
// .is-playing class toggled here, driven purely by the PLAY_TRACK_EVENT
// broadcast — no framework, no props drilling.
import { PLAY_TRACK_EVENT, PLAY_STATE_EVENT, TOGGLE_PLAY_EVENT, type PlayTrackDetail, dispatchPlayTrack } from './events';

let currentPlayingId: string | null = null;
let currentIsPlaying = false;

function syncVinyls() {
  document.querySelectorAll<HTMLElement>('[data-vinyl]').forEach((el) => {
    const mine = el.dataset.trackId;
    el.classList.toggle('is-playing', !!mine && mine === currentPlayingId && currentIsPlaying);
  });
}

function syncPlayButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-play-button]').forEach((button) => {
    const isCurrentTrack = button.dataset.trackId === currentPlayingId;
    const isActive = isCurrentTrack && currentIsPlaying;
    const title = button.dataset.title ?? 'track';
    const artist = button.dataset.artist;
    const description = artist ? `${title} by ${artist}` : title;
    button.setAttribute('aria-label', `${isActive ? 'Pause' : 'Play'} ${description}`);
    button.dataset.isPlaying = String(isActive);
    const path = button.querySelector('svg path');
    if (path) path.setAttribute('d', isActive ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5.5v13l11-6.5-11-6.5z');
  });
}

// Fired when the React player changes track or toggles play/pause.
window.addEventListener(PLAY_STATE_EVENT, ((e: CustomEvent<{ id: string; isPlaying: boolean }>) => {
  currentPlayingId = e.detail.id;
  currentIsPlaying = e.detail.isPlaying;
  syncVinyls();
  syncPlayButtons();
}) as EventListener);

// Also sync immediately when Play is clicked (for responsiveness before React loads)
window.addEventListener(PLAY_TRACK_EVENT, ((e: CustomEvent<PlayTrackDetail>) => {
  currentPlayingId = String(e.detail.id);
  currentIsPlaying = true;
  syncVinyls();
  syncPlayButtons();
}) as EventListener);

// When Astro swaps the DOM during a client-side navigation, new [data-vinyl]
// elements won't have the .is-playing class. Sync them immediately.
document.addEventListener('astro:page-load', () => {
  syncVinyls();
  syncPlayButtons();
});

const playButtonObserver = new MutationObserver(() => syncPlayButtons());
playButtonObserver.observe(document.body, { childList: true, subtree: true });

// Any plain HTML [data-play-button] anywhere on the page (AlbumCard, Hero,
// TrackRow…) dispatches a play event through this single delegated listener
// — static islands never need their own JS bundle for this.
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement)?.closest<HTMLButtonElement>('[data-play-button]');
  if (!btn) return;
  if (btn.dataset.trackId === currentPlayingId) {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent(TOGGLE_PLAY_EVENT));
    return;
  }

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
