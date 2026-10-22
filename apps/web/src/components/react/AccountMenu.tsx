import { useEffect, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
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
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-menu__trigger"
        aria-label={`Open account menu for ${user.displayName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span className="account-menu__avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <nav className="account-menu__dropdown" role="menu" aria-label="Account">
          <a role="menuitem" href="/profile">Profile</a>
          <a role="menuitem" href="/favorites">Likes</a>
          <a role="menuitem" href="/following">Following</a>
          <a role="menuitem" href="/account">Account settings</a>
          <div className="account-menu__separator" />
          <button role="menuitem" type="button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </nav>
      )}
      <style>{`
        .account-menu { position: relative; display: flex; align-items: center; flex: none; }
        .account-menu__trigger { display: flex; align-items: center; gap: 8px; padding: 3px; color: var(--ash); border-radius: 999px; }
        .account-menu__trigger:hover { color: var(--paper); }
        .account-menu__avatar {
          width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center;
          background: var(--ink-raised); color: var(--amber); font-family: var(--font-display);
          font-size: 0.85rem; font-weight: 600; flex: none; transition: background 0.15s ease;
        }
        .account-menu__dropdown { position: absolute; z-index: 50; top: calc(100% + 10px); right: 0; width: 210px; padding: 8px; background: var(--ink-soft); border: 1px solid var(--line); border-radius: var(--radius-m); box-shadow: var(--shadow-card); }
        .account-menu__dropdown a, .account-menu__dropdown button { display: block; width: 100%; padding: 10px 12px; border-radius: var(--radius-s); text-align: left; font-size: 0.86rem; color: var(--paper); }
        .account-menu__dropdown a:hover, .account-menu__dropdown button:hover:not(:disabled) { background: var(--ink-raised); color: var(--amber); }
        .account-menu__dropdown button:disabled { opacity: 0.5; cursor: default; }
        .account-menu__separator { height: 1px; margin: 6px 4px; background: var(--line); }
      `}</style>
    </div>
  );
}