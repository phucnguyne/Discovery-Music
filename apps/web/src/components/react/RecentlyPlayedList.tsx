import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import TrackListItem from './TrackListItem';
import { timeAgo } from '../../lib/format';
import type { RecentlyPlayedTrack } from '@music/types';

export default function RecentlyPlayedList() {
  const [tracks, setTracks] = useState<RecentlyPlayedTrack[] | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    api.me().then((user) => {
      if (cancelled) return;
      if (!user) {
        window.location.href = '/login';
        return;
      }
      api.recentlyPlayed().then((rows) => {
        if (cancelled) return;
        setTracks(rows);
        api.checkFavorites(rows.map((t) => t.id)).then((ids) => {
          if (!cancelled) setFavoritedIds(new Set(ids));
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (tracks === null) return <p className="list-status">Loading…</p>;
  if (tracks.length === 0) {
    return <p className="list-status">Nothing played yet — tap play on any song and it'll show up here.</p>;
  }

  return (
    <div className="track-list">
      {tracks.map((t, i) => (
        <TrackListItem
          key={`${t.id}-${t.playedAt}`}
          track={t}
          index={i + 1}
          initialFavorited={favoritedIds.has(t.id)}
          metaOverride={timeAgo(t.playedAt)}
        />
      ))}
      <style>{`
        .list-status { font-size: 0.9rem; color: var(--ash); padding: 20px 4px; }
        .track-list { display: flex; flex-direction: column; gap: 2px; }
      `}</style>
    </div>
  );
}