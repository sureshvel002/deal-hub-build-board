import { useMemo, useState } from 'react';
import type { BoardData } from '../useBoard';
import type { Phase, Profile, Status, Stream, Task } from '../types';
import { PHASES } from '../phases';
import { STATUSES, STREAMS, STREAM_KEYS, weekLabel } from '../types';
import { Avatar, StatusChip } from '../ui';
import TaskPanel from './TaskPanel';
import TaskForm from './TaskForm';

type Layout = 'week' | 'phase';
const PREF_KEY = 'dhbb-prefs-2'; // new key so everyone starts on the phase view; week is only the schedule
function loadPrefs(): { mine: boolean; layout: Layout } {
  try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); return { mine: !!p.mine, layout: p.layout === 'week' ? 'week' : 'phase' }; }
  catch { return { mine: false, layout: 'phase' }; }
}

export default function Board({ data, me, initialPhase }: { data: BoardData; me: Profile; initialPhase?: Phase }) {
  const init = loadPrefs();
  const isMgr = me.role === 'manager'; // a manager does not take tasks, so "My tasks only" is not offered
  const [mine, setMine] = useState(init.mine && !isMgr);
  const [layout, setLayout] = useState<Layout>(init.layout);
  // A developer starts on their own stream; "All streams" is one pick away. Arriving from a phase shows that whole phase.
  const [stream, setStream] = useState<'all' | Stream | 'none'>(initialPhase ? 'all' : me.stream ?? 'all');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [week, setWeek] = useState<string>('all');
  const [phase, setPhase] = useState<'all' | Phase>(initialPhase ?? 'all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const save = (m: boolean, l: Layout) => { try { localStorage.setItem(PREF_KEY, JSON.stringify({ mine: m, layout: l })); } catch { /* private mode */ } };
  const byCode = useMemo(() => Object.fromEntries(data.tasks.map((t) => [t.code, t])), [data.tasks]);
  const weeks = useMemo(() => Array.from(new Set(data.tasks.map((t) => t.week).filter((w): w is number => w != null))).sort((a, b) => a - b), [data.tasks]);

  // Everything except the status tab, so each tab can show how many tasks it holds.
  const filtered = data.tasks.filter((t) => {
    if (mine && t.assignee !== me.id) return false;
    if (stream === 'none' && t.stream) return false;
    if (stream !== 'all' && stream !== 'none' && t.stream !== stream) return false;
    if (week !== 'all' && String(t.week ?? '') !== week) return false;
    if (phase !== 'all' && t.phase !== phase) return false;
    if (q) {
      const who = t.assignee ? data.profiles[t.assignee]?.full_name ?? '' : '';
      const hay = [t.code, t.title, t.phase, t.module, t.goal, t.story, who, ...t.files, ...t.api].join(' ').toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  const visible = status === 'all' ? filtered : filtered.filter((t) => t.status === status);
  const statusLabel = STATUSES.find((s) => s.key === status)?.label ?? '';

  const all = data.tasks;
  const count = (s: Status) => all.filter((t) => t.status === s).length;
  const n = all.length || 1;
  const mineOpen = all.filter((t) => t.assignee === me.id && t.status !== 'done').length;
  const open = openId ? data.tasks.find((t) => t.id === openId) : undefined;

  return (
    <div className="stack-lg">
      <section className="summary card" aria-label="Progress">
        <div className="row between">
          <h1>Build progress</h1>
          <span className="mono muted">{count('done')} of {all.length} done · {count('review')} in review · {count('doing')} in progress · {all.filter((t) => !t.assignee).length} not taken</span>
        </div>
        <div className="bar" role="img" aria-label={`${count('done')} of ${all.length} tasks done`}>
          <i className="d" style={{ width: `${(count('done') / n) * 100}%` }} />
          <i className="r" style={{ width: `${(count('review') / n) * 100}%` }} />
          <i className="p" style={{ width: `${(count('doing') / n) * 100}%` }} />
        </div>
        <p className="muted small">Hello {me.full_name}. {isMgr ? 'You can add, edit, hand over and delete tasks here.' : `You have ${mineOpen} open task${mineOpen === 1 ? '' : 's'}.`}</p>
      </section>

      <div className="tools" role="search">
        <div className="stabs" role="group" aria-label="Status">
          <button type="button" className={`stab${status === 'all' ? ' on' : ''}`} aria-pressed={status === 'all'} onClick={() => setStatus('all')}>All<span className="n">{filtered.length}</span></button>
          {STATUSES.map((s) => (
            <button key={s.key} type="button" className={`stab${status === s.key ? ' on' : ''}`} aria-pressed={status === s.key} onClick={() => setStatus(s.key)}>
              <i className={`dot ${s.key}`} />{s.label}<span className="n">{filtered.filter((t) => t.status === s.key).length}</span>
            </button>
          ))}
        </div>
        {!isMgr && (
          <label className="switch">
            <input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); save(e.target.checked, layout); }} />
            <span>My tasks only</span>
          </label>
        )}
        <select aria-label="Stream" value={stream} onChange={(e) => setStream(e.target.value as typeof stream)}>
          <option value="all">All streams</option>
          {STREAM_KEYS.map((k) => <option key={k} value={k}>{STREAMS[k].name}{k === me.stream ? ' (my stream)' : ''}</option>)}
          <option value="none">No stream</option>
        </select>
        <select aria-label="Phase" value={phase} onChange={(e) => setPhase(e.target.value as typeof phase)}>
          <option value="all">All phases</option>
          {PHASES.map((p) => <option key={p.key} value={p.key}>{p.key}</option>)}
        </select>
        <select aria-label="Week" value={week} onChange={(e) => setWeek(e.target.value)}>
          <option value="all">All weeks</option>
          {weeks.map((w) => <option key={w} value={String(w)}>{weekLabel(w)}</option>)}
        </select>
        <input type="search" placeholder="Search tasks, people, files" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg" role="group" aria-label="Layout">
          <button type="button" className={layout === 'phase' ? 'on' : ''} onClick={() => { setLayout('phase'); save(mine, 'phase'); }}>By phase</button>
          <button type="button" className={layout === 'week' ? 'on' : ''} onClick={() => { setLayout('week'); save(mine, 'week'); }}>By week</button>
        </div>
        <button className="b1" type="button" onClick={() => setCreating(true)}>New task</button>
      </div>

      {all.length === 0 ? (
        <div className="card empty"><b>No tasks yet.</b>Run supabase/seed.sql to load the Phase 1 tasks, or press New task.</div>
      ) : filtered.length === 0 ? (
        <div className="card empty"><b>{mine ? 'You have not taken any task here yet.' : 'No tasks match these filters.'}</b>{mine ? 'Turn off "My tasks only", open a task and press Take this task.' : 'Pick "All streams", clear the search, or pick another week or phase.'}</div>
      ) : visible.length === 0 ? (
        <div className="card empty"><b>No tasks are {statusLabel.toLowerCase()} here.</b>A task moves to this tab when its status changes. Open a task to take it or to change its status.</div>
      ) : layout === 'phase' ? (
        <div className="weeks">
          {PHASES.filter((p) => visible.some((t) => t.phase === p.key)).map((p) => {
            const ts = visible.filter((t) => t.phase === p.key);
            return (
              <section key={p.key} className="wk">
                <h2>{p.title} <span className="mono muted small">{ts.filter((t) => t.status === 'done').length} of {ts.length} done</span></h2>
                <p className="small muted">{p.purpose}</p>
                <div className="rows">{ts.map((t) => <TaskCard key={t.id} t={t} data={data} byCode={byCode} onOpen={setOpenId} showWeek />)}</div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="weeks">
          {Array.from(new Set(visible.map((t) => t.week ?? 0))).sort((a, b) => a - b).map((w) => {
            const ts = visible.filter((t) => (t.week ?? 0) === w);
            return (
              <section key={w} className="wk">
                <h2>{weekLabel(w || null)} <span className="mono muted small">{ts.filter((t) => t.status === 'done').length} of {ts.length} done</span></h2>
                <div className="rows">{ts.map((t) => <TaskCard key={t.id} t={t} data={data} byCode={byCode} onOpen={setOpenId} showWeek={false} />)}</div>
              </section>
            );
          })}
        </div>
      )}

      {open && <TaskPanel task={open} data={data} me={me} byCode={byCode} onClose={() => setOpenId(null)} onOpen={setOpenId} />}
      {creating && <TaskForm data={data} me={me} onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); setOpenId(id); }} />}
    </div>
  );
}

function TaskCard({ t, data, byCode, onOpen, showWeek }: { t: Task; data: BoardData; byCode: Record<string, Task>; onOpen: (id: string) => void; showWeek: boolean }) {
  const who = t.assignee ? data.profiles[t.assignee] : undefined;
  const waiting = t.status !== 'done' ? t.depends.filter((c) => byCode[c] && byCode[c].status !== 'done') : [];
  const color = t.stream ? `var(--${t.stream})` : 'var(--line)';
  return (
    <button type="button" className="task" style={{ borderLeftColor: color }} onClick={() => onOpen(t.id)}>
      <span className="m">
        <span className="mono muted small">{t.code}</span>
        <StatusChip s={t.status} />
        {showWeek && <span className="chip">{t.week ? `W${t.week}` : 'No week'}</span>}
        <span className="chip acc">{t.phase}</span>
        {t.blocking && t.status !== 'done' && <span className="chip bad">Blocks others</span>}
      </span>
      <span className="t">{t.title}</span>
      <span className="m">
        {who ? <><Avatar p={who} size={20} /><span className="small">{who.full_name}</span></> : <span className="small muted">Not taken</span>}
        {t.target_date && t.status !== 'done' && <span className="chip">Due {new Date(t.target_date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>}
        {waiting.length > 0 && <span className="chip warn">Waiting on {waiting.slice(0, 2).join(', ')}{waiting.length > 2 ? ` +${waiting.length - 2}` : ''}</span>}
      </span>
    </button>
  );
}
