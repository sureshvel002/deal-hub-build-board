import type { Phase, Stream } from './types';

export interface PhaseInfo {
  key: Phase;
  title: string;
  owner: Stream | 'all';
  purpose: string;
  roles: string;
  flow: string[];
  exit: string;
  doc: string;
}

/** What each phase is for, in plain words. Developers read this before taking a task in the phase. */
export const PHASES: PhaseInfo[] = [
  {
    key: 'Start', title: 'Start: one way of working', owner: 'all',
    purpose: 'Everyone runs the same starter repository, learns the guardrails, audits their own stage and freezes its contracts. After this week the four of you build in parallel against shapes that do not change without a review.',
    roles: 'All four developers',
    flow: ['Clone the starter and run pnpm verify (S tasks)', 'Audit your stage against the prototype, rules and acceptance files (G tasks)', 'Turn your draft contracts into real schemas (K tasks)', 'Review all contracts together on 27 November (X-1)'],
    exit: 'Tag contracts-v1 on main, every stub route answers 501 with a frozen schema.',
    doc: 'README.md, GUARDRAILS.md, docs/ARCHITECTURE.md',
  },
  {
    key: 'Qualify', title: 'Qualify: is this customer ready for a session?', owner: 'dev1',
    purpose: 'The Immersion lead builds an intake form, shares it by protected link, and the customer answers without an account. The answers run through the intake rules to show ten conditions as Met, Open or Stop, and the lead records Gate A.',
    roles: 'Immersion lead (does everything), Immersion team (reads), customer contact (answers the form)',
    flow: ['Build the form: ten rule questions plus custom ones', 'Set a password and share /f/{token}', 'Customer unlocks, answers and submits', 'Lead presses Send to Qualify on a response', 'The Qualify tab shows the conditions and the proposed outcome', 'Lead confirms the outcome (Gate A), closes conditions, records an exception if needed'],
    exit: 'Gate A passed (or an approved exception): the client moves to Prepare.',
    doc: 'docs/stages/QUALIFY.md',
  },
  {
    key: 'Prepare', title: 'Prepare: build and sign the session material', owner: 'dev2',
    purpose: 'The Research analyst builds the context pack with sourced claims, signs H2 and sends it for review. The lead approves or returns it, signs H1 and H3, records the sponsor\'s card ratings for Gate B, and releases the material.',
    roles: 'Research analyst (builds the pack), Immersion lead (reviews, signs, releases), team and consultant (read)',
    flow: ['Analyst gets "Prepare the context pack" after Gate A', 'Analyst builds profile, priorities, challenge cards and claims', 'Analyst resolves flags, signs H2, sends for review', 'Lead approves or returns with comments', 'Lead signs H1 and H3, records card ratings and Gate B', 'Lead releases the material'],
    exit: 'Material released: the client moves to Immerse and session setup opens.',
    doc: 'docs/stages/PREPARE.md',
  },
  {
    key: 'Immerse', title: 'Immerse: run the session', owner: 'dev3',
    purpose: 'The lead sets up the session (pods, steps, scoring, feedback) and publishes it, which signs H4 and issues the join code. Participants join by code with no account; the AI consultant watches pods, helps stuck ones, runs the decision block and records Gate C.',
    roles: 'Immersion lead (setup, publish), AI consultant (console, results, Gate C), participants (pods, no account)',
    flow: ['Lead sets date, format and pods, then steps, scoring and feedback', 'Preview as participant, then Publish (H4, join code)', 'Pods join with the code and work the steps', 'Consultant watches the console and sends hints', 'Decision block: scores, votes, feedback', 'Results, decision memo and Gate C'],
    exit: 'Gate C recorded: the client moves to Convert.',
    doc: 'docs/stages/IMMERSE.md',
  },
  {
    key: 'Convert', title: 'Convert: turn the decision into a sprint', owner: 'dev4',
    purpose: 'The Immersion team adds customer contacts, sends an approved follow-up note drafted by the agent, records the decision meeting, tracks readiness items and records sprint day 1 and the check-ins. Agents only draft; people approve and send.',
    roles: 'Immersion team (does the work), Immersion lead (sees all), AI consultant (reads)',
    flow: ['Add customer contacts (role titles, work email)', 'Agent drafts the follow-up from the memo; team edits, approves, sends', 'Record the decision meeting within 10 working days', 'Track readiness items (contract, data, security)', 'Record sprint day 1 and hold the check-ins, or close as a reasoned no-go'],
    exit: 'Sprint day 1 recorded (Prove, Pilot and Scale are Phase 2), or a reasoned no-go with a check-in date.',
    doc: 'docs/stages/CONVERT.md',
  },
  {
    key: 'Shared', title: 'Shared: what every stage stands on', owner: 'all',
    purpose: 'Each developer also owns one shared area that the stages call through a module\'s index.ts: core (live log, actions, Today, decisions) by Developer 1, access and security by Developer 2, the UI kit by Developer 3, and platform and quality (worker, mail, storage, tests, CI, load) by Developer 4. Each lands a stub first so nobody waits.',
    roles: 'All four developers',
    flow: ['Land the stub with the final function signature first', 'Tell the other three in the daily sync', 'Replace the stub with the real code; callers do not change'],
    exit: 'No stub left at the release candidate.',
    doc: 'docs/ARCHITECTURE.md §4',
  },
  {
    key: 'Finish', title: 'Finish: join, prove and sign off', owner: 'all',
    purpose: 'Every two weeks all four merge and run the app together (integration checkpoints). At the end each stage owner proves their stage works with no stubs and a silent playtest, and the release candidate is tagged on 22 January.',
    roles: 'All four developers',
    flow: ['Checkpoints on 27 Nov, 11 Dec, 8 Jan, 15 Jan', 'Stage sign-offs in week 9', 'Release candidate on 22 Jan'],
    exit: 'Full journey from register to sprint day 1 passes three runs in a row with no stubs.',
    doc: 'docs/APP_FLOW.md',
  },
];
export const PHASE_KEYS = PHASES.map((p) => p.key);
export const PHASE_OF: Record<Phase, PhaseInfo> = Object.fromEntries(PHASES.map((p) => [p.key, p])) as Record<Phase, PhaseInfo>;
