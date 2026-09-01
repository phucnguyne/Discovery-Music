import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { User } from '@music/types';

export default function AccountMenu() {
  // No server-rendered initial state: apps/api and apps/web are on
  // different domains in production, so a browser navigating to
  // apps/web never sends apps/api's session cookie along — Astro's SSR
  // has no way to know who's logged in. This has to be a client-side
  // fetch (the browser DOES hold and send apps/api's cookie once it's
  // asked to, via credentials:'include'), which means every page load
  // briefly shows "logged out" before this resolves — acceptable
  // tradeoff for two services on separate onrender.com subdomains with
  // no shared parent domain to scope a cookie to.
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.me().then((u) => {
      if (!cancelled) {
        setUser(u);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } finally {
      window.location.href = '/';
    }
  }

  // Nothing rendered until the check resolves — a beat of blank space
  // reads better than a flash of "Log in" that then flips to a name.
  if (!loaded) {
    return (
      <div className="account-menu account-menu--placeholder" aria-hidden="true">
        <style>{`.account-menu--placeholder { display: inline-block; width: 130px; height: 30px; flex: none; }`}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="account-menu">
        <a href="/login" className="account-menu__link">
          Log in
        </a>
        <a href="/signup" className="account-menu__cta">
          Sign up
        </a>
        <style>{`
          .account-menu { display: flex; align-items: center; gap: 8px; flex: none; }
          .account-menu__link { font-size: 0.85rem; color: var(--ash); padding: 8px 14px; border-radius: 999px; transition: color 0.15s ease; }
          .account-menu__link:hover { color: var(--paper); }
          .account-menu__cta { font-size: 0.85rem; font-weight: 600; color: var(--ink-soft); background: var(--paper); padding: 8px 16px; border-radius: 999px; transition: opacity 0.15s ease; }
          .account-menu__cta:hover { opacity: 0.85; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="account-menu">
      <a href="/account" className="account-menu__avatar" aria-label="My account">
        {user.displayName.slice(0, 1).toUpperCase()}
      </a>
      <a href="/account" className="account-menu__name">
        {user.displayName}
      </a>
      <button type="button" className="account-menu__logout" onClick={handleLogout} disabled={loggingOut}>
        {loggingOut ? 'Logging out…' : 'Log out'}
      </button>
      <style>{`
        .account-menu { display: flex; align-items: center; gap: 10px; flex: none; }
        .account-menu__avatar {
          width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center;
          background: var(--ink-raised); color: var(--amber); font-family: var(--font-display);
          font-size: 0.85rem; font-weight: 600; flex: none; transition: background 0.15s ease;
        }
        .account-menu__avatar:hover { background: var(--line); }
        .account-menu__name { font-size: 0.85rem; color: var(--paper); font-weight: 600; white-space: nowrap; transition: color 0.15s ease; }
        .account-menu__name:hover { color: var(--amber); }
        .account-menu__logout { font-size: 0.78rem; font-family: var(--font-mono); color: var(--ash); padding: 4px 2px; border-bottom: 1px solid transparent; transition: color 0.15s ease, border-color 0.15s ease; }
        .account-menu__logout:hover:not(:disabled) { color: var(--amber); border-color: var(--amber-dim); }
        .account-menu__logout:disabled { opacity: 0.5; cursor: default; }
        @media (max-width: 640px) { .account-menu__name { display: none; } }
      `}</style>
    </div>
  );
}