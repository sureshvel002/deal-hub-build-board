import { useMemo, useState, type ReactNode } from 'react';
import type { BoardData } from '../useBoard';
import type { Profile, Status, Task } from '../types';
import { STREAMS } from '../types';
import { PHASES } from '../phases';
import { Avatar, StatusChip, ago } from '../ui';
import TaskPanel, { describe } from './TaskPanel';

/** A taken task with no change for this many days is listed as quiet. */
const QUIET_DAYS = 3;
const LIST_MAX = 6;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The manager's view: how far the build is, by phase and by developer, and what needs a decision. Read-only. */
export default function Insights({ data, me }: { data: BoardData; me: Profile }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const tasks = data.tasks;
  const byCode = useMemo(() => Object.fromEntries(tasks.map((t) => [t.code, t])), [tasks]);
  const count = (ts: Task[], s: Status) => ts.filter((t) => t.status === s).length;
  const day = today();
  const isOverdue = (t: Task) => !!t.target_date && t.status !== 'done' && t.target_date < day;
  const byPlan = (a: Task, b: Task) => a.sort - b.sort || a.code.localeCompare(b.code);

  const done = count(tasks, 'done');
  const overdue = tasks.filter(isOverdue).sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? ''));
  const untaken = tasks.filter((t) => !t.assignee && t.status !== 'done');
  const blocking = tasks.filter((t) => t.blocking && t.status !== 'done').sort(byPlan);
  const inReview = tasks.filter((t) => t.status === 'review').sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  const quietBefore = Date.now() - QUIET_DAYS * 86400_000;
  const quiet = tasks.filter((t) => t.assignee && (t.status === 'todo' || t.status === 'doing') && new Date(t.updated_at).getTime() < quietBefore)
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  const ready = untaken.filter((t) => t.status === 'todo' && t.depends.every((c) => !byCode[c] || byCode[c].status === 'done')).sort(byPlan);

  const developers = Object.values(data.profiles).filter((p) => p.role === 'developer')
    .sort((a, b) => (a.stream ?? 'z').localeCompare(b.stream ?? 'z') || a.full_name.localeCompare(b.full_name));
  const lastSeen = (id: string) => data.events.find((e) => e.actor === id)?.created_at;
  const name = (t: Task) => (t.assignee ? data.profiles[t.assignee]?.full_name ?? 'Someone' : 'Not taken');
  const open = openId ? tasks.find((t) => t.id === openId) : undefined;
  const recent = data.events.filter((e) => e.actor).slice(0, 8);

  return (
    <div className="stack-lg">
      <div>
        <h1>Insights</h1>
        <p className="muted">How far the build is and what needs a decision. Only managers see this page.</p>
      </div>

      <section className="tiles" aria-label="Summary">
        <Tile n={`${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%`} label="of the build done" sub={`${done} of ${tasks.length} tasks`} />
        <Tile n={count(tasks, 'doing')} label="in progress" />
        <Tile n={count(tasks, 'review')} label="in review" />
        <Tile n={untaken.length} label="not taken" />
        <Tile n={overdue.length} label="overdue" bad={overdue.length > 0} />
      </section>

      <section className="card stack">
        <div className="row between">
          <h2>Progress by phase</h2>
          <span className="m small muted"><i className="dot done" />Done <i className="dot review" />In review <i className="dot doing" />In progress</span>
        </div>
        <div>
          {PHASES.map((p) => {
            const ts = tasks.filter((t) => t.phase === p.key);
            if (!ts.length) return null;
            const d = count(ts, 'done');
            return (
              <div key={p.key} className="prow">
                <div><b>{p.key}</b><div className="muted small">{d} of {ts.length} done</div></div>
                <Split ts={ts} label={`${p.key}: ${d} of ${ts.length} done`} />
                <span className="mono small">{Math.round((d / ts.length) * 100)}%</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card stack">
        <h2>Progress by developer</h2>
        {developers.length ? (
          <div>
            {developers.map((p) => {
              const ts = tasks.filter((t) => t.assignee === p.id);
              const late = ts.filter(isOverdue).length;
              const seen = lastSeen(p.id);
              return (
                <div key={p.id} className="prow">
                  <div className="row">
                    <Avatar p={p} size={32} />
                    <div className="grow"><b>{p.full_name}</b><div className="muted small">{p.stream ? STREAMS[p.stream].name : 'No stream'}</div></div>
                  </div>
                  <div className="stack-sm">
                    <Split ts={ts} label={`${p.full_name}: ${count(ts, 'done')} of ${ts.length} done`} />
                    <div className="nums mono small muted">
                      <span>{count(ts, 'done')}/{ts.length} done</span><span>{count(ts, 'doing')} in progress</span><span>{count(ts, 'review')} in review</span>
                      {late > 0 && <span className="danger">{late} overdue</span>}
                    </div>
                  </div>
                  <span className="muted small">{seen ? `Last change ${ago(seen)}` : 'No changes yet'}</span>
                </div>
              );
            })}
          </div>
        ) : <p className="muted">No developer has signed in yet.</p>}
      </section>

      <div>
        <h2>Needs attention</h2>
        <p className="muted small">Open a task to hand it over, edit it or change its status.</p>
      </div>
      <div className="attn">
        <Group title="Overdue" none="Nothing is past its planned finish date." tasks={overdue} onOpen={setOpenId}
          meta={(t) => <span className="chip bad">Due {new Date(t.target_date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>} sub={name} />
        <Group title="Waiting in review" none="Nothing is waiting for a review." tasks={inReview} onOpen={setOpenId}
          meta={(t) => <span className="muted small">{ago(t.updated_at)}</span>} sub={name} />
        <Group title={`Quiet for ${QUIET_DAYS}+ days`} none="Every taken task has moved recently." tasks={quiet} onOpen={setOpenId}
          meta={(t) => <span className="muted small">{ago(t.updated_at)}</span>} sub={name} />
        <Group title="Blocks others, not done" none="No blocking task is open." tasks={blocking} onOpen={setOpenId}
          meta={(t) => <StatusChip s={t.status} />} sub={name} />
        <Group title="Ready, but nobody has taken it" none="Every ready task has an owner." tasks={ready} onOpen={setOpenId}
          meta={(t) => <span className="chip acc">{t.phase}</span>} sub={(t) => (t.stream ? STREAMS[t.stream].name : 'No stream')} />
      </div>

      <section className="card stack-sm">
        <div className="row between"><h2>Recent activity</h2><a href="#activity" className="small">See all</a></div>
        {recent.length ? (
          <ol className="log">
            {recent.map((e) => (
              <li key={e.id}>
                <span className="muted small" title={new Date(e.created_at).toLocaleString()}>{ago(e.created_at)}</span>
                <span className="row"><Avatar p={e.actor ? data.profiles[e.actor] : undefined} size={20} />{describe(e, data.profiles)}</span>
              </li>
            ))}
          </ol>
        ) : <p className="muted">No activity yet. It appears here as soon as someone takes or changes a task.</p>}
      </section>

      {open && <TaskPanel task={open} data={data} me={me} byCode={byCode} onClose={() => setOpenId(null)} onOpen={setOpenId} />}
    </div>
  );
}

function Tile({ n, label, sub, bad }: { n: number | string; label: string; sub?: string; bad?: boolean }) {
  return (
    <div className={`card tile${bad ? ' bad' : ''}`}>
      <b>{n}</b>
      <span>{label}</span>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

function Split({ ts, label }: { ts: Task[]; label: string }) {
  const n = ts.length || 1;
  const w = (s: Status) => `${(ts.filter((t) => t.status === s).length / n) * 100}%`;
  return (
    <div className="bar" role="img" aria-label={label}>
      <i className="d" style={{ width: w('done') }} /><i className="r" style={{ width: w('review') }} /><i className="p" style={{ width: w('doing') }} />
    </div>
  );
}

function Group({ title, none, tasks, meta, sub, onOpen }: {
  title: string; none: string; tasks: Task[]; meta: (t: Task) => ReactNode; sub: (t: Task) => string; onOpen: (id: string) => void;
}) {
  return (
    <section className="card stack-sm">
      <div className="row between"><h3>{title}</h3><span className={`chip${tasks.length ? ' warn' : ' ok'}`}>{tasks.length}</span></div>
      {tasks.length === 0 ? <p className="muted small">{none}</p> : (
        <div>
          {tasks.slice(0, LIST_MAX).map((t) => (
            <button key={t.id} type="button" className="feat" onClick={() => onOpen(t.id)}>
              <span className="mono small muted">{t.code}</span>
              <span><span className="t">{t.title}</span><span className="muted small block">{sub(t)}</span></span>
              {meta(t)}
            </button>
          ))}
        </div>
      )}
      {tasks.length > LIST_MAX && <p className="muted small">And {tasks.length - LIST_MAX} more.</p>}
    </section>
  );
}
