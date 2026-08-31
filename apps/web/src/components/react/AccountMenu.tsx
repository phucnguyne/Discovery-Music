import { useState } from 'react';
import { api } from '../../lib/api';
import type { User } from '@music/types';

interface Props {
  /** Rendered server-side by TopBar.astro (api.me() with the request's
   * cookie forwarded) — no client-side fetch needed just to paint this. */
  user: User | null;
}

export default function AccountMenu({ user }: Props) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } finally {
      // Full reload, not a client-side route change: every page does its
      // own server-side api.me() check (TopBar, /login, /signup), and a
      // reload is the simplest way to make all of them re-agree with the
      // now-cleared cookie in one shot.
      window.location.href = '/';
    }
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
