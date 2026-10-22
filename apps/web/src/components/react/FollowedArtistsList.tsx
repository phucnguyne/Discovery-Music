import { useEffect, useState } from 'react';
import { MusicApiError } from '@music/api-client';
import type { FollowedArtist } from '@music/types';
import { api } from '../../lib/api';

export default function FollowedArtistsList() {
  const [artists, setArtists] = useState<FollowedArtist[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.me().then((user) => {
      if (!user) {
        window.location.href = '/login';
        return;
      }
      api.followedArtists().then((items) => {
        if (!cancelled) setArtists(items);
      }).catch((err) => {
        if (!cancelled) {
          if (err instanceof MusicApiError && err.status === 401) window.location.href = '/login';
          else setError(err instanceof Error ? err.message : 'Could not load followed artists.');
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function unfollow(artist: FollowedArtist) {
    setError(null);
    try {
      await api.unfollowArtist(artist.id);
      setArtists((current) => current?.filter((item) => item.id !== artist.id) ?? null);
    } catch (err) {
      if (err instanceof MusicApiError && err.status === 401) window.location.href = '/login';
      else setError(err instanceof Error ? err.message : 'Could not unfollow this artist.');
    }
  }

  if (error) return <p className="followed-artists__status" role="alert">{error}</p>;
  if (artists === null) return <p className="followed-artists__status">Loading artists…</p>;
  if (artists.length === 0) {
    return <p className="followed-artists__status">You are not following any artists yet. Follow an artist from their page to see them here.</p>;
  }

  return (
    <div className="followed-artists">
      {artists.map((artist) => (
        <article className="followed-artists__card" key={artist.id}>
          <a className="followed-artists__avatar" href={`/artist/${encodeURIComponent(artist.id)}`} aria-label={`View ${artist.name}`}>
            {artist.name.slice(0, 1).toUpperCase()}
          </a>
          <div className="followed-artists__info">
            <a className="followed-artists__name" href={`/artist/${encodeURIComponent(artist.id)}`}>{artist.name}</a>
            <p>{artist.genre ?? 'Artist'}</p>
          </div>
          <button type="button" onClick={() => void unfollow(artist)}>Following</button>
        </article>
      ))}
      <style>{`
        .followed-artists { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
        .followed-artists__card { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--ink-soft); }
        .followed-artists__avatar { display: grid; place-items: center; width: 48px; height: 48px; flex: none; border-radius: 50%; background: var(--ink-raised); color: var(--amber); font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; }
        .followed-artists__info { min-width: 0; flex: 1; }
        .followed-artists__name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
        .followed-artists__name:hover { color: var(--amber); }
        .followed-artists__info p { margin-top: 3px; color: var(--ash); font-size: 0.8rem; }
        .followed-artists__card button { padding: 8px 12px; border: 1px solid var(--line); border-radius: 999px; color: var(--ash); font-size: 0.78rem; }
        .followed-artists__card button:hover { color: var(--danger); border-color: var(--danger); }
        .followed-artists__status { padding: 20px 4px; color: var(--ash); font-size: 0.9rem; }
      `}</style>
    </div>
  );
}
