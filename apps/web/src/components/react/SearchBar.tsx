import { useEffect, useRef, useState } from 'react';
import { dispatchPlayTrack } from '../../lib/events';
import { api } from '../../lib/api';
import type { Track } from '@music/types';

interface Props {
  /** Where the full results page lives; Enter navigates here with ?q= */
  resultsPath?: string;
  placeholder?: string;
}

export default function SearchBar({ resultsPath = '/search', placeholder = 'Search songs, artists…' }: Props) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (term.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        // apps/web never talks to iTunes directly — @music/api owns that,
        // caches it, and hands back @music/types shapes.
        const { tracks } = await api.search(term);
        setResults(tracks.slice(0, 6));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [term]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, []);

  function goToResults() {
    if (!term.trim()) return;
    window.location.href = `${resultsPath}?q=${encodeURIComponent(term.trim())}`;
  }

  function play(track: Track) {
    if (!track.previewUrl) return;
    const queue = results
      .filter((r) => r.previewUrl)
      .map((r) => ({
        id: r.id,
        title: r.title,
        artist: r.artistName,
        album: r.albumTitle,
        artwork: r.coverUrl,
        previewUrl: r.previewUrl as string,
        durationMs: r.durationMs,
        artistId: r.artistId,
        genre: r.genre,
      }));
    dispatchPlayTrack({
      id: track.id,
      title: track.title,
      artist: track.artistName,
      album: track.albumTitle,
      artwork: track.coverUrl,
      previewUrl: track.previewUrl,
      durationMs: track.durationMs,
      artistId: track.artistId,
      genre: track.genre,
      queue,
      queueIndex: queue.findIndex((t) => t.id === track.id),
    });
    setOpen(false);
  }

  return (
    <div className="searchbar" ref={boxRef}>
      <svg className="searchbar__icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="16.4" y1="16.4" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={term}
        placeholder={placeholder}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && goToResults()}
        aria-label="Search songs and artists"
      />
      {loading && <span className="searchbar__spinner" aria-hidden="true" />}

      {open && results.length > 0 && (
        <ul className="searchbar__results" role="listbox">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => play(r)} disabled={!r.previewUrl}>
                <img src={r.coverUrl} alt="" />
                <span className="searchbar__results-meta">
                  <span className="searchbar__results-title">{r.title}</span>
                  <span className="searchbar__results-artist">{r.artistName}</span>
                </span>
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
                </svg>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="searchbar__see-all" onClick={goToResults}>
              See all results for “{term}”
            </button>
          </li>
        </ul>
      )}

      <style>{`
        .searchbar { position: relative; width: 100%; max-width: 420px; }
        .searchbar__icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--ash-dim); pointer-events: none; }
        .searchbar input {
          width: 100%;
          background: var(--ink-raised);
          border: 1px solid var(--line);
          color: var(--paper);
          border-radius: 999px;
          padding: 10px 16px 10px 38px;
          font-size: 0.88rem;
          transition: border-color 0.15s ease;
        }
        .searchbar input::placeholder { color: var(--ash-dim); }
        .searchbar input:focus { border-color: var(--amber-dim); }
        .searchbar__spinner {
          position: absolute; right: 14px; top: 50%; width: 13px; height: 13px;
          margin-top: -6.5px; border-radius: 50%;
          border: 2px solid var(--line); border-top-color: var(--amber);
          animation: spin-search 0.7s linear infinite;
        }
        @keyframes spin-search { to { transform: rotate(360deg); } }
        .searchbar__results {
          position: absolute; top: calc(100% + 8px); left: 0; right: 0;
          background: var(--ink-raised); border: 1px solid var(--line); border-radius: var(--radius-m);
          list-style: none; margin: 0; padding: 6px; box-shadow: var(--shadow-card); z-index: 50;
          max-height: 360px; overflow-y: auto;
        }
        .searchbar__results li button {
          display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px; border-radius: var(--radius-s);
          text-align: left; color: var(--ash);
        }
        .searchbar__results li button:hover:not(:disabled) { background: var(--ink-soft); color: var(--paper); }
        .searchbar__results li button:disabled { opacity: 0.4; cursor: default; }
        .searchbar__results img { width: 34px; height: 34px; border-radius: 6px; flex: none; object-fit: cover; }
        .searchbar__results-meta { min-width: 0; flex: 1; }
        .searchbar__results-title { display: block; font-size: 0.85rem; font-weight: 600; color: var(--paper); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .searchbar__results-artist { display: block; font-size: 0.75rem; color: var(--ash); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .searchbar__see-all { justify-content: center; font-size: 0.78rem; font-family: var(--font-mono); color: var(--amber); }
      `}</style>
    </div>
  );
}
