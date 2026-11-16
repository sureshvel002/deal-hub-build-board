import { useState, type FormEvent } from 'react';
import { explain, supabase } from '../supabase';
import type { Profile, Stream } from '../types';
import { STREAMS, STREAM_KEYS } from '../types';

interface Props { userId: string; existing?: Profile; onSaved: () => void; onCancel?: () => void }

/** Asked once after the first sign-in, and from "Edit profile". Name and details show on every task the person takes. */
export default function ProfileForm({ userId, existing, onSaved, onCancel }: Props) {
  const [name, setName] = useState(existing?.full_name ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [stream, setStream] = useState<Stream | ''>(existing?.stream ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setErr('Enter your name (at least 2 characters).'); return; }
    setBusy(true); setErr(null);
    const row = { id: userId, full_name: name.trim(), title: title.trim(), stream: stream || null };
    const { error } = existing
      ? await supabase.rpc('profile_update', { p_patch: row })
      : await supabase.from('profiles').insert(row);
    setBusy(false);
    if (error) { setErr(explain(error)); return; }
    onSaved();
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {!existing && <p className="muted">Tell the team who you are. Your name shows on every task you take.</p>}
      <div>
        <label className="f" htmlFor="pf-name">Your name</label>
        <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" required />
      </div>
      <div>
        <label className="f" htmlFor="pf-title">Role or title</label>
        <input id="pf-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="For example: Full-stack developer" />
      </div>
      <div>
        <label className="f" htmlFor="pf-stream">Your stream</label>
        <select id="pf-stream" value={stream} onChange={(e) => setStream(e.target.value as Stream | '')}>
          <option value="">No stream (manager or reviewer)</option>
          {STREAM_KEYS.map((k) => <option key={k} value={k}>{STREAMS[k].name} · {STREAMS[k].area}</option>)}
        </select>
      </div>
      {existing && <p className="muted small">Access level: {existing.role === 'manager' ? 'Manager' : 'Developer'}. Only an admin can change it.</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <div className="row">
        <button className="b1" type="submit" disabled={busy}>{busy ? 'Saving…' : existing ? 'Save profile' : 'Continue to the board'}</button>
        {onCancel && <button className="b2" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
