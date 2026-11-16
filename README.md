# Deal Hub Build Board

The shared task board for the four-person Deal Hub build. Tasks are features, not layers: each one is a feature a developer builds and demos end to end (backend, frontend and tests), grouped by phase (Start, Qualify, Prepare, Immerse, Convert, Shared, Finish). Everyone signs in, sees every task, can switch to **My tasks only**, takes a task (giving their name, a planned finish date and a first note), moves it through To do, In progress, In review and Done, and can create new tasks. The People page shows who is doing what; the Activity page is the full history, written by the database on every change.

- **Front end:** Vite, React 18, TypeScript. A static site, so it deploys to Netlify or Vercel with no server.
- **Back end:** Supabase (Postgres, sign-in, live updates). Free plan is enough for this team.
- **Rules live in the database** (`supabase/schema.sql`): a developer can take only an unassigned task, can change only tasks they own or created, cannot make themselves a manager, and cannot write or erase history. Only a manager can hand a task to someone else or delete a seeded task.

## 1. Create the Supabase project (10 minutes)

1. Sign in at supabase.com and create a new project (free plan). Pick a region close to the team and save the database password somewhere safe.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, press Run.
3. Paste all of `supabase/seed.sql`, press Run. This loads the 84 Phase 1 feature tasks (21 per developer). Both files are safe to run again: re-running the schema adds new columns to an existing board, and re-running the seed updates task content but keeps status, assignee, notes, links and each developer's approach.
4. Open **Authentication > Sign In / Providers > Email**:
   - Keep Email enabled.
   - Turn **Allow new users to sign up** off if the manager will add people (recommended). Leave it on only if you also set `VITE_ALLOW_SIGNUP=true`.
5. Add the team: **Authentication > Users > Add user > Create new user**, enter each person's work email and a first password, and tick **Auto confirm user**. Send each person their password by a separate channel; the board offers to change it right after they set up their profile, and later under their name > Change password.
6. Run `supabase/make-manager.sql` with the manager's email. You can do this now, before the manager has an account or has signed in: they get the manager role the moment they save their profile. Everyone not listed is a developer.

> Why no magic links by default: Supabase's built-in email sender only sends to a few addresses an hour and only to your own team members. Creating users with a password avoids email entirely. If you want sign-up or reset emails, add a custom SMTP sender under **Authentication > Emails > SMTP settings** (for example Resend's free plan).

## 2. Run it locally

```bash
npm install
cp .env.example .env.local      # then fill in the two values below
npm run dev                     # http://localhost:5173
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are on the Supabase dashboard under **Project Settings > API** (or the **Connect** button). Use the anon or publishable key. **Never** use the service_role or secret key in this app.

## 3. Deploy

**Netlify**

1. Push this folder to a Git repository (GitHub, GitLab or Bitbucket).
2. Netlify: **Add new site > Import an existing project**, pick the repository. `netlify.toml` already sets the build command (`npm run build`) and folder (`dist`).
3. **Site configuration > Environment variables**: add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_ALLOW_SIGNUP` (`false`).
4. Deploy. Then in Supabase **Authentication > URL Configuration**, set **Site URL** to the Netlify address and add it to **Redirect URLs**.

**Vercel**

1. Vercel: **Add New > Project**, import the repository. `vercel.json` sets the framework (Vite), build command and output folder.
2. Add the same three environment variables under **Settings > Environment Variables**.
3. Deploy, then add the Vercel address in Supabase **URL Configuration** as above.

Both configs send security headers (content security policy limited to this site, Supabase and Google Fonts; no framing). The app has no client-side routes, so no rewrite rules are needed.

## 4. How people use it

| Who | Can do |
| --- | --- |
| Everyone signed in | See all tasks, people and activity; switch to My tasks only; create a task; take an unassigned task; copy a task's LLM brief |
| The person who took a task | Change its status, planned finish date, pull request link and notes; edit its details; give it back |
| The person who created a task | Edit it; delete it while nobody has taken it |
| Manager | Everything above on any task, hand a task to someone else, delete any task |

Taking a task asks for your name, role or title, a planned finish date and a first note. Your name and title show on the task card, the task panel and the People page. The first sign-in asks for your name, title and stream.

## 5. What a task tells you

| Part | What it is for |
| --- | --- |
| What this feature is, Who uses it | The feature in plain words and the user story, so you know why it matters |
| Build: backend, Build: frontend | What to build on each side; one task covers both |
| Done when | Testable acceptance checks; write them as tests first |
| Guardrails to keep | The rules from GUARDRAILS.md that this feature can break |
| Think first | Two to four questions to answer in your own words before coding |
| My approach | Your answers and plan. Only you (once you take the task) and the manager can edit it |
| Brief for an LLM | Optional. A readable brief built from all of the above, including your approach. Read it before copying; if you have not written an approach, the board asks you to first |

The **Phases** page explains each phase (purpose, who acts, the flow, how it ends) and lists its features with progress. Read it before taking a task in a phase.

## 6. Files

```
supabase/schema.sql        tables, rules (triggers), row-level security, live updates
supabase/seed.sql          the 84 Phase 1 feature tasks (generated)
supabase/make-manager.sql  list who is a manager (works before or after they sign in)
src/App.tsx                sign-in, profile set-up, top bar, pages
src/components/Board.tsx   filters, My tasks toggle, status and week layouts
src/components/TaskPanel.tsx  task details, progress, hand-over, history, LLM brief
src/components/ClaimDialog.tsx  "Take this task" with name and details
src/components/TaskForm.tsx    create and edit tasks
src/components/Phases.tsx  what each phase is for, its flow and features
src/phases.ts              phase texts
src/brief.ts               the readable task brief
src/components/People.tsx  who is doing what
src/components/Activity.tsx   full history
src/useBoard.ts            data loading and live updates
```

## 7. Good to know

- **Free plan pauses idle projects.** A Supabase free project with no activity for about a week is paused; restore it from the dashboard in one click. Daily use keeps it awake.
- **Backups.** The free plan has no point-in-time recovery. Export the tasks now and then from **Table Editor > tasks > Export to CSV**.
- **Adding tasks in bulk.** Add rows to a copy of `seed.sql` with new codes and run it. Existing codes are updated, not duplicated. Note: running the shipped seed removes old seeded tasks that are not in the current list, but only while nobody has taken them; tasks people created (N-x) are never removed.
- **Data.** Only names, titles and work emails of the team are stored. Do not put customer data or secrets in task notes.
