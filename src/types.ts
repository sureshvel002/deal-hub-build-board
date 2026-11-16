export type Stream = 'dev1' | 'dev2' | 'dev3' | 'dev4';
export type Status = 'todo' | 'doing' | 'review' | 'done';
export type Role = 'developer' | 'manager';
export type Phase = 'Start' | 'Qualify' | 'Prepare' | 'Immerse' | 'Convert' | 'Shared' | 'Finish';

export interface Profile {
  id: string;
  full_name: string;
  title: string;
  stream: Stream | null;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  code: string;
  title: string;
  phase: Phase;
  goal: string;
  story: string;
  module: string;
  stream: Stream | null;
  week: number | null;
  status: Status;
  blocking: boolean;
  depends: string[];
  uses: string[];
  refs: string[];
  files: string[];
  api: string[];
  acceptance: string[];
  backend: string[];
  frontend: string[];
  checks: string[];
  think: string[];
  approach: string;
  assignee: string | null;
  claimed_at: string | null;
  target_date: string | null;
  pr_url: string | null;
  note: string;
  sort: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type EventKind = 'created' | 'claimed' | 'released' | 'reassigned' | 'status' | 'edited' | 'deleted';

export interface TaskEvent {
  id: number;
  task_id: string | null;
  task_code: string;
  actor: string | null;
  kind: EventKind;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export const STREAMS: Record<Stream, { name: string; area: string }> = {
  dev1: { name: 'Developer 1', area: 'Qualify + core' },
  dev2: { name: 'Developer 2', area: 'Prepare + access and security' },
  dev3: { name: 'Developer 3', area: 'Immerse + UI kit' },
  dev4: { name: 'Developer 4', area: 'Convert + platform and quality' },
};
export const STREAM_KEYS = Object.keys(STREAMS) as Stream[];

export const STATUSES: { key: Status; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'doing', label: 'In progress' },
  { key: 'review', label: 'In review' },
  { key: 'done', label: 'Done' },
];
export const STATUS_LABEL: Record<Status, string> = { todo: 'To do', doing: 'In progress', review: 'In review', done: 'Done' };

/** Week 1 starts Monday 16 November 2026; the holiday break (24 Dec to 1 Jan) is skipped. */
const WEEK_DATES = ['16 Nov', '23 Nov', '30 Nov', '7 Dec', '14 Dec', '21 Dec', '4 Jan', '11 Jan', '18 Jan'];
export function weekLabel(w: number | null): string {
  if (!w) return 'No week';
  return WEEK_DATES[w - 1] ? `Week ${w} · ${WEEK_DATES[w - 1]}` : `Week ${w}`;
}
