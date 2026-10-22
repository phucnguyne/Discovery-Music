import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { MusicApiError } from '@music/api-client';
import type { User } from '@music/types';

export default function AccountForm() {
  // Same reasoning as AccountMenu: apps/api and apps/web are different
  // domains in prod, so Astro's SSR (account.astro) can never know who's
  // logged in — this page has to gate itself client-side instead.
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.me().then((u) => {
      if (cancelled) return;
      if (!u) {
        window.location.href = '/login';
        return;
      }
      setUser(u);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !user) {
    return <p className="account-forms__loading" role="status">Loading your account…</p>;
  }

  return <AccountFormFields user={user} />;
}

function AccountFormFields({ user }: { user: User }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [savedName, setSavedName] = useState(user.displayName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [nameError, setNameError] = useState<string | null>(null);

  const [pwStatus, setPwStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pwError, setPwError] = useState<string | null>(null);

  async function onSaveName(e: { preventDefault(): void }) {
    e.preventDefault();
    if (displayName.trim() === user.displayName) return;
    setNameStatus('saving');
    setNameError(null);
    try {
      const updatedUser = await api.updateAccount({ displayName: displayName.trim() });
      setSavedName(updatedUser.displayName);
      setNameStatus('saved');
    } catch (err) {
      setNameStatus('error');
      setNameError(err instanceof MusicApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  async function onSavePassword(e: { preventDefault(): void }) {
    e.preventDefault();
    setPwStatus('saving');
    setPwError(null);
    try {
      await api.updateAccount({ currentPassword, newPassword });
      setPwStatus('saved');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwStatus('error');
      setPwError(err instanceof MusicApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <div className="account-settings">
      <section className="account-hero" aria-labelledby="account-hero-title">
        <div className="account-hero__identity">
          <div className="account-hero__avatar" aria-hidden="true">{savedName.trim().slice(0, 1).toUpperCase()}</div>
          <div className="account-hero__copy">
            <p className="account-hero__eyebrow">Your account</p>
            <h2 id="account-hero-title">{savedName}</h2>
            <p className="account-hero__email">{user.email}</p>
            <p className="account-hero__description">Manage your profile details and keep your account secure.</p>
          </div>
        </div>
        <a className="account-hero__profile-link" href="/profile">
          View profile <span aria-hidden="true">↗</span>
        </a>
      </section>

      <section className="account-details" aria-labelledby="account-details-title">
        <div className="account-section-head">
          <div>
            <p className="account-section-head__eyebrow">Personalize and secure</p>
            <h2 id="account-details-title">Account details</h2>
          </div>
        </div>
        <div className="account-forms">
      <form className="auth-form" onSubmit={onSaveName}>
        <div className="auth-form__intro">
          <span className="auth-form__icon" aria-hidden="true">◎</span>
          <div>
            <h2 className="account-forms__heading">Profile details</h2>
            <p>Choose how your name appears around your library.</p>
          </div>
        </div>
        <label className="auth-form__field">
          <span>Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setNameStatus('idle');
            }}
            maxLength={60}
            required
          />
        </label>

        {nameStatus === 'error' && nameError && <p className="auth-form__error">{nameError}</p>}
        {nameStatus === 'saved' && <p className="auth-form__success">Saved.</p>}

        <button
          type="submit"
          className="auth-form__submit"
          disabled={nameStatus === 'saving' || displayName.trim() === savedName || !displayName.trim()}
        >
          {nameStatus === 'saving' ? 'Saving…' : 'Save name'}
        </button>
      </form>

      <form className="auth-form" onSubmit={onSavePassword}>
        <div className="auth-form__intro">
          <span className="auth-form__icon" aria-hidden="true">⌑</span>
          <div>
            <h2 className="account-forms__heading">Password & security</h2>
            <p>Use a strong password to help protect your account.</p>
          </div>
        </div>
        <label className="auth-form__field">
          <span>Current password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setPwStatus('idle');
            }}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="auth-form__field">
          <span>New password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPwStatus('idle');
            }}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />
          <span className="auth-form__hint">At least 8 characters, with a letter and a number.</span>
        </label>

        {pwStatus === 'error' && pwError && <p className="auth-form__error">{pwError}</p>}
        {pwStatus === 'saved' && <p className="auth-form__success">Password updated.</p>}

        <button
          type="submit"
          className="auth-form__submit"
          disabled={pwStatus === 'saving' || !currentPassword || !newPassword}
        >
          {pwStatus === 'saving' ? 'Updating…' : 'Update password'}
        </button>
      </form>
        </div>
      </section>
      <p className="account-settings__note">
        <span aria-hidden="true">ⓘ</span>
        Your account information is private and only used to personalize your music experience.
      </p>

      <style>{`
        .account-forms__loading { padding: 24px; border: 1px dashed var(--line); border-radius: var(--radius-m); color: var(--ash); font-size: 0.9rem; }
        .account-settings { display: grid; gap: 30px; }
        .account-hero { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 190px; padding: 30px 34px; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius-l); background: linear-gradient(120deg, var(--ink-soft) 0%, var(--ink-raised) 70%, color-mix(in srgb, var(--amber) 12%, var(--ink-soft)) 100%); box-shadow: var(--shadow-card); }
        .account-hero::after { content: ''; position: absolute; right: 15%; top: -140px; width: 300px; height: 300px; border: 1px solid color-mix(in srgb, var(--amber) 16%, transparent); border-radius: 50%; box-shadow: 0 0 0 26px color-mix(in srgb, var(--amber) 4%, transparent), 0 0 0 54px color-mix(in srgb, var(--amber) 3%, transparent); pointer-events: none; }
        .account-hero__identity { position: relative; z-index: 1; display: flex; align-items: center; gap: 22px; min-width: 0; }
        .account-hero__avatar { display: grid; place-items: center; width: 92px; height: 92px; flex: none; border: 5px solid var(--ink-soft); border-radius: 50%; background: var(--ink-raised); color: var(--amber); font-family: var(--font-display); font-size: 2.4rem; font-weight: 700; box-shadow: var(--shadow-edge); }
        .account-hero__copy { min-width: 0; }
        .account-hero__eyebrow, .account-section-head__eyebrow { color: var(--amber); font-family: var(--font-mono); font-size: 0.67rem; letter-spacing: 0.13em; text-transform: uppercase; }
        .account-hero h2 { margin-top: 6px; font-family: var(--font-display); font-size: clamp(1.55rem, 3vw, 2.1rem); overflow-wrap: anywhere; }
        .account-hero__email { margin-top: 5px; color: var(--ash); font-size: 0.84rem; overflow-wrap: anywhere; }
        .account-hero__description { margin-top: 12px; color: var(--ash-dim); font-size: 0.78rem; line-height: 1.5; }
        .account-hero__profile-link { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 9px; flex: none; padding: 10px 15px; border: 1px solid var(--line); border-radius: 999px; background: color-mix(in srgb, var(--ink-soft) 76%, transparent); color: var(--paper); font-size: 0.8rem; font-weight: 600; }
        .account-hero__profile-link:hover { border-color: var(--amber); color: var(--amber); }
        .account-section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 15px; }
        .account-section-head h2 { margin-top: 5px; font-family: var(--font-display); font-size: 1.35rem; }
        .account-forms { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; gap: 14px; }
        .account-forms__heading { font-size: 1rem; }
        .auth-form { display: flex; min-width: 0; flex-direction: column; gap: 18px; padding: 22px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--ink-soft); transition: border-color 0.16s ease, box-shadow 0.16s ease; }
        .auth-form:hover { border-color: color-mix(in srgb, var(--amber) 35%, var(--line)); box-shadow: var(--shadow-edge); }
        .auth-form__intro { display: flex; align-items: flex-start; gap: 12px; }
        .auth-form__intro p { margin-top: 5px; color: var(--ash); font-size: 0.77rem; line-height: 1.5; }
        .auth-form__icon { display: grid; width: 38px; height: 38px; flex: none; place-items: center; border-radius: 12px; background: var(--ink-raised); color: var(--amber); font-size: 1.25rem; }
        .auth-form__field { display: flex; flex-direction: column; gap: 6px; font-size: 0.82rem; color: var(--ash); }
        .auth-form__field input {
          width: 100%;
          min-width: 0;
          background: var(--ink-raised); border: 1px solid var(--line); color: var(--paper);
          border-radius: var(--radius-s); padding: 12px 13px; font-size: 16px;
          transition: border-color 0.15s ease;
        }
        .auth-form__field input:focus { border-color: var(--amber-dim); }
        .auth-form__field input:focus-visible { outline-offset: 2px; }
        .auth-form__hint { font-size: 0.74rem; color: var(--ash-dim); }
        .auth-form__error {
          font-size: 0.82rem; color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent); border-radius: var(--radius-s);
          padding: 10px 12px;
        }
        .auth-form__success {
          font-size: 0.82rem; color: var(--amber-dim); background: color-mix(in srgb, var(--amber) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--amber) 30%, transparent); border-radius: var(--radius-s);
          padding: 10px 12px;
        }
        .auth-form__submit {
          min-height: 42px; font-size: 0.84rem; font-weight: 600; color: var(--ink-soft); background: var(--amber);
          border-radius: 999px; padding: 10px 20px; transition: opacity 0.15s ease, transform 0.15s ease; align-self: flex-start;
        }
        .auth-form__submit:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .auth-form__submit:disabled { color: var(--ash-dim); background: var(--ink-raised); cursor: default; }
        .account-settings__note { display: flex; align-items: flex-start; gap: 8px; max-width: 680px; margin-top: -12px; color: var(--ash-dim); font-size: 0.76rem; line-height: 1.6; }
        .account-settings__note span { color: var(--amber); }
        @media (max-width: 760px) {
          .account-settings { gap: 24px; }
          .account-hero { align-items: flex-start; flex-direction: column; padding: 24px; }
          .account-hero__identity { gap: 16px; }
          .account-hero__avatar { width: 76px; height: 76px; font-size: 2rem; }
          .account-forms { grid-template-columns: 1fr; gap: 14px; }
          .auth-form { padding: 20px; }
          .auth-form__submit { min-height: 44px; }
        }
        @media (max-width: 380px) {
          .account-hero { padding: 18px; }
          .account-hero__identity { align-items: flex-start; flex-direction: column; }
          .account-hero__description { font-size: 0.75rem; }
          .auth-form { padding: 16px; gap: 16px; }
          .auth-form__intro { gap: 10px; }
          .auth-form__icon { width: 34px; height: 34px; }
        }
      `}</style>
    </div>
  );
}