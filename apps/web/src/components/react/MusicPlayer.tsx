import { useCallback, useEffect, useRef, useState } from 'react';
import { OPEN_QUEUE_EVENT, PLAY_STATE_EVENT, PLAY_TRACK_EVENT, TOGGLE_PLAY_EVENT, type PlayTrackDetail } from '../../lib/events';
import { api } from '../../lib/api';
import { thumbSrc } from '../../lib/format';
import ArtistNames from './ArtistNames';

const BAR_COUNT = 40;
type RepeatMode = 'off' | 'track' | 'list';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MusicPlayer() {
  const [current, setCurrent] = useState<PlayTrackDetail | null>(null);
  const [queue, setQueue] = useState<PlayTrackDetail[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // seconds
  const [duration, setDuration] = useState(30); // preview clips are ~30s
  const [volume, setVolume] = useState(0.85);
  const [error, setError] = useState<string | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [autoplayNext, setAutoplayNext] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);

  // Set up the <audio> element once. Deliberately NOT routed through the Web
  // Audio API (no createMediaElementSource/AnalyserNode) — the iTunes preview
  // CDN doesn't reliably send CORS headers, and connecting a cross-origin
  // media element into a Web Audio graph without CORS gets it silently muted
  // by the browser even though playback otherwise looks like it's working
  // (currentTime advances, play() resolves). Keeping the <audio> element's
  // own default output path guarantees sound actually plays; the waveform
  // below is a lightweight simulated animation instead of real frequency
  // analysis — a deliberate trade so audio reliability never depends on a
  // CDN header we don't control.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = volume;
    audioRef.current = audio;

    const onTime = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 30);
    const onEnded = () => {
      const mode = repeatModeRef.current;
      if (mode === 'track') {
        playAtIndex(queueIndexRef.current);
      } else if (mode === 'list') {
        playAtIndex(queueIndexRef.current + 1);
      } else if (autoplayNextRef.current && queueIndexRef.current < queueRef.current.length - 1) {
        playAtIndex(queueIndexRef.current + 1);
      } else {
        setIsPlaying(false);
      }
    };
    const onError = () => setError('This track has no playable preview.');

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => togglePlay();
    window.addEventListener(TOGGLE_PLAY_EVENT, handler);
    return () => window.removeEventListener(TOGGLE_PLAY_EVENT, handler);
  });

  // Keep a ref mirror of queueIndex/queue so the 'ended' handler (bound once)
  // always sees fresh values without re-registering the audio element.
  const queueIndexRef = useRef(0);
  const queueRef = useRef<PlayTrackDetail[]>([]);
  const repeatModeRef = useRef<RepeatMode>('off');
  const autoplayNextRef = useRef(true);
  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);
  useEffect(() => {
    autoplayNextRef.current = autoplayNext;
  }, [autoplayNext]);

  const playAtIndex = useCallback((idx: number) => {
    const q = queueRef.current;
    if (!q.length) return;
    const clamped = ((idx % q.length) + q.length) % q.length;
    const nextTrack = q[clamped];
    window.dispatchEvent(
      new CustomEvent(PLAY_TRACK_EVENT, {
        detail: { ...nextTrack, queue: q, queueIndex: clamped },
      })
    );
  }, []);



  function loadTrack(track: PlayTrackDetail, newQueue: PlayTrackDetail[], idx: number) {
    setError(null);
    setCurrent(track);
    setQueue(newQueue);
    setQueueIndex(idx);
    setIsPlaying(false);
    setProgress(0);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = track.previewUrl;
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        // Fire-and-forget, only once playback actually started (not on a
        // merely-queued track) — this single call site covers every way a
        // track can start: initial click, search, next/prev, and
        // auto-advance on 'ended', so recording happens exactly once per
        // real play, not once per UI element that could trigger one.
        if (track.artistId) {
          void api.recordListen({
            id: track.id,
            title: track.title,
            artistId: track.artistId,
            artistName: track.artist,
            albumTitle: track.album,
            coverUrl: track.artwork,
            previewUrl: track.previewUrl,
            durationMs: track.durationMs,
            genre: track.genre,
          });
        }
      })
      .catch(() => setError('Playback was blocked — tap play again.'));
  }

  // Listen for the global "play this track" broadcast from static islands.
  useEffect(() => {
    const handler = (e: CustomEvent<PlayTrackDetail>) => {
      const detail = e.detail;
      const q = detail.queue && detail.queue.length ? detail.queue : [detail];
      const idx = typeof detail.queueIndex === 'number' ? detail.queueIndex : q.findIndex((t) => t.id === detail.id);
      loadTrack(detail, q, Math.max(idx, 0));
    };
    window.addEventListener(PLAY_TRACK_EVENT, handler as EventListener);
    return () => window.removeEventListener(PLAY_TRACK_EVENT, handler as EventListener);
  }, []);

  // Drive the visualizer independently of React renders for maximum performance and stability.
  useEffect(() => {
    let active = true;

    function tickVisualizer() {
      if (!active) return;
      const audio = audioRef.current;
      const container = waveformRef.current;
      
      if (container) {
        const children = container.children;
        if (!audio || audio.paused) {
          for (let i = 0; i < children.length; i++) {
            if (children[i].tagName === 'SPAN') {
              (children[i] as HTMLElement).style.height = '4px';
            }
          }
        } else {
          const t = audio.currentTime;
          let spanIdx = 0;
          for (let i = 0; i < children.length; i++) {
            if (children[i].tagName === 'SPAN') {
              const phase = spanIdx * 0.35;
              const wave =
                Math.sin(t * 6 + phase) * 0.5 +
                Math.sin(t * 11 + phase * 1.7) * 0.3 +
                Math.sin(t * 2.3 + phase * 0.4) * 0.2;
              const h = 6 + (wave * 0.5 + 0.5) * 26;
              (children[i] as HTMLElement).style.height = `${h}px`;
              spanIdx++;
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tickVisualizer);
    }

    rafRef.current = requestAnimationFrame(tickVisualizer);

    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Broadcast our true play state so vinyls can spin/pause in sync.
  useEffect(() => {
    if (current) {
      window.dispatchEvent(
        new CustomEvent(PLAY_STATE_EVENT, {
          detail: { id: current.id, isPlaying },
        })
      );
    }
  }, [current, isPlaying]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (audio.ended || (audio.duration > 0 && audio.currentTime >= audio.duration)) {
        audio.currentTime = 0;
      }
      audio.play().then(() => setIsPlaying(true)).catch(() => setError('Playback was blocked — tap play again.'));
    }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    audio.currentTime = t;
    setProgress(t);
  }

  function changeVolume(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }

  function cycleRepeatMode() {
    setRepeatMode((mode) => mode === 'off' ? 'track' : mode === 'track' ? 'list' : 'off');
  }

  if (!current) {
    return (
      <div className="player player--idle" role="status">
        <p>Pick a track to start listening — previews are 30 seconds, courtesy of Apple/iTunes.</p>
      </div>
    );
  }

  return (
    <div className="player">
      <div className="player__track">
        <img src={thumbSrc(current.artwork, 100)} alt="" className="player__art" width={52} height={52} loading="lazy" />
        <div className="player__meta">
          <p className="player__title">{current.title}</p>
          <ArtistNames className="player__artist" name={current.artist} artistId={current.artistId} />
        </div>
      </div>

      <div className="player__center">
        <div className="player__transport">
          <button type="button" aria-label="Previous track" onClick={() => playAtIndex(queueIndex - 1)} disabled={queue.length < 2}>
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 5h2v14H6zM19 5v14l-11-7 11-7z" fill="currentColor" /></svg>
          </button>
          <button type="button" className="player__play" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" /></svg>
            )}
          </button>
          <button type="button" aria-label="Next track" onClick={() => playAtIndex(queueIndex + 1)} disabled={queue.length < 2}>
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M16 5h2v14h-2zM5 5v14l11-7L5 5z" fill="currentColor" /></svg>
          </button>
        </div>

        <div className="player__scrub">
          <span className="player__time">{formatTime(progress)}</span>
          <div className="player__waveform" aria-hidden="true" ref={waveformRef}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <span
                key={i}
                className="player__bar"
                style={{
                  height: '4px',
                  background: i / BAR_COUNT < progress / (duration || 30) ? 'var(--amber)' : 'var(--line)',
                }}
              />
            ))}
            <input
              className="player__range"
              type="range"
              min={0}
              max={duration || 30}
              step={0.1}
              value={progress}
              onChange={seek}
              aria-label="Seek"
            />
          </div>
          <span className="player__time">{formatTime(duration)}</span>
        </div>
        {error && <p className="player__error">{error}</p>}
      </div>

      <div className="player__volume">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor" />
        </svg>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={changeVolume} aria-label="Volume" />
      </div>

      <div className="player__options" aria-label="Playback options">
        <button
          type="button"
          className="player__option"
          aria-label={`Repeat ${repeatMode === 'off' ? 'off' : repeatMode === 'track' ? 'one track' : 'list'}`}
          aria-pressed={repeatMode !== 'off'}
          title={`Repeat: ${repeatMode}`}
          onClick={cycleRepeatMode}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {repeatMode === 'track' && <span className="player__repeat-one">1</span>}
        </button>
        <button
          type="button"
          className="player__option"
          aria-label={`Autoplay next ${autoplayNext ? 'on' : 'off'}`}
          aria-pressed={autoplayNext}
          title={`Autoplay next: ${autoplayNext ? 'on' : 'off'}`}
          onClick={() => setAutoplayNext((enabled) => !enabled)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M4 5h10M4 9h10M4 13h6M17 12l5 4-5 4v-8z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          className="player__option player__queue-button"
          aria-label="Open queue"
          title="Queue"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_QUEUE_EVENT))}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M4 6h16M4 12h10M4 18h10m4-8 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Queue</span>
        </button>
      </div>

      <style>{`
        .player {
          position: fixed;
          left: var(--sidebar-w);
          right: 0;
          bottom: 0;
          height: var(--player-h);
          background: var(--ink-soft);
          border-top: none;
          box-shadow: 0 -8px 24px -16px rgba(23, 21, 29, 0.18);
          display: grid;
          grid-template-columns: 240px minmax(280px, 1fr) auto auto;
          align-items: center;
          gap: 20px;
          padding: 0 24px;
          z-index: 40;
        }
        .player--idle {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ash);
          font-size: 0.85rem;
          text-align: center;
          padding: 0 24px;
        }
        .player__track { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .player__art { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; flex: none; }
        .player__meta { min-width: 0; }
        .player__title { font-size: 0.9rem; font-weight: 600; color: var(--paper); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .player__artist { margin-top: 2px; font-size: 0.78rem; color: var(--ash); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .player__artist { display: block; width: fit-content; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .player__artist a:hover { color: var(--amber); text-decoration: underline; text-underline-offset: 3px; }
        .player__center { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
        .player__transport { display: flex; align-items: center; gap: 14px; }
        .player__transport button { color: var(--ash); display: grid; place-items: center; }
        .player__transport button:hover:not(:disabled) { color: var(--paper); }
        .player__transport button:disabled { opacity: 0.35; cursor: default; }
        .player__play { width: 36px; height: 36px; border-radius: 999px; background: var(--amber); color: var(--ink) !important; }
        .player__play:hover { background: var(--violet); }
        .player__scrub { display: flex; align-items: center; gap: 10px; width: 100%; max-width: 480px; }
        .player__time { font-family: var(--font-mono); font-size: 0.7rem; color: var(--ash-dim); width: 32px; flex: none; }
        .player__time:last-child { text-align: right; }
        .player__waveform { position: relative; flex: 1; height: 30px; display: flex; align-items: center; gap: 2px; }
        .player__bar { flex: 1; min-width: 1px; border-radius: 2px; transition: height 0.05s linear; }
        .player__range { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
        .player__error { font-size: 0.72rem; color: var(--danger); }
        .player__volume { display: flex; align-items: center; gap: 8px; color: var(--ash); justify-self: end; }
        .player__volume input { accent-color: var(--amber); width: 90px; }
        .player__options { display: flex; align-items: center; justify-self: end; gap: 10px; }
        .player__option { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 30px; height: 34px; color: var(--ash); border-radius: var(--radius-s); }
        .player__option:hover, .player__option[aria-pressed='true'] { color: var(--amber); }
        .player__repeat-one { position: absolute; font-size: 0.58rem; font-weight: 700; right: 1px; bottom: 2px; }
        .player__queue-button span { font-size: 0.75rem; }
        @media (max-width: 1180px) {
          .player { grid-template-columns: 190px minmax(250px, 1fr) auto; gap: 12px; padding: 0 16px; }
          .player__volume { display: none; }
          .player__options { gap: 6px; }
        }
        @media (max-width: 900px) {
          .player { left: 0; grid-template-columns: 1fr auto; grid-template-areas: 'track options' 'center center'; grid-auto-rows: auto; height: auto; min-height: var(--player-h); padding: 10px 16px; gap: 8px 12px; }
          .player__track { grid-area: track; }
          .player__center { grid-area: center; }
          .player__options { grid-area: options; }
          .player__queue-button span { display: none; }
          /* iOS Safari ignores JS volume changes on <audio> entirely (a
             platform policy, not a bug here) — a slider that visibly does
             nothing is worse than no slider, and dropping this row also
             keeps the mobile player from growing even taller. */
          .player__volume { display: none; }
        }
      `}</style>
    </div>
  );
}