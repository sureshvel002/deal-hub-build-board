import { useState } from 'react';
import type { BoardData } from '../useBoard';
import { ago } from '../ui';
import { Avatar } from '../ui';
import { describe } from './TaskPanel';

/** The audit trail: every take, hand-over, status change, edit and delete, newest first. */
export default function Activity({ data }: { data: BoardData }) {
  const [who, setWho] = useState('all');
  const people = Object.values(data.profiles).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const rows = data.events.filter((e) => e.actor && (who === 'all' || e.actor === who));
  return (
    <div className="stack-lg">
      <div className="row between">
        <div><h1>Activity</h1><p className="muted">Recorded by the database on every change. Nobody can edit or remove it from the app.</p></div>
        <select aria-label="Person" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">Everyone</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>
      <section className="card">
        {rows.length ? (
          <ol className="log">
            {rows.map((e) => (
              <li key={e.id}>
                <span className="muted small" title={new Date(e.created_at).toLocaleString()}>{ago(e.created_at)}</span>
                <span className="row"><Avatar p={e.actor ? data.profiles[e.actor] : undefined} size={20} />{describe(e, data.profiles)}</span>
              </li>
            ))}
          </ol>
        ) : <p className="muted">No activity yet. It appears here as soon as someone takes or changes a task.</p>}
      </section>
    </div>
  );
}
