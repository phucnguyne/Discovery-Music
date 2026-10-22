import { useEffect, useState } from 'react';
import { OPEN_QUEUE_EVENT, PLAY_TRACK_EVENT, type PlayTrackDetail } from '../../lib/events';
import { thumbSrc } from '../../lib/format';
import ArtistNames from './ArtistNames';
import { getDisplayArtists } from '../../lib/artist-display';

export default function NowPlayingPanel() {
  const [current, setCurrent] = useState<PlayTrackDetail | null>(null);
  const [queue, setQueue] = useState<PlayTrackDetail[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);

  useEffect(() => {
    const handler = (e: CustomEvent<PlayTrackDetail>) => {
      const detail = e.detail;
      setCurrent(detail);
      const q = detail.queue && detail.queue.length ? detail.queue : [detail];
      setQueue(q);
      setQueueIndex(typeof detail.queueIndex === 'number' ? detail.queueIndex : Math.max(q.findIndex((t) => t.id === detail.id), 0));
    };
    const openQueue = () => setQueueOpen(true);
    window.addEventListener(PLAY_TRACK_EVENT, handler as EventListener);
    window.addEventListener(OPEN_QUEUE_EVENT, openQueue);
    return () => {
      window.removeEventListener(PLAY_TRACK_EVENT, handler as EventListener);
      window.removeEventListener(OPEN_QUEUE_EVENT, openQueue);
    };
  }, []);

  useEffect(() => {
    if (!queueOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQueueOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [queueOpen]);

  const upcoming = queue.slice(queueIndex + 1);

  return (
    <aside className="now-playing-col" aria-label="Now playing">
      <div className="np">
        <p className="np__label">
          <span className="np__dot" aria-hidden="true" />
          Now playing
        </p>

        {current ? (
          <>
            <img className="np__art" src={current.artwork} alt="" />
            <p className="np__title">{current.title}</p>
            <ArtistNames className="np__artist" name={current.artist} artistId={current.artistId} />
            <section className="np__artist-card" aria-label="About the artist">
              <p className="np__artist-card-label">About the artist</p>
              <ArtistNames className="np__artist-link" name={current.artist} artistId={current.artistId} />
            </section>
          </>
        ) : (
          <div className="np__placeholder">
            <p>Nothing playing yet</p>
            <p className="np__hint">Pick a track anywhere on the page.</p>
          </div>
        )}

      </div>

      {queueOpen && (
        <div className="queue-panel" role="dialog" aria-label="Queue">
          <div className="queue-panel__header">
            <h2>Queue</h2>
            <button type="button" className="queue-panel__close" aria-label="Close queue" onClick={() => setQueueOpen(false)}>×</button>
          </div>
          <section className="queue-panel__section">
            <h3>Now playing</h3>
            {current && (
              <div className="queue-panel__track queue-panel__track--current">
                <QueueTrack track={current} active />
              </div>
            )}
          </section>
          <section className="queue-panel__section">
            <h3>Next up</h3>
            {upcoming.length ? (
              <ul className="queue-panel__list">
                {upcoming.map((track, index) => (
                  <li key={`${track.id}-${index}`}>
                    <button
                      type="button"
                      className="queue-panel__track"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent<PlayTrackDetail>(PLAY_TRACK_EVENT, {
                          detail: { ...track, queue, queueIndex: queueIndex + index + 1 },
                        }));
                      }}
                    >
                      <QueueTrack track={track} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="queue-panel__empty">No tracks are queued next.</p>
            )}
          </section>
        </div>
      )}

      <style>{`
        .now-playing-col {
          width: var(--now-w);
          border-left: 1px solid var(--line);
          padding: 26px 22px 22px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }
        .np__label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ash-dim);
          margin: 0 0 18px;
        }
        .np__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--amber); flex: none; }
        .np__art { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: var(--radius-m); box-shadow: var(--shadow-card); }
        .np__title { margin-top: 14px; font-size: 0.98rem; font-weight: 600; color: var(--paper); }
        .np__artist { margin-top: 4px; font-size: 0.84rem; color: var(--ash); }
        .np__artist { display: block; }
        .np__artist a:hover { color: var(--amber); text-decoration: underline; text-underline-offset: 3px; }
        .np__placeholder {
          border: 1px dashed var(--line); border-radius: var(--radius-m); padding: 26px 16px;
          text-align: center; color: var(--ash);
        }
        .np__placeholder p { margin: 0; font-size: 0.86rem; }
        .np__hint { margin-top: 6px !important; font-size: 0.76rem !important; color: var(--ash-dim); }
        .np__artist-card { margin-top: 24px; padding: 16px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--ink-soft); }
        .np__artist-card-label { font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ash-dim); margin-bottom: 8px; }
        .np__artist-link { display: flex; flex-wrap: wrap; gap: 4px 8px; font-weight: 600; color: var(--paper); font-size: 0.88rem; }
        .np__artist-link a:hover { color: var(--amber); text-decoration: underline; text-underline-offset: 3px; }
        .queue-panel { position: fixed; z-index: 60; right: 20px; bottom: calc(var(--player-h) + 16px); width: min(380px, calc(100vw - 32px)); max-height: calc(100vh - var(--player-h) - 32px); overflow-y: auto; padding: 20px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--ink-soft); box-shadow: 0 18px 48px rgba(23, 21, 29, 0.24); }
        .queue-panel__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }
        .queue-panel__header h2 { font-size: 1.1rem; }
        .queue-panel__close { width: 30px; height: 30px; border-radius: 999px; color: var(--ash); font-size: 1.4rem; line-height: 1; }
        .queue-panel__close:hover { color: var(--paper); background: var(--ink-raised); }
        .queue-panel__section + .queue-panel__section { margin-top: 22px; }
        .queue-panel__section h3 { font-size: 0.88rem; margin-bottom: 10px; }
        .queue-panel__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .queue-panel__track { display: flex; width: 100%; align-items: center; gap: 10px; padding: 6px; border-radius: var(--radius-s); text-align: left; }
        .queue-panel__track:hover { background: var(--ink-raised); }
        .queue-panel__track--current:hover { background: transparent; }
        .queue-panel__track img { width: 42px; height: 42px; border-radius: 6px; object-fit: cover; flex: none; }
        .queue-panel__track-meta { min-width: 0; }
        .queue-panel__track-title, .queue-panel__track-artist { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .queue-panel__track-title { font-size: 0.86rem; font-weight: 600; color: var(--paper); }
        .queue-panel__track-artist { display: block; margin-top: 2px; font-size: 0.76rem; color: var(--ash); }
        .queue-panel__empty { padding: 8px 0; font-size: 0.82rem; color: var(--ash); }
        @media (max-width: 900px) { .queue-panel { right: 12px; bottom: calc(var(--player-h) + 10px); } }
      `}</style>
    </aside>
  );
}

function QueueTrack({ track, active = false }: { track: PlayTrackDetail; active?: boolean }) {
  return (
    <>
      <img src={thumbSrc(track.artwork)} alt="" width={42} height={42} loading="lazy" />
      <span className="queue-panel__track-meta">
        <span className="queue-panel__track-title">{track.title}{active ? ' · Playing' : ''}</span>
        <span className="queue-panel__track-artist">{getDisplayArtists(track.artist, track.artistId).map((artist) => artist.name).join(', ')}</span>
      </span>
    </>
  );
}