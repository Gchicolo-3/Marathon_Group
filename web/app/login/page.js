'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = '/';
    } else {
      setError('Incorrect password');
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <h1>Marathon Group CRM</h1>
      <div className="panel">
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <button className="primary" type="submit" disabled={busy || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p className="flash err">{error}</p>}
        </form>
      </div>
    </div>
  );
}
