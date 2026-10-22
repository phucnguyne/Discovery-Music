import { useEffect, useState } from 'react';
import { MusicApiError } from '@music/api-client';
import type { FavoriteTrack, FollowedArtist, RecentlyPlayedTrack, User } from '@music/types';
import { api } from '../../lib/api';
import { thumbSrc } from '../../lib/format';
import ArtistNames from './ArtistNames';

interface ProfileData {
  favorites: FavoriteTrack[];
  followedArtists: FollowedArtist[];
  recentlyPlayed: RecentlyPlayedTrack[];
}

export default function ProfileOverview() {
  const [user, setUser] = useState<User | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.me().then(async (currentUser) => {
      if (cancelled) return;
      if (!currentUser) {
        window.location.href = '/login';
        return;
      }
      setUser(currentUser);

      const results = await Promise.allSettled([
        api.favorites(),
        api.followedArtists(),
        api.recentlyPlayed(),
      ]);
      if (cancelled) return;

      const [favorites, followedArtists, recentlyPlayed] = results;
      if (favorites.status === 'fulfilled' && followedArtists.status === 'fulfilled' && recentlyPlayed.status === 'fulfilled') {
        setProfileData({
          favorites: favorites.value,
          followedArtists: followedArtists.value,
          recentlyPlayed: recentlyPlayed.value,
        });
      } else {
        const failedResult = results.find((result) => result.status === 'rejected');
        setError(
          failedResult?.status === 'rejected' && failedResult.reason instanceof MusicApiError
            ? failedResult.reason.message
            : 'Some profile information could not be loaded.',
        );
        setProfileData({
          favorites: favorites.status === 'fulfilled' ? favorites.value : [],
          followedArtists: followedArtists.status === 'fulfilled' ? followedArtists.value : [],
          recentlyPlayed: recentlyPlayed.status === 'fulfilled' ? recentlyPlayed.value : [],
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return <p className="profile-overview__status">Loading your profile…</p>;

  const initial = user.displayName.trim().slice(0, 1).toUpperCase();
  const memberSince = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(user.createdAt));

  return (
    <div className="profile-overview">
      <section className="profile-hero">
        <div className="profile-hero__identity">
          <div className="profile-hero__avatar" aria-hidden="true">{initial}</div>
          <div className="profile-hero__copy">
            <p className="profile-hero__eyebrow">Your listening profile</p>
            <h2>{user.displayName}</h2>
            <p className="profile-hero__email">{user.email}</p>
            <p className="profile-hero__member">Member since {memberSince}</p>
          </div>
        </div>
        <a className="profile-hero__settings" href="/account">
          Edit account
          <span aria-hidden="true">↗</span>
        </a>
      </section>

      {error && <p className="profile-overview__error" role="status">{error}</p>}

      <section className="profile-library" aria-labelledby="profile-library-title">
        <div className="profile-section-head">
          <div>
            <p className="profile-section-head__eyebrow">Your collection</p>
            <h2 id="profile-library-title">Your library</h2>
          </div>
        </div>
        <div className="profile-library__grid">
          <a className="profile-stat profile-stat--likes" href="/favorites">
            <span className="profile-stat__icon" aria-hidden="true">♡</span>
            <span className="profile-stat__label">Liked songs</span>
            <strong>{profileData?.favorites.length ?? '—'}</strong>
            <span className="profile-stat__action">Open your likes <span aria-hidden="true">→</span></span>
          </a>
          <a className="profile-stat profile-stat--following" href="/following">
            <span className="profile-stat__icon" aria-hidden="true">♫</span>
            <span className="profile-stat__label">Following</span>
            <strong>{profileData?.followedArtists.length ?? '—'}</strong>
            <span className="profile-stat__action">View artists <span aria-hidden="true">→</span></span>
          </a>
          <a className="profile-stat profile-stat--played" href="/recently-played">
            <span className="profile-stat__icon" aria-hidden="true">◷</span>
            <span className="profile-stat__label">Recently played</span>
            <strong>{profileData?.recentlyPlayed.length ?? '—'}</strong>
            <span className="profile-stat__action">Listening history <span aria-hidden="true">→</span></span>
          </a>
        </div>
      </section>

      <section className="profile-recent" aria-labelledby="profile-recent-title">
        <div className="profile-section-head">
          <div>
            <p className="profile-section-head__eyebrow">Back to the music</p>
            <h2 id="profile-recent-title">Recently played</h2>
          </div>
          <a className="profile-section-head__link" href="/recently-played">See history <span aria-hidden="true">→</span></a>
        </div>
        {!profileData ? (
          <p className="profile-overview__status">Loading listening history…</p>
        ) : profileData.recentlyPlayed.length === 0 ? (
          <div className="profile-recent__empty">
            <span aria-hidden="true">♫</span>
            <p>Your listening history will appear here after you play a song.</p>
            <a href="/">Explore music</a>
          </div>
        ) : (
          <ul className="profile-recent__list">
            {profileData.recentlyPlayed.slice(0, 5).map((track, index) => (
              <li className="profile-recent__item" key={`${track.id}-${track.playedAt}`}>
                <span className="profile-recent__index">{String(index + 1).padStart(2, '0')}</span>
                <img src={thumbSrc(track.coverUrl)} alt="" width={48} height={48} loading="lazy" />
                <div className="profile-recent__meta">
                  <span className="profile-recent__title">{track.title}</span>
                  <ArtistNames className="profile-recent__artist" name={track.artistName} artistId={track.artistId} />
                </div>
                <a className="profile-recent__open" href={`/artist/${encodeURIComponent(track.artistId)}`} aria-label={`View ${track.artistName}`}>
                  <span aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="profile-preferences" aria-label="Profile shortcuts">
        <a href="/account">
          <span className="profile-preferences__icon" aria-hidden="true">⚙</span>
          <span><strong>Account settings</strong><small>Update your profile and password</small></span>
          <span className="profile-preferences__arrow" aria-hidden="true">→</span>
        </a>
        <a href="/following">
          <span className="profile-preferences__icon" aria-hidden="true">♫</span>
          <span><strong>Your artists</strong><small>Manage the artists you follow</small></span>
          <span className="profile-preferences__arrow" aria-hidden="true">→</span>
        </a>
      </section>

      <style>{`
        .profile-overview { display: grid; gap: 30px; }
        .profile-hero { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 208px; padding: 32px 36px; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius-l); background: linear-gradient(120deg, var(--ink-soft) 0%, var(--ink-raised) 70%, color-mix(in srgb, var(--amber) 12%, var(--ink-soft)) 100%); box-shadow: var(--shadow-card); }
        .profile-hero::after { content: ''; position: absolute; right: 15%; top: -120px; width: 300px; height: 300px; border: 1px solid color-mix(in srgb, var(--amber) 16%, transparent); border-radius: 50%; box-shadow: 0 0 0 26px color-mix(in srgb, var(--amber) 4%, transparent), 0 0 0 54px color-mix(in srgb, var(--amber) 3%, transparent); pointer-events: none; }
        .profile-hero__identity { position: relative; z-index: 1; display: flex; align-items: center; gap: 24px; min-width: 0; }
        .profile-hero__avatar { display: grid; place-items: center; width: 104px; height: 104px; flex: none; border: 5px solid var(--ink-soft); border-radius: 50%; background: var(--ink-raised); color: var(--amber); font-family: var(--font-display); font-size: 2.7rem; font-weight: 700; box-shadow: var(--shadow-edge); }
        .profile-hero__copy { min-width: 0; }
        .profile-hero__eyebrow, .profile-section-head__eyebrow { color: var(--amber); font-family: var(--font-mono); font-size: 0.67rem; letter-spacing: 0.13em; text-transform: uppercase; }
        .profile-hero h2 { margin-top: 7px; font-size: clamp(1.65rem, 3vw, 2.3rem); overflow-wrap: anywhere; }
        .profile-hero__email { margin-top: 6px; color: var(--ash); font-size: 0.88rem; overflow-wrap: anywhere; }
        .profile-hero__member { margin-top: 14px; color: var(--ash-dim); font-family: var(--font-mono); font-size: 0.69rem; }
        .profile-hero__settings { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 9px; flex: none; padding: 10px 15px; border: 1px solid var(--line); border-radius: 999px; background: color-mix(in srgb, var(--ink-soft) 76%, transparent); color: var(--paper); font-size: 0.8rem; font-weight: 600; }
        .profile-hero__settings:hover { border-color: var(--amber); color: var(--amber); }
        .profile-section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 15px; }
        .profile-section-head h2 { margin-top: 5px; font-size: 1.35rem; }
        .profile-section-head__link { color: var(--ash); font-size: 0.8rem; white-space: nowrap; }
        .profile-section-head__link:hover { color: var(--amber); }
        .profile-library__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .profile-stat { position: relative; display: flex; flex-direction: column; min-height: 176px; padding: 20px; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--ink-soft); transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease; }
        .profile-stat:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--amber) 50%, var(--line)); box-shadow: var(--shadow-card); }
        .profile-stat__icon { position: absolute; top: 15px; right: 18px; color: color-mix(in srgb, var(--amber) 72%, var(--ash)); font-size: 1.35rem; }
        .profile-stat__label { color: var(--ash); font-size: 0.78rem; font-weight: 600; }
        .profile-stat strong { margin-top: 16px; font-family: var(--font-display); font-size: 2.1rem; line-height: 1; }
        .profile-stat__action { display: flex; justify-content: space-between; gap: 6px; margin-top: auto; padding-top: 16px; color: var(--ash-dim); font-size: 0.72rem; }
        .profile-stat:hover .profile-stat__action { color: var(--amber); }
        .profile-recent { min-width: 0; }
        .profile-recent__list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
        .profile-recent__item { display: grid; grid-template-columns: 28px 48px minmax(0, 1fr) 32px; align-items: center; gap: 13px; min-height: 70px; padding: 9px 12px; border-bottom: 1px solid var(--line); transition: background 0.15s ease; }
        .profile-recent__item:hover { background: var(--ink-soft); }
        .profile-recent__index { color: var(--ash-dim); font-family: var(--font-mono); font-size: 0.72rem; text-align: right; }
        .profile-recent__item img { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; }
        .profile-recent__meta { min-width: 0; }
        .profile-recent__title, .profile-recent__artist { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .profile-recent__title { font-size: 0.88rem; font-weight: 600; }
        .profile-recent__artist { margin-top: 4px; color: var(--ash); font-size: 0.77rem; }
        .profile-recent__artist a:hover { color: var(--amber); text-decoration: underline; text-underline-offset: 3px; }
        .profile-recent__open { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; color: var(--ash); }
        .profile-recent__open:hover { background: var(--ink-raised); color: var(--amber); }
        .profile-recent__empty { display: grid; justify-items: center; gap: 9px; padding: 28px; border: 1px dashed var(--line); border-radius: var(--radius-m); color: var(--ash); text-align: center; }
        .profile-recent__empty > span { color: var(--amber); font-size: 1.5rem; }
        .profile-recent__empty p { font-size: 0.85rem; }
        .profile-recent__empty a { margin-top: 3px; color: var(--amber); font-size: 0.8rem; font-weight: 600; }
        .profile-preferences { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .profile-preferences > a { display: grid; grid-template-columns: 40px minmax(0, 1fr) 20px; align-items: center; gap: 12px; padding: 16px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--ink-soft); }
        .profile-preferences > a:hover { border-color: color-mix(in srgb, var(--amber) 50%, var(--line)); }
        .profile-preferences__icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--ink-raised); color: var(--amber); font-size: 1.1rem; }
        .profile-preferences strong, .profile-preferences small { display: block; }
        .profile-preferences strong { font-size: 0.82rem; }
        .profile-preferences small { margin-top: 4px; color: var(--ash); font-size: 0.72rem; }
        .profile-preferences__arrow { color: var(--ash); }
        .profile-preferences > a:hover .profile-preferences__arrow { color: var(--amber); }
        .profile-overview__status { color: var(--ash); font-size: 0.9rem; }
        .profile-overview__error { padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent); border-radius: var(--radius-s); color: var(--danger); font-size: 0.8rem; }
        @media (max-width: 720px) {
          .profile-hero { align-items: flex-start; flex-direction: column; padding: 24px; }
          .profile-hero__avatar { width: 78px; height: 78px; font-size: 2rem; }
          .profile-hero__identity { gap: 16px; }
          .profile-library__grid { grid-template-columns: 1fr; }
          .profile-stat { min-height: 132px; }
          .profile-preferences { grid-template-columns: 1fr; }
        }
        @media (max-width: 420px) {
          .profile-hero { padding: 20px; }
          .profile-hero__identity { align-items: flex-start; flex-direction: column; }
          .profile-recent__item { grid-template-columns: 22px 42px minmax(0, 1fr) 28px; gap: 9px; padding-inline: 6px; }
          .profile-recent__item img { width: 42px; height: 42px; }
          .profile-recent__index { font-size: 0.65rem; }
        }
      `}</style>
    </div>
  );
}
