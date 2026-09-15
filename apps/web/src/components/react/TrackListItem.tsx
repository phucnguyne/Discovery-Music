import { useState } from 'react';
import { api } from '../../lib/api';
import { MusicApiError } from '@music/api-client';
import { dispatchAddToPlaylistRequest } from '../../lib/events';
import { formatDuration } from '../../lib/format';
import type { Track } from '@music/types';

interface Props {
  track: Track;
  index?: number;
  initialFavorited?: boolean;
  /** Replaces the duration column — e.g. a relative "2h ago" timestamp
   * for Recently played, where the duration is less interesting than when. */
  metaOverride?: string;
  onRemove?: () => void;
  removeLabel?: string;
  /** Fires after a favorite toggle actually succeeds (not on optimistic
   * flip, not on revert-after-failure) — lets a page like /favorites drop
   * a track from its own list the moment it's genuinely unfavorited. */
  onFavoriteChange?: (favorited: boolean) => void;
}

export default function TrackListItem({
  track,
  index,
  initialFavorited,
  metaOverride,
  onRemove,
  removeLabel,
  onFavoriteChange,
}: Props) {
  const [favorited, setFavorited] = useState(Boolean(initialFavorited));
  const playable = Boolean(track.previewUrl);

  async function handleToggleFavorite() {
    const next = !favorited;
    setFavorited(next); // optimistic
    try {
      if (next) await api.addFavorite(track);
      else await api.removeFavorite(track.id);
      onFavoriteChange?.(next);
    } catch (err) {
      setFavorited(!next); // revert
      if (err instanceof MusicApiError && err.status === 401) window.location.href = '/login';
    }
  }

  function handleAddToPlaylist() {
    dispatchAddToPlaylistRequest({
      id: track.id,
      title: track.title,
      artist: track.artistName,
      artistId: track.artistId,
      album: track.albumTitle,
      artwork: track.coverUrl,
      previewUrl: track.previewUrl,
      durationMs: track.durationMs,
      genre: track.genre,
    });
  }

  return (
    <div className="tli" data-vinyl data-track-id={track.id}>
      {typeof index === 'number' && <span className="tli__index">{String(index).padStart(2, '0')}</span>}
      <img className="tli__art" src={track.coverUrl} alt="" width={44} height={44} loading="lazy" />
      <div className="tli__meta">
        <p className="tli__title">{track.title}</p>
        <p className="tli__artist">{track.artistName}</p>
      </div>
      <span className="tli__duration">{metaOverride ?? formatDuration(track.durationMs)}</span>

      <button type="button" className="tli__icon" onClick={handleAddToPlaylist} aria-label={`Add ${track.title} to a playlist`}>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <button
        type="button"
        className="tli__icon tli__heart"
        aria-pressed={favorited}
        aria-label={`Favorite ${track.title}`}
        onClick={handleToggleFavorite}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M12 20.5s-7.5-4.7-10-9.3C.5 8 2 4.5 5.5 4 8 3.6 10 5 12 7.3 14 5 16 3.6 18.5 4 22 4.5 23.5 8 22 11.2c-2.5 4.6-10 9.3-10 9.3z"
            fill={favorited ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {playable ? (
        // Plain data-attribute button, no onClick: the global delegated
        // listener in playing-indicator.client.ts picks up ANY
        // [data-play-button] click (framework-agnostic) and auto-builds
        // a queue from sibling buttons inside the nearest .track-list —
        // exactly like TrackRow.astro's play button already does.
        <button
          type="button"
          className="tli__play"
          aria-label={`Play ${track.title}`}
          data-play-button
          data-track-id={track.id}
          data-title={track.title}
          data-artist={track.artistName}
          data-album={track.albumTitle ?? ''}
          data-artwork={track.coverUrl}
          data-preview={track.previewUrl}
          data-duration={track.durationMs ?? ''}
          data-artist-id={track.artistId}
          data-genre={track.genre ?? ''}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
          </svg>
        </button>
      ) : (
        <span className="tli__play tli__play--disabled" aria-hidden="true">
          —
        </span>
      )}

      {onRemove && (
        <button type="button" className="tli__remove" onClick={onRemove} aria-label={removeLabel ?? 'Remove'}>
          ×
        </button>
      )}

      <style>{`
        .tli {
          display: grid;
          grid-template-columns: 26px 44px 1fr auto 32px 32px 36px 30px;
          align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-m);
          transition: background 0.15s ease;
        }
        .tli:hover { background: var(--ink-soft); }
        .tli.is-playing { background: var(--ink-soft); box-shadow: var(--shadow-edge); }
        .tli.is-playing .tli__title { color: var(--amber); }
        .tli__index { font-family: var(--font-mono); font-size: 0.78rem; color: var(--ash-dim); text-align: right; }
        .tli__art { width: 44px; height: 44px; border-radius: 6px; object-fit: cover; }
        .tli__meta { min-width: 0; }
        .tli__title { font-size: 0.92rem; font-weight: 600; color: var(--paper); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tli__artist { margin-top: 2px; font-size: 0.8rem; color: var(--ash); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tli__duration { font-family: var(--font-mono); font-size: 0.78rem; color: var(--ash-dim); white-space: nowrap; }
        .tli__icon {
          width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center;
          color: var(--ash-dim); opacity: 0; transition: color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
        }
        .tli:hover .tli__icon, .tli__icon:focus-visible { opacity: 1; }
        .tli__icon:hover { color: var(--paper); background: var(--ink-raised); }
        .tli__heart[aria-pressed='true'] { opacity: 1; color: #ef4a6b; }
        .tli__play {
          width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center;
          color: var(--ash); transition: color 0.15s ease, background 0.15s ease;
        }
        .tli__play:hover { color: var(--ink); background: var(--amber); }
        .tli__play--disabled { color: var(--ash-dim); cursor: default; }
        .tli__remove {
          width: 26px; height: 26px; border-radius: 999px; display: grid; place-items: center;
          color: var(--ash-dim); font-size: 1.05rem; line-height: 1; transition: color 0.15s ease, background 0.15s ease;
        }
        .tli__remove:hover { color: var(--paper); background: var(--ink-raised); }
      `}</style>
    </div>
  );
}