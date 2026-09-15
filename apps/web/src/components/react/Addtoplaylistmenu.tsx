import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { MusicApiError } from '@music/api-client';
import { ADD_TO_PLAYLIST_EVENT, type AddToPlaylistDetail } from '../../lib/events';
import type { PlaylistSummary, Track } from '@music/types';

function toTrack(d: AddToPlaylistDetail): Track {
  return {
    id: d.id,
    title: d.title,
    artistId: d.artistId,
    artistName: d.artist,
    albumTitle: d.album,
    coverUrl: d.artwork,
    previewUrl: d.previewUrl,
    durationMs: d.durationMs,
    genre: d.genre,
  };
}

export default function AddToPlaylistMenu() {
  const [track, setTrack] = useState<AddToPlaylistDetail | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistSummary[] | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const handler = ((e: CustomEvent<AddToPlaylistDetail>) => {
      setTrack(e.detail);
      setPlaylists(null);
      setNeedsLogin(false);
      setAddedTo(new Set());
      setNewName('');
      api
        .playlists()
        .then(setPlaylists)
        .catch((err) => {
          if (err instanceof MusicApiError && err.status === 401) setNeedsLogin(true);
        });
    }) as EventListener;
    window.addEventListener(ADD_TO_PLAYLIST_EVENT, handler);
    return () => window.removeEventListener(ADD_TO_PLAYLIST_EVENT, handler);
  }, []);

  function close() {
    setTrack(null);
  }

  async function handleAdd(playlistId: string) {
    if (!track) return;
    try {
      await api.addToPlaylist(playlistId, toTrack(track));
      setAddedTo((prev) => new Set(prev).add(playlistId));
    } catch {
      // A failed add just doesn't get the checkmark — no need to be loud
      // about it, the person can see it didn't happen and try again.
    }
  }

  async function handleCreate(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!newName.trim() || !track) return;
    setCreating(true);
    try {
      const created = await api.createPlaylist(newName.trim());
      setPlaylists((prev) => [created, ...(prev ?? [])]);
      setNewName('');
      await handleAdd(created.id);
    } catch {
      // leave the typed name in place so they can retry
    } finally {
      setCreating(false);
    }
  }

  if (!track) return null;

  return (
    <div className="atp-overlay" onClick={close}>
      <div className="atp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="atp-modal__header">
          <p className="atp-modal__title">Add to playlist</p>
          <p className="atp-modal__track">
            {track.title} — {track.artist}
          </p>
        </div>

        {needsLogin ? (
          <p className="atp-modal__empty">
            <a href="/login">Log in</a> to save tracks to a playlist.
          </p>
        ) : playlists === null ? (
          <p className="atp-modal__empty">Loading your playlists…</p>
        ) : (
          <>
            {playlists.length === 0 && <p className="atp-modal__empty">No playlists yet — create one below.</p>}
            <ul className="atp-list">
              {playlists.map((p) => (
                <li key={p.id}>
                  <button type="button" className="atp-list__item" onClick={() => handleAdd(p.id)}>
                    <span>{p.name}</span>
                    <span className="atp-list__meta">
                      {addedTo.has(p.id) ? 'Added ✓' : `${p.trackCount} track${p.trackCount === 1 ? '' : 's'}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <form className="atp-create" onSubmit={handleCreate}>
              <input
                type="text"
                placeholder="New playlist name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
              />
              <button type="submit" disabled={!newName.trim() || creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </form>
          </>
        )}

        <button type="button" className="atp-close" onClick={close} aria-label="Close">
          ×
        </button>
      </div>

      <style>{`
        .atp-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
          z-index: 200; padding: 20px;
        }
        .atp-modal {
          position: relative; width: 100%; max-width: 340px;
          background: var(--ink-soft); border: 1px solid var(--line);
          border-radius: var(--radius-l); padding: 22px; box-shadow: var(--shadow-card);
        }
        .atp-modal__header { margin-bottom: 14px; padding-right: 20px; }
        .atp-modal__title { font-size: 1rem; font-weight: 600; color: var(--paper); }
        .atp-modal__track { font-size: 0.8rem; color: var(--ash); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .atp-modal__empty { font-size: 0.85rem; color: var(--ash); padding: 8px 0; }
        .atp-modal__empty a { color: var(--amber); font-weight: 600; }
        .atp-list { list-style: none; margin: 0 0 14px; padding: 0; max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
        .atp-list__item {
          width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 9px 10px; border-radius: var(--radius-s); font-size: 0.88rem; color: var(--paper);
          transition: background 0.15s ease;
        }
        .atp-list__item:hover { background: var(--ink-raised); }
        .atp-list__meta { font-size: 0.74rem; color: var(--ash-dim); font-family: var(--font-mono); flex: none; }
        .atp-create { display: flex; gap: 8px; }
        .atp-create input {
          flex: 1; min-width: 0; background: var(--ink-raised); border: 1px solid var(--line); color: var(--paper);
          border-radius: var(--radius-s); padding: 9px 12px; font-size: 0.86rem;
        }
        .atp-create button {
          font-size: 0.82rem; font-weight: 600; color: var(--ink-soft); background: var(--paper);
          border-radius: var(--radius-s); padding: 0 14px; white-space: nowrap;
        }
        .atp-create button:disabled { opacity: 0.5; }
        .atp-close {
          position: absolute; top: 14px; right: 14px; width: 26px; height: 26px;
          border-radius: 999px; display: grid; place-items: center; color: var(--ash);
          font-size: 1.1rem; line-height: 1; transition: background 0.15s ease, color 0.15s ease;
        }
        .atp-close:hover { background: var(--ink-raised); color: var(--paper); }
      `}</style>
    </div>
  );
}