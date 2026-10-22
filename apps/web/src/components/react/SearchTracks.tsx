import { useState } from 'react';
import type { Track } from '@music/types';
import { api } from '../../lib/api';
import { formatDuration, thumbSrc } from '../../lib/format';
import ArtistNames from './ArtistNames';

type Props = {
  initialTracks: Track[];
  hasMore: boolean;
  heading?: string;
} & ({ query: string; artistId?: never } | { artistId: string; query?: never });

export default function SearchTracks({
  query,
  artistId,
  initialTracks,
  hasMore: initialHasMore,
  heading = 'Songs',
}: Props) {
  const [tracks, setTracks] = useState(initialTracks);
  const [offset, setOffset] = useState(initialTracks.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const page = artistId
        ? await api.artistTracks(artistId, offset)
        : await api.searchTracks(query ?? '', offset);
      setTracks((current) => [...current, ...page.tracks]);
      setOffset((current) => current + page.tracks.length);
      setHasMore(page.hasMore && page.tracks.length > 0);
    } catch {
      setError('Could not load more songs. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section" aria-labelledby="search-tracks-heading">
      <div className="section-head">
        <h2 id="search-tracks-heading">{heading}</h2>
      </div>
      <div className="track-list" aria-busy={loading}>
        {tracks.map((track, index) => (
          <div className="track-row" data-vinyl data-track-id={track.id} key={track.id}>
            <span className="track-row__index">{String(index + 1).padStart(2, '0')}</span>
            <img
              className="track-row__art"
              src={thumbSrc(track.coverUrl)}
              alt=""
              loading="lazy"
              width={44}
              height={44}
            />
            <div className="track-row__meta">
              <p className="track-row__title">{track.title}</p>
              <ArtistNames className="track-row__artist" name={track.artistName} artistId={track.artistId} />
            </div>
            <span className="track-row__duration">{formatDuration(track.durationMs)}</span>

            <button
              className="track-row__icon-btn"
              type="button"
              aria-label={`Add ${track.title} to a playlist`}
              data-add-to-playlist-button
              data-track-id={track.id}
              data-title={track.title}
              data-artist={track.artistName}
              data-album={track.albumTitle ?? ''}
              data-artwork={track.coverUrl}
              data-preview={track.previewUrl ?? ''}
              data-duration={track.durationMs ?? ''}
              data-artist-id={track.artistId}
              data-genre={track.genre ?? ''}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <button
              className="track-row__icon-btn track-row__favorite"
              type="button"
              aria-label={`Favorite ${track.title} by ${track.artistName}`}
              aria-pressed="false"
              data-favorite-button
              data-track-id={track.id}
              data-title={track.title}
              data-artist={track.artistName}
              data-album={track.albumTitle ?? ''}
              data-artwork={track.coverUrl}
              data-preview={track.previewUrl ?? ''}
              data-duration={track.durationMs ?? ''}
              data-artist-id={track.artistId}
              data-genre={track.genre ?? ''}
            >
              <svg className="track-row__heart-outline" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  d="M12 20.5s-7.5-4.7-10-9.3C.5 8 2 4.5 5.5 4 8 3.6 10 5 12 7.3 14 5 16 3.6 18.5 4 22 4.5 23.5 8 22 11.2c-2.5 4.6-10 9.3-10 9.3z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
              <svg className="track-row__heart-filled" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  d="M12 20.5s-7.5-4.7-10-9.3C.5 8 2 4.5 5.5 4 8 3.6 10 5 12 7.3 14 5 16 3.6 18.5 4 22 4.5 23.5 8 22 11.2c-2.5 4.6-10 9.3-10 9.3z"
                  fill="currentColor"
                />
              </svg>
            </button>

            {track.previewUrl ? (
              <button
                className="track-row__play"
                type="button"
                aria-label={`Play ${track.title} by ${track.artistName}`}
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
              <span className="track-row__play track-row__play--disabled" aria-hidden="true">—</span>
            )}
          </div>
        ))}
      </div>

      {error && <p className="search-tracks__error" role="alert">{error}</p>}
      <p className="visually-hidden" role="status" aria-live="polite">
        {loading ? 'Loading more songs' : ''}
      </p>
      {hasMore && (
        <button className="search-tracks__more" type="button" onClick={loadMore} disabled={loading}>
          {loading ? 'Loading…' : `Load 10 more ${artistId ? 'tracks' : 'songs'}`}
        </button>
      )}

      <style>{`
        .track-list { display: flex; flex-direction: column; gap: 2px; }
        .track-row {
          display: grid; grid-template-columns: 26px 44px minmax(0, 1fr) auto 32px 32px 36px;
          align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-m);
          transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
        }
        .track-row:hover { background: var(--ink-soft); box-shadow: var(--shadow-edge); transform: translateY(-1px); }
        .track-row.is-playing { background: var(--ink-soft); box-shadow: var(--shadow-edge); }
        .track-row.is-playing .track-row__title { color: var(--amber); }
        .track-row__index, .track-row__duration { color: var(--ash-dim); font-family: var(--font-mono); font-size: 0.78rem; }
        .track-row__index { text-align: right; }
        .track-row__art { width: 44px; height: 44px; border-radius: 6px; object-fit: cover; }
        .track-row__meta { min-width: 0; }
        .track-row__title, .track-row__artist {
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .track-row__title { color: var(--paper); font-size: 0.92rem; font-weight: 600; }
        .track-row__artist { display: block; margin-top: 2px; color: var(--ash); font-size: 0.8rem; }
        .track-row__artist a:hover { color: var(--amber); text-decoration: underline; text-underline-offset: 3px; }
        .track-row__icon-btn, .track-row__play {
          display: grid; place-items: center; width: 32px; height: 32px; border-radius: 999px;
          color: var(--ash-dim); transition: color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
        }
        @media (hover: hover) {
          .track-row__icon-btn { opacity: 0; }
          .track-row:hover .track-row__icon-btn, .track-row__icon-btn:focus-visible { opacity: 1; }
        }
        .track-row__icon-btn:hover, .track-row__play:hover { color: var(--paper); background: var(--ink-raised); }
        .track-row__favorite[aria-pressed='true'] { opacity: 1; color: #ef4a6b; }
        .track-row__heart-filled { display: none; color: #ef4a6b; }
        .track-row__favorite[aria-pressed='true'] .track-row__heart-outline { display: none; }
        .track-row__favorite[aria-pressed='true'] .track-row__heart-filled { display: block; }
        .track-row__play { color: var(--ash); }
        .track-row__play--disabled { color: var(--ash-dim); cursor: default; }
        .search-tracks__more {
          display: block; margin: 20px auto 0; padding: 10px 20px; border: 1px solid var(--line);
          border-radius: 999px; background: var(--ink-soft); color: var(--paper); font-weight: 600;
        }
        .search-tracks__more:hover:not(:disabled) { border-color: var(--amber-dim); background: var(--ink-raised); }
        .search-tracks__more:disabled { opacity: 0.65; cursor: wait; }
        .search-tracks__error { margin-top: 14px; color: var(--danger); font-size: 0.9rem; }
        @media (max-width: 480px) {
          .track-row { grid-template-columns: 36px minmax(0, 1fr) 30px 30px 34px; gap: 8px; padding: 8px 10px; }
          .track-row__index, .track-row__duration { display: none; }
          .track-row__art { width: 36px; height: 36px; }
        }
      `}</style>
    </section>
  );
}
