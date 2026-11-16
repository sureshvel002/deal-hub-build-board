import { useEffect, useState } from 'react';
import type { BoardData } from '../useBoard';
import type { Profile, Status, Task, TaskEvent } from '../types';
import { STATUSES, STATUS_LABEL, STREAMS, weekLabel } from '../types';
import { explain, supabase } from '../supabase';
import { briefSections, copyText, hasApproach, taskBrief } from '../brief';
import { PHASE_OF } from '../phases';
import { Avatar, StatusChip, ago, useToast } from '../ui';
import ClaimDialog from './ClaimDialog';
import TaskForm from './TaskForm';

interface Props { task: Task; data: BoardData; me: Profile; byCode: Record<string, Task>; onClose: () => void; onOpen: (id: string) => void }

export default function TaskPanel({ task: t, data, me, byCode, onClose, onOpen }: Props) {
  const toast = useToast();
  const who = t.assignee ? data.profiles[t.assignee] : undefined;
  const isMgr = me.role === 'manager';
  const isMine = t.assignee === me.id;
  const canEdit = isMgr || isMine || t.created_by === me.id;
  const canDelete = isMgr || (t.created_by === me.id && !t.assignee);

  const [status, setStatus] = useState<Status>(t.status);
  const [pr, setPr] = useState(t.pr_url ?? '');
  const [note, setNote] = useState(t.note);
  const [target, setTarget] = useState(t.target_date ?? '');
  const [busy, setBusy] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reassignTo, setReassignTo] = useState('');
  const [approach, setApproach] = useState(t.approach);
  const [copyWarn, setCopyWarn] = useState(false);
  const canApproach = isMine || isMgr;
  const approachDirty = approach !== t.approach;

  // Pick up other people's changes unless this person is in the middle of editing.
  const dirty = status !== t.status || pr !== (t.pr_url ?? '') || note !== t.note || target !== (t.target_date ?? '');
  useEffect(() => {
    if (!dirty) { setStatus(t.status); setPr(t.pr_url ?? ''); setNote(t.note); setTarget(t.target_date ?? ''); }
    if (!approachDirty) setApproach(t.approach);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.updated_at]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !claiming && !editing) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, claiming, editing]);

  async function update(patch: Partial<Task>, okMsg: string) {
    setBusy(true);
    const { data: rows, error } = await supabase.rpc('task_update', { p_id: t.id, p_patch: patch });
    setBusy(false);
    if (error) { toast(explain(error)); return false; }
    if (!rows || rows.length === 0) { toast('You cannot change this task. Someone else has taken it.'); return false; }
    toast(okMsg);
    return true;
  }
  async function saveProgress() {
    if (pr && !/^https:\/\//.test(pr)) { toast('The pull request link must start with https://'); return; }
    await update({ status, pr_url: pr || null, note, target_date: target || null }, `${t.code} saved: ${STATUS_LABEL[status]}.`);
  }
  async function markReview() {
    if (await update({ status: 'review' }, `${t.code} is in review.`)) setStatus('review');
  }
  async function markDone() {
    if (await update({ status: 'done' }, `${t.code} is marked done.`)) setStatus('done');
  }
  async function release() {
    await update({ assignee: null, status: 'todo' }, `${t.code} is free for someone else.`);
  }
  async function reassign() {
    if (!reassignTo) return;
    const name = data.profiles[reassignTo]?.full_name ?? 'them';
    if (await update({ assignee: reassignTo }, `${t.code} handed to ${name}.`)) setReassignTo('');
  }
  async function remove() {
    setBusy(true);
    const { error } = await supabase.rpc('task_delete', { p_id: t.id });
    setBusy(false);
    if (error) { toast(explain(error)); return; }
    toast(`${t.code} deleted. It stays in the activity history.`);
    onClose();
  }
  async function saveApproach() {
    await update({ approach: approach.trim() }, `Your approach for ${t.code} is saved.`);
  }
  async function copyBrief(force = false) {
    if (!hasApproach(t) && !force) { setCopyWarn(true); return; }
    setCopyWarn(false);
    const ok = await copyText(taskBrief(t, (c) => byCode[c]?.title));
    toast(ok ? 'Brief copied. Read what the LLM gives back before you use any of it.' : 'Copy is blocked here. Select the brief text below and copy it.');
  }
  const sections = briefSections(t, (c) => byCode[c]?.title);
  const phase = PHASE_OF[t.phase];

  const history: TaskEvent[] = data.events.filter((e) => e.task_id === t.id);
  const people = Object.values(data.profiles).sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <>
      <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} />
      <aside className="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title">
        <div className="row between"><span className="mono muted">{t.code}</span><button className="b2" type="button" onClick={onClose}>Close</button></div>
        <div className="stack-sm">
          <div className="m">
            <StatusChip s={t.status} />
            <span className="chip">{weekLabel(t.week)}</span>
            {t.stream && <span className="chip" style={{ color: `var(--${t.stream})` }}>{STREAMS[t.stream].name}</span>}
            <span className="chip acc">{t.phase}</span>
            <span className="chip">{t.module}</span>
            {t.blocking && <span className="chip bad">Blocks others</span>}
          </div>
          <h2 id="panel-title">{t.title}</h2>
        </div>

        <section className="card owner">
          {who ? (
            <div className="row">
              <Avatar p={who} size={36} />
              <div className="grow">
                <b>{who.full_name}{isMine ? ' (you)' : ''}</b>
                <div className="muted small">{[who.title, who.stream ? STREAMS[who.stream].name : ''].filter(Boolean).join(' · ') || 'No title set'}</div>
                <div className="muted small">Took it {t.claimed_at ? ago(t.claimed_at) : ''}{t.target_date ? ` · planned finish ${new Date(t.target_date + 'T00:00:00').toLocaleDateString()}` : ''}</div>
              </div>
            </div>
          ) : (
            <div className="row between">
              <span className="muted">Nobody has taken this task yet.{isMgr ? ' Hand it to a developer below.' : ''}</span>
              {!isMgr && <button className="b1" type="button" onClick={() => setClaiming(true)}>Take this task</button>}
            </div>
          )}
          {who && t.note && !isMine && <p className="small"><span className="muted">Note: </span>{t.note}</p>}
          {who && t.pr_url && !isMine && <p className="small"><a href={t.pr_url} target="_blank" rel="noopener noreferrer">Open the pull request</a></p>}
        </section>

        {(isMine || isMgr) && who && (
          <section className="card stack-sm" aria-label="Progress">
            <div className="grid2">
              <div><label className="f" htmlFor="p-status">Status</label>
                <select id="p-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>{STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
              <div><label className="f" htmlFor="p-target">Planned finish</label>
                <input id="p-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
            </div>
            <div><label className="f" htmlFor="p-pr">Pull request link</label>
              <input id="p-pr" type="url" placeholder="https://gitlab.example.com/…/merge_requests/12" value={pr} onChange={(e) => setPr(e.target.value)} /></div>
            <div><label className="f" htmlFor="p-note">Notes for the team</label>
              <textarea id="p-note" maxLength={2000} placeholder="Blockers, decisions, what is left" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="row">
              <button className="b1" type="button" disabled={busy || !dirty} onClick={() => void saveProgress()}>Save</button>
              {(t.status === 'todo' || t.status === 'doing') && <button className="b2 review" type="button" disabled={busy} onClick={() => void markReview()}>Mark in review</button>}
              {t.status !== 'done' && <button className="b2 done" type="button" disabled={busy} onClick={() => void markDone()}>Mark done</button>}
              {isMine && <button className="b2" type="button" disabled={busy} onClick={() => void release()}>Give back</button>}
              {t.pr_url && <a href={t.pr_url} target="_blank" rel="noopener noreferrer" className="small">Open pull request</a>}
            </div>
          </section>
        )}

        {isMgr && (
          <section className="card stack-sm" aria-label="Manager">
            <h3>Manager</h3>
            <div className="row">
              <select aria-label="Hand to" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                <option value="">Hand this task to…</option>
                {people.filter((p) => p.id !== t.assignee && p.role !== 'manager').map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.stream ? ` · ${STREAMS[p.stream].name}` : ''}</option>)}
              </select>
              <button className="b2" type="button" disabled={!reassignTo || busy} onClick={() => void reassign()}>Hand over</button>
            </div>
          </section>
        )}

        {phase && <p className="small muted">{phase.title}. Read the phase on the Phases page and in <code>{phase.doc}</code> before you start.</p>}

        {t.goal && <section className="stack-sm"><h3>What this feature is</h3><p>{t.goal}</p></section>}
        {t.story && <section className="stack-sm"><h3>Who uses it</h3><p className="story">{t.story}</p></section>}
        <div className="grid2 top-align">
          {t.backend.length > 0 && <section className="stack-sm"><h3>Build: backend</h3><ul>{t.backend.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
          {t.frontend.length > 0 && <section className="stack-sm"><h3>Build: frontend</h3><ul>{t.frontend.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
        </div>
        {t.acceptance.length > 0 && <section className="stack-sm"><h3>Done when</h3><ol>{t.acceptance.map((a, i) => <li key={i}>{a}</li>)}</ol></section>}
        {t.checks.length > 0 && <section className="stack-sm"><h3>Guardrails to keep</h3><ul className="checks">{t.checks.map((a, i) => <li key={i}>{a}</li>)}</ul><p className="small muted">The full list is in GUARDRAILS.md. CI checks most of these on every merge request.</p></section>}

        <section className="card stack-sm think" aria-label="Think first">
          <h3>Think first</h3>
          {t.think.length > 0 ? <ol>{t.think.map((q, i) => <li key={i}>{q}</li>)}</ol> : <p className="muted">No questions on this task. Write down how you will build and test it.</p>}
          <label className="f" htmlFor="p-approach">My approach</label>
          {canApproach ? (
            <>
              <textarea id="p-approach" className="tall" maxLength={6000} value={approach} onChange={(e) => setApproach(e.target.value)}
                placeholder="Answer the questions in your own words. Then: the order you will build it in, the tests you will write first, and anything you are unsure about." />
              <div className="row"><button className="b1" type="button" disabled={busy || !approachDirty} onClick={() => void saveApproach()}>Save my approach</button><span className="small muted">Only the person doing the task and the manager can edit this. Everyone can read it.</span></div>
            </>
          ) : t.approach ? <p className="pre">{t.approach}</p> : <p className="muted">{who ? `${who.full_name} has not written an approach yet.` : 'Take this task to write your approach.'}</p>}
        </section>

        <section className="stack-sm"><h3>Depends on</h3>
          {t.depends.length ? <ul>{t.depends.map((c) => { const d = byCode[c]; return <li key={c}>{d ? <button className="b3 link" type="button" onClick={() => onOpen(d.id)}>{c} {d.title}</button> : c} {d && <StatusChip s={d.status} />}</li>; })}</ul> : <p className="muted">Nothing. Start any time.</p>}
        </section>
        {t.uses.length > 0 && <section className="stack-sm"><h3>Until another part lands, use</h3><ul>{t.uses.map((u, i) => <li key={i}>{u}</li>)}</ul></section>}
        {t.refs.length > 0 && <section className="stack-sm"><h3>Read first</h3><ul>{t.refs.map((u, i) => <li key={i}>{u}</li>)}</ul></section>}
        {t.files.length > 0 && <section className="stack-sm"><h3>Files</h3><ul>{t.files.map((u, i) => <li key={i}><code>{u}</code></li>)}</ul></section>}
        {t.api.length > 0 && <section className="stack-sm"><h3>Endpoints</h3><ul>{t.api.map((u, i) => <li key={i}><code>{u}</code></li>)}</ul></section>}

        <section className="card stack-sm" aria-label="Brief for an LLM">
          <div className="row between"><h3>Brief for an LLM (optional)</h3><button className="b2" type="button" onClick={() => void copyBrief()}>Copy for LLM</button></div>
          <p className="small muted">Read it first. It carries your approach, so the LLM follows your plan, not its own. You decide whether to use an LLM at all.</p>
          {copyWarn && (
            <div className="notice warn" role="alert">
              <span><b>Write your approach first.</b> A brief without your own plan gets generic code that may not fit the stage.</span>
              <div className="row">{canApproach && <button className="b3" type="button" onClick={() => document.getElementById('p-approach')?.focus()}>Write it now</button>}<button className="b3" type="button" onClick={() => void copyBrief(true)}>Copy anyway</button></div>
            </div>
          )}
          <details>
            <summary>Show the brief</summary>
            <div className="brief">{sections.map((sec) => <div key={sec.heading}><h4>{sec.heading}</h4><p className="pre">{sec.body}</p></div>)}</div>
          </details>
        </section>

        <div className="row">
          {canEdit && <button className="b2" type="button" onClick={() => setEditing(true)}>Edit task</button>}
          {canDelete && !confirmDelete && <button className="b3 danger" type="button" onClick={() => setConfirmDelete(true)}>Delete task</button>}
          {confirmDelete && <span className="row"><span className="small">Delete {t.code}?</span><button className="b2 danger" type="button" disabled={busy} onClick={() => void remove()}>Yes, delete</button><button className="b3" type="button" onClick={() => setConfirmDelete(false)}>Keep it</button></span>}
        </div>

        <section className="stack-sm"><h3>History</h3>
          {history.length ? <ol className="log">{history.map((e) => <li key={e.id}><span className="muted small">{ago(e.created_at)}</span><span>{describe(e, data.profiles)}</span></li>)}</ol> : <p className="muted">No changes recorded yet.</p>}
        </section>
      </aside>
      {claiming && <ClaimDialog task={t} me={me} onClose={() => setClaiming(false)} />}
      {editing && <TaskForm data={data} me={me} existing={t} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
    </>
  );
}

export function describe(e: TaskEvent, profiles: Record<string, Profile>): string {
  const actor = e.actor ? profiles[e.actor]?.full_name ?? 'Someone' : 'Set-up';
  const name = (id: string | null) => (id ? profiles[id]?.full_name ?? 'someone' : 'nobody');
  switch (e.kind) {
    case 'created': return `${actor} created ${e.task_code}`;
    case 'claimed': return e.actor === e.to_value ? `${actor} took ${e.task_code}` : `${actor} gave ${e.task_code} to ${name(e.to_value)}`;
    case 'released': return `${actor} gave back ${e.task_code}`;
    case 'reassigned': return `${actor} handed ${e.task_code} from ${name(e.from_value)} to ${name(e.to_value)}`;
    case 'status': return `${actor} moved ${e.task_code} to ${STATUS_LABEL[(e.to_value ?? 'todo') as Status] ?? e.to_value}`;
    case 'edited': return `${actor} edited ${e.task_code}`;
    case 'deleted': return `${actor} deleted ${e.task_code} (${e.from_value ?? ''})`;
    default: return `${actor} changed ${e.task_code}`;
  }
}
