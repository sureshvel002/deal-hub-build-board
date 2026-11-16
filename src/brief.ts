import type { Task } from './types';
import { STREAMS, weekLabel } from './types';
import { PHASE_OF } from './phases';

/**
 * The brief is written for a person first. A developer reads it, writes their own approach,
 * and only then decides whether to hand it to an LLM. It is never meant to be pasted blind.
 */
export const REPO_CONTEXT = [
  'Repository: deal-hub (Immersion Deal Hub, Phase 1). Read AGENTS.md, GUARDRAILS.md and docs/ARCHITECTURE.md before writing code.',
  'Stack: TypeScript strict, Node 22, pnpm workspaces. contracts/ holds one Zod definition per endpoint. backend/ is Fastify 5 with Drizzle and PostgreSQL 16. frontend/ is React 18 with Vite, React Router and TanStack Query.',
  'Module shape: backend/src/modules/<module>/{index.ts, routes.ts, service.ts, repo.ts, rules.ts, *.test.ts}. Frontend screens live in frontend/src/features/<feature>/ and use frontend/src/components/ui.',
].join('\n');

export const GUARDRAILS = [
  'Routes only through defineRoute with a contract and a permission. A denied call returns 403 and writes nothing; a hidden client or another workspace returns 404.',
  'Database access only in repo.ts, every query scoped by workspaceId. Other modules only through their index.ts.',
  'Each change and its event commit in one transaction. Create routes honour Idempotency-Key; edits send If-Match.',
  'Customer free text only in the pii schema. Role titles, never personal names. Invented data only. No secrets, tokens or emails in logs.',
  'Do not add an endpoint, field, event or dependency that is not in the contracts or agreed in review. Never edit rules/*.yaml in place.',
  'Every screen has loading, empty and error states and passes axe. Plain words, verb and object on buttons.',
];

export const NEEDS_APPROACH = 'Write your approach first.';

const list = (a: string[]) => (a.length ? a.map((x) => `- ${x}`).join('\n') : '- (none)');

export interface BriefSection { heading: string; body: string }

export function briefSections(t: Task, titleOf: (code: string) => string | undefined): BriefSection[] {
  const owner = t.stream ? `${STREAMS[t.stream].name} (${STREAMS[t.stream].area})` : 'Any developer';
  const phase = PHASE_OF[t.phase];
  const S: BriefSection[] = [];
  S.push({ heading: 'What this feature is', body: [`${t.code} · ${t.title}`, `${phase ? phase.title : t.phase} · ${weekLabel(t.week)} · ${owner}`, '', t.goal || '(no summary yet)'].join('\n') });
  S.push({ heading: 'Who uses it', body: t.story || '(no user story yet)' });
  S.push({ heading: 'Build (backend)', body: list(t.backend) + (t.api.length ? `\n\nEndpoints:\n${list(t.api)}` : '') });
  S.push({ heading: 'Build (frontend)', body: list(t.frontend) });
  S.push({ heading: 'Done when', body: t.acceptance.map((a, i) => `${i + 1}. ${a}`).join('\n') || '(no checks yet)' });
  S.push({ heading: 'Guardrails to keep', body: [...t.checks.map((c) => `- ${c}`), '', 'Always (GUARDRAILS.md):', list(GUARDRAILS)].join('\n') });
  const ctx: string[] = [];
  if (t.depends.length) ctx.push('Already merged before this task (same owner):', list(t.depends.map((c) => `${c} ${titleOf(c) ?? ''}`.trim())));
  if (t.uses.length) ctx.push('Until another person\'s part lands, build against:', list(t.uses));
  if (t.refs.length) ctx.push('Read first:', list(t.refs));
  if (t.files.length) ctx.push('Files you expect to touch:', list(t.files));
  if (ctx.length) S.push({ heading: 'Context', body: ctx.join('\n') });
  S.push({ heading: 'Questions to answer before coding', body: t.think.map((q, i) => `${i + 1}. ${q}`).join('\n') || '(none)' });
  S.push({ heading: 'My approach (written by the developer)', body: t.approach.trim() || `${NEEDS_APPROACH} Answer the questions above in your own words, then say how you will build and test it.` });
  return S;
}

export function hasApproach(t: Task): boolean {
  return t.approach.trim().length >= 40;
}

/** Plain text for an LLM chat. The developer's approach is part of it; the LLM follows that plan. */
export function taskBrief(t: Task, titleOf: (code: string) => string | undefined): string {
  const S = briefSections(t, titleOf);
  return [
    REPO_CONTEXT,
    '',
    ...S.flatMap((s) => [`## ${s.heading}`, s.body, '']),
    '## How to help',
    'Follow my approach above. If something in it breaks a guardrail or the contracts, say so before writing code.',
    'Write the tests from "Done when" first, then the code. Change only the files that the task needs and say why for any other file.',
    'When done: list the files changed, the tests added and how to run them, and anything left open for review.',
  ].join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
