import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { MusicApiError } from '@music/api-client';
import TrackListItem from './TrackListItem';
import type { PlaylistDetail } from '@music/types';

interface Props {
  playlistId: string;
}

export default function PlaylistDetailView({ playlistId }: Props) {
  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.me().then((user) => {
      if (cancelled) return;
      if (!user) {
        window.location.href = '/login';
        return;
      }
      api
        .playlist(playlistId)
        .then((d) => {
          if (!cancelled) setDetail(d);
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof MusicApiError && err.status === 401) {
            window.location.href = '/login';
          } else {
            setNotFound(true);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [playlistId]);

  async function handleRemoveTrack(trackId: string) {
    await api.removeFromPlaylist(playlistId, trackId);
    setDetail((prev) =>
      prev
        ? {
            playlist: { ...prev.playlist, trackCount: prev.playlist.trackCount - 1 },
            tracks: prev.tracks.filter((t) => t.id !== trackId),
          }
        : prev,
    );
  }

  async function handleDeletePlaylist() {
    setDeleting(true);
    try {
      await api.deletePlaylist(playlistId);
      window.location.href = '/playlists';
    } catch {
      setDeleting(false);
    }
  }

  if (notFound) {
    return (
      <p className="list-status">
        Playlist not found. <a href="/playlists">Back to playlists</a>
      </p>
    );
  }

  if (!detail) return <p className="list-status">Loading…</p>;

  return (
    <div className="playlist-detail">
      <div className="playlist-detail__header">
        <div>
          <h1 className="playlist-detail__name">{detail.playlist.name}</h1>
          <p className="playlist-detail__meta">
            {detail.playlist.trackCount} track{detail.playlist.trackCount === 1 ? '' : 's'}
          </p>
        </div>
        <button type="button" className="playlist-detail__delete" onClick={handleDeletePlaylist} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete playlist'}
        </button>
      </div>

      {detail.tracks.length === 0 ? (
        <p className="list-status">No tracks yet — use the + button on any song to add it here.</p>
      ) : (
        <div className="track-list">
          {detail.tracks.map((t, i) => (
            <TrackListItem
              key={t.id}
              track={t}
              index={i + 1}
              onRemove={() => handleRemoveTrack(t.id)}
              removeLabel={`Remove ${t.title} from this playlist`}
            />
          ))}
        </div>
      )}

      <style>{`
        .playlist-detail { display: flex; flex-direction: column; gap: 20px; }
        .playlist-detail__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .playlist-detail__name { font-size: 1.5rem; }
        .playlist-detail__meta { margin-top: 4px; font-size: 0.85rem; color: var(--ash); }
        .playlist-detail__delete {
          font-size: 0.82rem; color: var(--ash); border: 1px solid var(--line); border-radius: 999px;
          padding: 8px 16px; white-space: nowrap; transition: color 0.15s ease, border-color 0.15s ease;
        }
        .playlist-detail__delete:hover:not(:disabled) { color: #ef4a6b; border-color: #ef4a6b; }
        .playlist-detail__delete:disabled { opacity: 0.6; }
        .list-status { font-size: 0.9rem; color: var(--ash); }
        .list-status a { color: var(--amber); font-weight: 600; }
        .track-list { display: flex; flex-direction: column; gap: 2px; }
      `}</style>
    </div>
  );
}