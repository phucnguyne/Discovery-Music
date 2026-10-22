import { useEffect, useState } from 'react';
import type { Artist } from '@music/types';
import { MusicApiError } from '@music/api-client';
import { api } from '../../lib/api';

export default function ArtistFollowButton({ artist }: { artist: Artist }) {
  const [followed, setFollowed] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.checkFollowing([artist.id]).then((ids) => {
      if (!cancelled) {
        setFollowed(ids.includes(artist.id));
        setReady(true);
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(err instanceof MusicApiError ? err.message : 'Could not load your follow status.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [artist.id]);

  async function toggleFollowing() {
    setBusy(true);
    setError(null);
    try {
      if (!await api.me()) {
        window.location.href = '/login';
        return;
      }
      if (followed) await api.unfollowArtist(artist.id);
      else await api.followArtist(artist);
      setFollowed((value) => !value);
    } catch (err) {
      setError(err instanceof MusicApiError ? err.message : 'Could not update your following list.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="follow-control">
      <button type="button" onClick={toggleFollowing} disabled={!ready || busy}>
        {busy ? 'Saving…' : followed ? 'Following' : 'Follow'}
      </button>
      {error && <p role="alert">{error}</p>}
      <style>{`
        .follow-control { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
        .follow-control button { padding: 9px 18px; border-radius: 999px; color: var(--ink-soft); background: var(--paper); font-size: 0.84rem; font-weight: 600; }
        .follow-control button:hover:not(:disabled) { background: var(--amber); color: var(--ink-soft); }
        .follow-control button:disabled { opacity: 0.55; cursor: default; }
        .follow-control p { color: var(--danger); font-size: 0.76rem; }
      `}</style>
    </div>
  );
}
