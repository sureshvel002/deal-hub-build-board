import { useState, type FormEvent } from 'react';
import { explain, supabase } from '../supabase';
import { useToast } from '../ui';

const MIN = 8;

/**
 * Lets a signed-in person replace the password they were given. The database checks the current password first.
 * In the profile dialog it sits folded under "Change password". With onSkip it is the open, skippable step shown
 * right after the first profile set-up.
 */
export default function PasswordForm({ onDone, onSkip }: { onDone?: () => void; onSkip?: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!current) { setErr('Enter your current password.'); return; }
    if (next.length < MIN) { setErr(`The new password needs at least ${MIN} characters.`); return; }
    if (next === current) { setErr('Choose a password different from the current one.'); return; }
    if (next !== again) { setErr('The two new passwords do not match.'); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('change_password', { p_current: current, p_new: next });
    setBusy(false);
    if (error) { setErr(explain(error)); return; }
    setCurrent(''); setNext(''); setAgain('');
    toast('Your password is changed. Use it the next time you sign in.');
    onDone?.();
  }

  const form = (
    <form className="stack" onSubmit={submit} noValidate>
      <div>
        <label className="f" htmlFor="pw-current">{onSkip ? 'Password you were given' : 'Current password'}</label>
        <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="grid2">
        <div>
          <label className="f" htmlFor="pw-new">New password</label>
          <input id="pw-new" type="password" autoComplete="new-password" minLength={MIN} value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div>
          <label className="f" htmlFor="pw-again">New password again</label>
          <input id="pw-again" type="password" autoComplete="new-password" minLength={MIN} value={again} onChange={(e) => setAgain(e.target.value)} required />
        </div>
      </div>
      <p className="muted small">At least {MIN} characters. You stay signed in on this device.</p>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="row">
        <button className={onSkip ? 'b1' : 'b2'} type="submit" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</button>
        {onSkip && <button className="b2" type="button" disabled={busy} onClick={onSkip}>Skip for now</button>}
      </div>
    </form>
  );

  if (onSkip) return form;
  return (
    <details>
      <summary>Change password</summary>
      <div style={{ marginTop: 10 }}>{form}</div>
    </details>
  );
}
