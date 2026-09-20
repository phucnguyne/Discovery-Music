import { useEffect, useState } from 'react';
import { PLAY_TRACK_EVENT, type PlayTrackDetail } from '../../lib/events';
import { thumbSrc } from '../../lib/format';

export default function NowPlayingPanel() {
  const [current, setCurrent] = useState<PlayTrackDetail | null>(null);
  const [queue, setQueue] = useState<PlayTrackDetail[]>([]);

  useEffect(() => {
    const handler = (e: CustomEvent<PlayTrackDetail>) => {
      const detail = e.detail;
      setCurrent(detail);
      const q = detail.queue && detail.queue.length ? detail.queue : [detail];
      setQueue(q.filter((t) => t.id !== detail.id));
    };
    window.addEventListener(PLAY_TRACK_EVENT, handler as EventListener);
    return () => window.removeEventListener(PLAY_TRACK_EVENT, handler as EventListener);
  }, []);

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
            <p className="np__artist">{current.artist}</p>
          </>
        ) : (
          <div className="np__placeholder">
            <p>Nothing playing yet</p>
            <p className="np__hint">Pick a track anywhere on the page.</p>
          </div>
        )}

        {queue.length > 0 && (
          <div className="np__queue">
            <p className="np__queue-label">Up next</p>
            <ul>
              {queue.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <img src={thumbSrc(t.artwork)} alt="" width={34} height={34} loading="lazy" />
                  <div className="np__queue-meta">
                    <span className="np__queue-title">{t.title}</span>
                    <span className="np__queue-artist">{t.artist}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <style>{`
        .now-playing-col {
          width: var(--now-w);
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
        .np__placeholder {
          border: 1px dashed var(--line); border-radius: var(--radius-m); padding: 26px 16px;
          text-align: center; color: var(--ash);
        }
        .np__placeholder p { margin: 0; font-size: 0.86rem; }
        .np__hint { margin-top: 6px !important; font-size: 0.76rem !important; color: var(--ash-dim); }
        .np__queue { margin-top: 30px; }
        .np__queue-label { font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ash-dim); margin: 0 0 10px; }
        .np__queue ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .np__queue li { display: flex; align-items: center; gap: 10px; padding: 6px; border-radius: var(--radius-s); }
        .np__queue li:hover { background: var(--ink); }
        .np__queue img { width: 34px; height: 34px; border-radius: 6px; object-fit: cover; flex: none; }
        .np__queue-meta { min-width: 0; }
        .np__queue-title { display: block; font-size: 0.82rem; font-weight: 600; color: var(--paper); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .np__queue-artist { display: block; font-size: 0.72rem; color: var(--ash-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `}</style>
    </aside>
  );
}