import type { BoardData } from '../useBoard';
import type { Status } from '../types';
import { STREAMS } from '../types';
import { Avatar, StatusChip, ago } from '../ui';

/** Who is doing what: one card per person, plus the work nobody has taken yet. */
export default function People({ data }: { data: BoardData }) {
  const people = Object.values(data.profiles).sort((a, b) => (a.stream ?? 'z').localeCompare(b.stream ?? 'z') || a.full_name.localeCompare(b.full_name));
  const untaken = data.tasks.filter((t) => !t.assignee && t.status !== 'done');
  const lastSeen = (id: string) => data.events.find((e) => e.actor === id)?.created_at;

  return (
    <div className="stack-lg">
      <div><h1>People</h1><p className="muted">Everyone on the board, what they have taken, and how far they are.</p></div>
      <div className="people">
        {people.map((p) => {
          const ts = data.tasks.filter((t) => t.assignee === p.id);
          const c = (s: Status) => ts.filter((t) => t.status === s).length;
          const n = ts.length || 1;
          const active = ts.filter((t) => t.status === 'doing' || t.status === 'review');
          const seen = lastSeen(p.id);
          return (
            <section key={p.id} className="card person" style={{ borderTopColor: p.stream ? `var(--${p.stream})` : 'var(--line)' }}>
              <div className="row">
                <Avatar p={p} size={40} />
                <div className="grow">
                  <b>{p.full_name}</b>
                  <div className="muted small">{[p.title, p.stream ? `${STREAMS[p.stream].name} · ${STREAMS[p.stream].area}` : '', p.role === 'manager' ? 'Manager' : ''].filter(Boolean).join(' · ')}</div>
                  <div className="muted small">{seen ? `Last change ${ago(seen)}` : 'No changes yet'}</div>
                </div>
              </div>
              <div className="bar"><i className="d" style={{ width: `${(c('done') / n) * 100}%` }} /><i className="r" style={{ width: `${(c('review') / n) * 100}%` }} /><i className="p" style={{ width: `${(c('doing') / n) * 100}%` }} /></div>
              <div className="nums mono small muted"><span>{c('done')}/{ts.length} done</span><span>{c('doing')} doing</span><span>{c('review')} review</span><span>{c('todo')} to do</span></div>
              {active.length > 0 ? (
                <ul className="plain">{active.map((t) => <li key={t.id}><span className="mono small">{t.code}</span> {t.title} <StatusChip s={t.status} /></li>)}</ul>
              ) : <p className="muted small">Nothing in progress.</p>}
            </section>
          );
        })}
      </div>
      <section className="card">
        <h2>Not taken yet · {untaken.length}</h2>
        {untaken.length ? <ul className="plain cols2">{untaken.slice(0, 40).map((t) => <li key={t.id}><span className="mono small">{t.code}</span> {t.title} <span className="muted small">{t.stream ? STREAMS[t.stream].name : 'No stream'}</span></li>)}</ul> : <p className="muted">Every open task has an owner.</p>}
        {untaken.length > 40 && <p className="muted small">And {untaken.length - 40} more on the Tasks page.</p>}
      </section>
    </div>
  );
}
