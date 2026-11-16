import { useState, type FormEvent } from 'react';
import { allowSignup, explain, supabase } from '../supabase';

export default function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (mode === 'up' && password.length < 10) { setMsg({ kind: 'err', text: 'Use a password of at least 10 characters.' }); return; }
    setBusy(true);
    const res = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (res.error) { setMsg({ kind: 'err', text: explain(res.error) }); return; }
    if (mode === 'up' && !res.data.session) setMsg({ kind: 'ok', text: 'Account created. Check your email to confirm it, then sign in.' });
  }

  return (
    <main className="center-page">
      <form className="card auth" onSubmit={submit} noValidate>
        <div className="brand"><span className="logo" aria-hidden="true">DH</span>Deal Hub Build Board</div>
        <h1>{mode === 'in' ? 'Sign in' : 'Create your account'}</h1>
        <p className="muted">The shared task board for the Deal Hub build team.</p>
        <label className="f" htmlFor="email">Work email</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="f" htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
        {msg && <p className={msg.kind === 'err' ? 'error' : 'okmsg'} role="alert">{msg.text}</p>}
        <button className="b1" type="submit" disabled={busy || !email || !password}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        {allowSignup ? (
          <button className="b3" type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}>
            {mode === 'in' ? 'New here? Create an account' : 'I have an account. Sign in'}
          </button>
        ) : (
          <p className="muted small">No account yet? Ask the manager to add you.</p>
        )}
      </form>
    </main>
  );
}
