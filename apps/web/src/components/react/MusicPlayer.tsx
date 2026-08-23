import { useCallback, useEffect, useRef, useState } from 'react';
import { PLAY_TRACK_EVENT, type PlayTrackDetail } from '../../lib/events';

const BAR_COUNT = 40;

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
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(4));
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Set up the <audio> element once.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = volume;
    audioRef.current = audio;

    const onTime = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 30);
    const onEnded = () => playAtIndex(queueIndexRef.current + 1);
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

  // Keep a ref mirror of queueIndex/queue so the 'ended' handler (bound once)
  // always sees fresh values without re-registering the audio element.
  const queueIndexRef = useRef(0);
  const queueRef = useRef<PlayTrackDetail[]>([]);
  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const playAtIndex = useCallback((idx: number) => {
    const q = queueRef.current;
    if (!q.length) return;
    const clamped = ((idx % q.length) + q.length) % q.length;
    loadTrack(q[clamped], q, clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ensureAnalyser() {
    if (!audioRef.current) return;
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    }
    audioCtxRef.current.resume();
  }

  function tickVisualizer() {
    const analyser = analyserRef.current;
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const step = Math.floor(data.length / BAR_COUNT) || 1;
      const next: number[] = [];
      for (let i = 0; i < BAR_COUNT; i++) {
        const v = data[i * step] ?? 0;
        next.push(4 + (v / 255) * 30);
      }
      setBars(next);
    }
    rafRef.current = requestAnimationFrame(tickVisualizer);
  }

  function loadTrack(track: PlayTrackDetail, newQueue: PlayTrackDetail[], idx: number) {
    setError(null);
    setCurrent(track);
    setQueue(newQueue);
    setQueueIndex(idx);
    setProgress(0);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = track.previewUrl;
    ensureAnalyser();
    audio
      .play()
      .then(() => setIsPlaying(true))
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

  // Drive the visualizer only while actually playing.
  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tickVisualizer);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      setBars((b) => b.map(() => 4));
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      ensureAnalyser();
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
        <img src={current.artwork} alt="" className="player__art" />
        <div className="player__meta">
          <p className="player__title">{current.title}</p>
          <p className="player__artist">{current.artist}</p>
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
          <div className="player__waveform" aria-hidden="true">
            {bars.map((h, i) => (
              <span
                key={i}
                className="player__bar"
                style={{
                  height: `${h}px`,
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

      <style>{`
        .player {
          position: fixed;
          left: var(--sidebar-w);
          right: 0;
          bottom: 0;
          height: var(--player-h);
          background: var(--ink-soft);
          border-top: 1px solid var(--line);
          display: grid;
          grid-template-columns: 240px 1fr 160px;
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
        @media (max-width: 900px) {
          .player { left: 0; grid-template-columns: 1fr; grid-auto-rows: auto; height: auto; padding: 12px 16px; gap: 10px; }
          .player__volume { justify-self: stretch; }
        }
      `}</style>
    </div>
  );
}
