import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { PlaylistSummary } from '@music/types';

export default function PlaylistsList() {
  const [playlists, setPlaylists] = useState<PlaylistSummary[] | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.me().then((user) => {
      if (cancelled) return;
      if (!user) {
        window.location.href = '/login';
        return;
      }
      api.playlists().then((rows) => {
        if (!cancelled) setPlaylists(rows);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await api.createPlaylist(newName.trim());
      setPlaylists((prev) => [created, ...(prev ?? [])]);
      setNewName('');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.deletePlaylist(id);
      setPlaylists((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="playlists-page">
      <form className="playlists-create" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="New playlist name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={100}
        />
        <button type="submit" disabled={!newName.trim() || creating}>
          {creating ? 'Creating…' : 'Create playlist'}
        </button>
      </form>

      {playlists === null ? (
        <p className="list-status">Loading…</p>
      ) : playlists.length === 0 ? (
        <p className="list-status">No playlists yet — create your first one above.</p>
      ) : (
        <ul className="playlists-grid">
          {playlists.map((p) => (
            <li key={p.id} className="playlist-card">
              <a href={`/playlists/${p.id}`} className="playlist-card__link">
                <span className="playlist-card__name">{p.name}</span>
                <span className="playlist-card__meta">
                  {p.trackCount} track{p.trackCount === 1 ? '' : 's'}
                </span>
              </a>
              <button
                type="button"
                className="playlist-card__delete"
                onClick={() => handleDelete(p.id)}
                disabled={deletingId === p.id}
                aria-label={`Delete ${p.name}`}
              >
                {deletingId === p.id ? '…' : '×'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .playlists-page { display: flex; flex-direction: column; gap: 24px; }
        .playlists-create { display: flex; gap: 10px; max-width: 420px; }
        .playlists-create input {
          flex: 1; min-width: 0; background: var(--ink-raised); border: 1px solid var(--line); color: var(--paper);
          border-radius: var(--radius-s); padding: 10px 14px; font-size: 0.9rem;
        }
        .playlists-create button {
          font-size: 0.86rem; font-weight: 600; color: var(--ink-soft); background: var(--paper);
          border-radius: 999px; padding: 0 18px; white-space: nowrap; transition: opacity 0.15s ease;
        }
        .playlists-create button:disabled { opacity: 0.5; }
        .list-status { font-size: 0.9rem; color: var(--ash); }
        .playlists-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .playlist-card {
          position: relative; background: var(--ink-soft); border: 1px solid var(--line); border-radius: var(--radius-m);
          transition: border-color 0.15s ease;
        }
        .playlist-card:hover { border-color: var(--amber-dim); }
        .playlist-card__link { display: flex; flex-direction: column; gap: 4px; padding: 16px; }
        .playlist-card__name { font-size: 0.98rem; font-weight: 600; color: var(--paper); }
        .playlist-card__meta { font-size: 0.78rem; color: var(--ash); font-family: var(--font-mono); }
        .playlist-card__delete {
          position: absolute; top: 10px; right: 10px; width: 24px; height: 24px; border-radius: 999px;
          display: grid; place-items: center; color: var(--ash-dim); font-size: 1rem; line-height: 1;
          opacity: 0; transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
        }
        .playlist-card:hover .playlist-card__delete { opacity: 1; }
        .playlist-card__delete:hover { color: var(--paper); background: var(--ink-raised); }
      `}</style>
    </div>
  );
}