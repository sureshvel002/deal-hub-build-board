import { useState, type FormEvent } from 'react';
import type { Profile, Task } from '../types';
import { explain, supabase } from '../supabase';
import { Dialog, useToast } from '../ui';

/** Taking a task asks who is taking it and when it should be done. The name and title update the person's profile. */
export default function ClaimDialog({ task, me, onClose }: { task: Task; me: Profile; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(me.full_name);
  const [title, setTitle] = useState(me.title);
  const [target, setTarget] = useState(task.target_date ?? '');
  const [note, setNote] = useState('');
  const [start, setStart] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setErr('Enter your name.'); return; }
    setBusy(true); setErr(null);
    if (name.trim() !== me.full_name || title.trim() !== me.title) {
      const { error } = await supabase.rpc('profile_update', { p_patch: { full_name: name.trim(), title: title.trim() } });
      if (error) { setBusy(false); setErr(explain(error)); return; }
    }
    // p_only_unassigned makes the claim safe when two people press at once: only one row update wins.
    const { data, error } = await supabase.rpc('task_update', {
      p_id: task.id,
      p_patch: { assignee: me.id, status: start ? 'doing' : 'todo', target_date: target || null, note: note.trim() },
      p_only_unassigned: true,
    });
    setBusy(false);
    if (error) { setErr(explain(error)); return; }
    if (!data || data.length === 0) { setErr('Someone took this task a moment ago. Pick another one.'); return; }
    toast(`You took ${task.code}. The team can see it now.`);
    onClose();
  }

  return (
    <Dialog title={`Take ${task.code}`} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <p className="muted">{task.title}</p>
        <div className="grid2">
          <div><label className="f" htmlFor="c-name">Your name</label><input id="c-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required /></div>
          <div><label className="f" htmlFor="c-title">Role or title</label><input id="c-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="For example: Full-stack developer" /></div>
        </div>
        <div><label className="f" htmlFor="c-target">Planned finish date</label><input id="c-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
        <div><label className="f" htmlFor="c-note">First step or note for the team</label><textarea id="c-note" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: starting with the tests from the acceptance checks" /></div>
        <label className="switch"><input type="checkbox" checked={start} onChange={(e) => setStart(e.target.checked)} /><span>Start now (moves it to In progress)</span></label>
        {err && <p className="error" role="alert">{err}</p>}
        <div className="row"><button className="b1" type="submit" disabled={busy}>{busy ? 'Taking…' : 'Take this task'}</button><button className="b2" type="button" onClick={onClose}>Cancel</button></div>
      </form>
    </Dialog>
  );
}
