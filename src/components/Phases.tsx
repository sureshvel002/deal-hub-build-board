import { useState } from 'react';
import type { BoardData } from '../useBoard';
import type { Profile, Task } from '../types';
import { STREAMS } from '../types';
import { PHASES } from '../phases';
import { Avatar, StatusChip } from '../ui';
import TaskPanel from './TaskPanel';

/** One page per phase in plain words: why it exists, who acts, the flow, how it ends, and its features with progress. */
export default function Phases({ data, me }: { data: BoardData; me: Profile }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const byCode: Record<string, Task> = Object.fromEntries(data.tasks.map((t) => [t.code, t]));
  const open = openId ? data.tasks.find((t) => t.id === openId) : undefined;

  return (
    <div className="stack-lg">
      <section className="card stack-sm">
        <h1>Phases</h1>
        <p className="muted">Read the phase before you take a task in it. Each stage is owned end to end by one developer, who also owns one shared area. The full detail and diagrams are in the repository under <code>docs/stages</code>.</p>
        <nav className="phase-nav" aria-label="Jump to phase">
          {PHASES.map((p) => <a key={p.key} className="chip acc" href={`#phase-${p.key}`} onClick={(e) => { e.preventDefault(); document.getElementById(`phase-${p.key}`)?.scrollIntoView({ behavior: 'smooth' }); }}>{p.key}</a>)}
        </nav>
      </section>

      <div className="phases">
        {PHASES.map((p) => {
          const ts = data.tasks.filter((t) => t.phase === p.key).sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code));
          const done = ts.filter((t) => t.status === 'done').length;
          const n = ts.length || 1;
          return (
            <section key={p.key} id={`phase-${p.key}`} className="card phase" aria-labelledby={`ph-${p.key}`}>
              <div className="ph-head"><span>{p.owner === 'all' ? 'All four developers' : `${STREAMS[p.owner].name} · ${STREAMS[p.owner].area}`}</span><span>{done} of {ts.length} done</span></div>
              <h2 id={`ph-${p.key}`}>{p.title}</h2>
              <div className="bar" role="img" aria-label={`${done} of ${ts.length} tasks done`}><i className="d" style={{ width: `${(done / n) * 100}%` }} /></div>
              <p>{p.purpose}</p>
              <p className="small"><span className="muted">Who acts: </span>{p.roles}</p>
              <div className="grid2 top-align">
                <div className="stack-sm"><h3>The flow</h3><ol className="flow">{p.flow.map((f, i) => <li key={i}>{f}</li>)}</ol></div>
                <div className="stack-sm">
                  <h3>How it ends</h3><p>{p.exit}</p>
                  <h3>Read in the repository</h3><p><code>{p.doc}</code></p>
                </div>
              </div>
              <div className="stack-sm">
                <h3>Features and tasks</h3>
                {ts.length === 0 ? <p className="muted">No tasks in this phase yet.</p> : ts.map((t) => {
                  const who = t.assignee ? data.profiles[t.assignee] : undefined;
                  return (
                    <button key={t.id} type="button" className="feat" onClick={() => setOpenId(t.id)}>
                      <span className="mono muted small">{t.code}</span>
                      <span className="t">{t.title}{t.stream && p.owner === 'all' ? <span className="muted small"> · {STREAMS[t.stream].name}</span> : null}</span>
                      <span className="m">{who && <Avatar p={who} size={20} />}<StatusChip s={t.status} /></span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {open && <TaskPanel task={open} data={data} me={me} byCode={byCode} onClose={() => setOpenId(null)} onOpen={setOpenId} />}
    </div>
  );
}
