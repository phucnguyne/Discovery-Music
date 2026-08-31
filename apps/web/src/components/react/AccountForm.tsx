import { useState } from 'react';
import { api } from '../../lib/api';
import { MusicApiError } from '@music/api-client';
import type { User } from '@music/types';

interface Props {
  user: User;
}

export default function AccountForm({ user }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName);
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
      await api.updateAccount({ displayName: displayName.trim() });
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
    <div className="account-forms">
      <form className="auth-form" onSubmit={onSaveName}>
        <h2 className="account-forms__heading">Display name</h2>
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
          disabled={nameStatus === 'saving' || displayName.trim() === user.displayName || !displayName.trim()}
        >
          {nameStatus === 'saving' ? 'Saving…' : 'Save name'}
        </button>
      </form>

      <form className="auth-form" onSubmit={onSavePassword}>
        <h2 className="account-forms__heading">Change password</h2>
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

      <style>{`
        .account-forms { display: flex; flex-direction: column; gap: 32px; }
        .account-forms__heading { font-size: 1.05rem; margin-bottom: 4px; }
        .auth-form { display: flex; flex-direction: column; gap: 16px; }
        .auth-form__field { display: flex; flex-direction: column; gap: 6px; font-size: 0.82rem; color: var(--ash); }
        .auth-form__field input {
          background: var(--ink-raised); border: 1px solid var(--line); color: var(--paper);
          border-radius: var(--radius-s); padding: 10px 14px; font-size: 0.92rem;
          transition: border-color 0.15s ease;
        }
        .auth-form__field input:focus { border-color: var(--amber-dim); }
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
          font-size: 0.9rem; font-weight: 600; color: var(--ink-soft); background: var(--paper);
          border-radius: 999px; padding: 11px; transition: opacity 0.15s ease; align-self: flex-start; padding-left: 22px; padding-right: 22px;
        }
        .auth-form__submit:hover:not(:disabled) { opacity: 0.85; }
        .auth-form__submit:disabled { opacity: 0.5; cursor: default; }
      `}</style>
    </div>
  );
}
