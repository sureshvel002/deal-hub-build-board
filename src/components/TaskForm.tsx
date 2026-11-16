import { useMemo, useState, type FormEvent } from 'react';
import type { BoardData } from '../useBoard';
import type { Phase, Profile, Stream, Task } from '../types';
import { PHASES } from '../phases';
import { STREAMS, STREAM_KEYS } from '../types';
import { explain, supabase } from '../supabase';
import { Dialog, useToast } from '../ui';

interface Props { data: BoardData; me: Profile; existing?: Task; onClose: () => void; onSaved: (id: string) => void }

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const codes = (s: string) => s.split(/[\s,]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);

/** Create a new task, or edit one you created, own, or manage. */
export default function TaskForm({ data, me, existing, onClose, onSaved }: Props) {
  const toast = useToast();
  const nextCode = useMemo(() => {
    const nums = data.tasks.map((t) => /^N-(\d+)$/.exec(t.code)?.[1]).filter(Boolean).map(Number);
    return `N-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  }, [data.tasks]);

  const [code, setCode] = useState(existing?.code ?? nextCode);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [stream, setStream] = useState<Stream | ''>(existing?.stream ?? me.stream ?? '');
  const [week, setWeek] = useState(existing?.week ? String(existing.week) : '');
  const [module, setModule] = useState(existing?.module ?? 'General');
  const [goal, setGoal] = useState(existing?.goal ?? '');
  const [phase, setPhase] = useState<Phase>(existing?.phase ?? 'Shared');
  const [story, setStory] = useState(existing?.story ?? '');
  const [backend, setBackend] = useState((existing?.backend ?? []).join('\n'));
  const [frontend, setFrontend] = useState((existing?.frontend ?? []).join('\n'));
  const [checks, setChecks] = useState((existing?.checks ?? []).join('\n'));
  const [think, setThink] = useState((existing?.think ?? []).join('\n'));
  const [acceptance, setAcceptance] = useState((existing?.acceptance ?? []).join('\n'));
  const [depends, setDepends] = useState((existing?.depends ?? []).join(', '));
  const [blocking, setBlocking] = useState(existing?.blocking ?? false);
  const isMgr = me.role === 'manager'; // a manager adds tasks for the team and does not take them
  const [assignMe, setAssignMe] = useState(!existing && !isMgr);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const c = code.trim().toUpperCase();
    if (!existing && !/^[A-Z]{1,3}-[0-9]{1,3}$/.test(c)) { setErr('Use a code like N-12: one to three capital letters, a dash, one to three digits.'); return; }
    if (title.trim().length < 3) { setErr('Give the task a title of at least 3 characters.'); return; }
    const w = week ? Number(week) : null;
    if (w != null && (!Number.isInteger(w) || w < 1 || w > 30)) { setErr('Week must be a whole number from 1 to 30.'); return; }
    const unknown = codes(depends).filter((d) => !data.tasks.some((t) => t.code === d));
    if (unknown.length) { setErr(`These task codes do not exist: ${unknown.join(', ')}.`); return; }
    const row = {
      title: title.trim(), stream: stream || null, week: w, module: module.trim() || 'General', goal: goal.trim(),
      acceptance: lines(acceptance), depends: codes(depends), blocking,
      phase, story: story.trim(), backend: lines(backend), frontend: lines(frontend), checks: lines(checks), think: lines(think),
    };
    setBusy(true);
    if (existing) {
      const { data: rows, error } = await supabase.rpc('task_update', { p_id: existing.id, p_patch: row });
      setBusy(false);
      if (error) { setErr(explain(error)); return; }
      if (!rows?.length) { setErr('You cannot edit this task.'); return; }
      toast(`${existing.code} updated.`);
      onSaved(existing.id);
    } else {
      const sort = (w ?? 0) * 100 + 99;
      const insert = { ...row, code: c, sort, ...(assignMe ? { assignee: me.id, status: 'todo' as const } : {}) };
      const { data: created, error } = await supabase.from('tasks').insert(insert).select('id').single();
      setBusy(false);
      if (error) { setErr(explain(error)); return; }
      toast(`${c} created.`);
      onSaved((created as { id: string }).id);
    }
  }

  return (
    <Dialog title={existing ? `Edit ${existing.code}` : 'New task'} onClose={onClose} wide>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="grid3">
          <div><label className="f" htmlFor="t-code">Code</label><input id="t-code" value={code} disabled={!!existing} onChange={(e) => setCode(e.target.value)} maxLength={7} /></div>
          <div><label className="f" htmlFor="t-stream">Stream</label>
            <select id="t-stream" value={stream} onChange={(e) => setStream(e.target.value as Stream | '')}>
              <option value="">No stream</option>
              {STREAM_KEYS.map((k) => <option key={k} value={k}>{STREAMS[k].name}</option>)}
            </select></div>
          <div><label className="f" htmlFor="t-phase">Phase</label>
            <select id="t-phase" value={phase} onChange={(e) => setPhase(e.target.value as Phase)}>
              {PHASES.map((p) => <option key={p.key} value={p.key}>{p.key}</option>)}
            </select></div>
          <div><label className="f" htmlFor="t-week">Week</label><input id="t-week" type="number" min={1} max={30} value={week} onChange={(e) => setWeek(e.target.value)} /></div>
        </div>
        <div><label className="f" htmlFor="t-title">Title</label><input id="t-title" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="Verb and object, for example: Add the reminder email template" /></div>
        <div className="grid2">
          <div><label className="f" htmlFor="t-module">Module</label><input id="t-module" value={module} maxLength={40} onChange={(e) => setModule(e.target.value)} /></div>
          <div><label className="f" htmlFor="t-dep">Depends on (task codes)</label><input id="t-dep" value={depends} onChange={(e) => setDepends(e.target.value)} placeholder="For example: A-01, C-03" /></div>
        </div>
        <div><label className="f" htmlFor="t-goal">Goal</label><textarea id="t-goal" maxLength={4000} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What this task delivers and why" /></div>
        <div><label className="f" htmlFor="t-story">Who uses it (user story)</label><input id="t-story" value={story} maxLength={1000} onChange={(e) => setStory(e.target.value)} placeholder="As an Immersion lead I … so that …" /></div>
        <div className="grid2">
          <div><label className="f" htmlFor="t-be">Build: backend (one per line)</label><textarea id="t-be" value={backend} onChange={(e) => setBackend(e.target.value)} placeholder={'Routes, service rules, tables, events'} /></div>
          <div><label className="f" htmlFor="t-fe">Build: frontend (one per line)</label><textarea id="t-fe" value={frontend} onChange={(e) => setFrontend(e.target.value)} placeholder={'Route, screens, empty, loading and error states'} /></div>
        </div>
        <div><label className="f" htmlFor="t-acc">Done when: acceptance checks (one per line)</label><textarea id="t-acc" value={acceptance} onChange={(e) => setAcceptance(e.target.value)} placeholder={'A denied call returns 403 and writes nothing\nThe screen passes axe'} /></div>
        <div className="grid2">
          <div><label className="f" htmlFor="t-chk">Guardrails to keep (one per line)</label><textarea id="t-chk" value={checks} onChange={(e) => setChecks(e.target.value)} placeholder={'403 for a role without the permission, and nothing is written'} /></div>
          <div><label className="f" htmlFor="t-think">Questions to answer before coding (one per line)</label><textarea id="t-think" value={think} onChange={(e) => setThink(e.target.value)} placeholder={'What happens if two people press it at once?'} /></div>
        </div>
        <label className="switch"><input type="checkbox" checked={blocking} onChange={(e) => setBlocking(e.target.checked)} /><span>Other work waits for this task</span></label>
        {!existing && !isMgr && <label className="switch"><input type="checkbox" checked={assignMe} onChange={(e) => setAssignMe(e.target.checked)} /><span>Assign it to me</span></label>}
        {err && <p className="error" role="alert">{err}</p>}
        <div className="row"><button className="b1" type="submit" disabled={busy}>{busy ? 'Saving…' : existing ? 'Save changes' : 'Create task'}</button><button className="b2" type="button" onClick={onClose}>Cancel</button></div>
      </form>
    </Dialog>
  );
}
