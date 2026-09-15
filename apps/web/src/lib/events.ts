// src/lib/events.ts
//
// Static .astro islands (AlbumCard, TrackRow, Hero…) have no state of their
// own. When someone clicks "play" on a plain HTML button, the card dispatches
// a CustomEvent on `window`. The single React <MusicPlayer /> island — kept
// alive across page navigations via transition:persist — is the only piece
// of the page that listens for it. This is the "islands talk through the
// window, not through props" pattern.

export const PLAY_TRACK_EVENT = 'musicdisco:play-track';
export const PLAY_STATE_EVENT = 'musicdisco:play-state';

export interface PlayTrackDetail {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artwork: string;
  previewUrl: string;
  durationMs?: number;
  /** Only used to record a listening event once playback actually starts
   * (see MusicPlayer.tsx's loadTrack) — never rendered. Optional because
   * chart-sourced tracks can have an empty artistId (see itunes-provider's
   * chart mapping); those just don't get recorded. */
  artistId?: string;
  genre?: string;
  /** The rest of the current list, so next/prev in the player has somewhere to go. */
  queue?: PlayTrackDetail[];
  queueIndex?: number;
}

export function dispatchPlayTrack(detail: PlayTrackDetail) {
  window.dispatchEvent(new CustomEvent<PlayTrackDetail>(PLAY_TRACK_EVENT, { detail }));
}

// Same "islands talk through window" pattern as above, but for the "+"
// button on a track: it doesn't know how to render a playlist picker
// itself (that needs to fetch the user's playlists, so it needs real
// state) — it just announces "someone wants to add this track somewhere",
// and the single global <AddToPlaylistMenu/> island (mounted once in
// Layout.astro) opens and does the rest.
export const ADD_TO_PLAYLIST_EVENT = 'musicdisco:add-to-playlist-request';

export interface AddToPlaylistDetail {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album?: string;
  artwork: string;
  previewUrl?: string;
  durationMs?: number;
  genre?: string;
}

export function dispatchAddToPlaylistRequest(detail: AddToPlaylistDetail) {
  window.dispatchEvent(new CustomEvent<AddToPlaylistDetail>(ADD_TO_PLAYLIST_EVENT, { detail }));
}