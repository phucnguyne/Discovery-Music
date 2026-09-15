import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { MusicApiError } from '@music/api-client';
import TrackListItem from './TrackListItem';
import type { FavoriteTrack } from '@music/types';

export default function FavoritesList() {
  const [tracks, setTracks] = useState<FavoriteTrack[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.me().then((user) => {
      if (cancelled) return;
      if (!user) {
        window.location.href = '/login';
        return;
      }
      api
        .favorites()
        .then((rows) => {
          if (!cancelled) setTracks(rows);
        })
        .catch((err) => {
          if (err instanceof MusicApiError && err.status === 401) window.location.href = '/login';
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (tracks === null) return <p className="list-status">Loading…</p>;
  if (tracks.length === 0) {
    return <p className="list-status">No favorites yet — tap the heart on any song to save it here.</p>;
  }

  return (
    <div className="track-list">
      {tracks.map((t, i) => (
        <TrackListItem
          key={t.id}
          track={t}
          index={i + 1}
          initialFavorited
          onFavoriteChange={(favorited) => {
            if (!favorited) setTracks((prev) => prev?.filter((x) => x.id !== t.id) ?? null);
          }}
        />
      ))}
      <style>{`
        .list-status { font-size: 0.9rem; color: var(--ash); padding: 20px 4px; }
        .track-list { display: flex; flex-direction: column; gap: 2px; }
      `}</style>
    </div>
  );
}