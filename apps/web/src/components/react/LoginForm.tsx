import { useState } from 'react';
import { api } from '../../lib/api';
import { MusicApiError } from '@music/api-client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.login({ email, password });
      // Full reload (not a client-side route change) so TopBar's
      // server-side api.me() re-runs against the now-set cookie.
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof MusicApiError ? err.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="auth-form__field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label className="auth-form__field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      {error && <p className="auth-form__error">{error}</p>}

      <button type="submit" className="auth-form__submit" disabled={submitting}>
        {submitting ? 'Logging in…' : 'Log in'}
      </button>

      <p className="auth-form__switch">
        No account yet? <a href="/signup">Sign up</a>
      </p>

      <style>{`
        .auth-form { display: flex; flex-direction: column; gap: 16px; }
        .auth-form__field { display: flex; flex-direction: column; gap: 6px; font-size: 0.82rem; color: var(--ash); }
        .auth-form__field input {
          background: var(--ink-raised); border: 1px solid var(--line); color: var(--paper);
          border-radius: var(--radius-s); padding: 10px 14px; font-size: 0.92rem;
          transition: border-color 0.15s ease;
        }
        .auth-form__field input:focus { border-color: var(--amber-dim); }
        .auth-form__error {
          font-size: 0.82rem; color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent); border-radius: var(--radius-s);
          padding: 10px 12px;
        }
        .auth-form__submit {
          font-size: 0.92rem; font-weight: 600; color: var(--ink-soft); background: var(--paper);
          border-radius: 999px; padding: 12px; transition: opacity 0.15s ease;
        }
        .auth-form__submit:hover:not(:disabled) { opacity: 0.85; }
        .auth-form__submit:disabled { opacity: 0.6; cursor: default; }
        .auth-form__switch { font-size: 0.82rem; color: var(--ash); text-align: center; }
        .auth-form__switch a { color: var(--amber); font-weight: 600; }
      `}</style>
    </form>
  );
}
