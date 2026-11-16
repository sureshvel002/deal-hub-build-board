-- Deal Hub Build Board: Supabase schema.
-- Run once in the Supabase SQL editor (or `supabase db push`), then run seed.sql.
-- Who may do what is enforced here, in the database, not only in the screens.

create extension if not exists pgcrypto;

-- ---------- tables ----------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null check (char_length(btrim(full_name)) between 2 and 80),
  title       text not null default '' check (char_length(title) <= 80),
  stream      text check (stream in ('dev1','dev2','dev3','dev4')),
  role        text not null default 'developer' check (role in ('developer','manager')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Who is a manager, decided by the admin ahead of time. An email listed here gets the manager role
-- the moment that person saves their profile; everyone else is a developer. Add or remove rows in the
-- SQL editor at any time (see make-manager.sql): existing profiles follow straight away.
create table if not exists public.manager_emails (
  email     text primary key,
  added_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z]{1,3}-[0-9]{1,3}$'),
  title       text not null check (char_length(btrim(title)) between 3 and 140),
  goal        text not null default '' check (char_length(goal) <= 4000),
  module      text not null default 'General' check (char_length(module) <= 40),
  stream      text check (stream in ('dev1','dev2','dev3','dev4')),
  week        int check (week between 1 and 30),
  status      text not null default 'todo' check (status in ('todo','doing','review','done')),
  blocking    boolean not null default false,
  depends     text[] not null default '{}',
  uses        text[] not null default '{}',
  refs        text[] not null default '{}',
  files       text[] not null default '{}',
  api         text[] not null default '{}',
  acceptance  text[] not null default '{}',
  assignee    uuid references public.profiles(id) on delete set null,
  claimed_at  timestamptz,
  target_date date,
  pr_url      text check (pr_url is null or pr_url ~ '^https://'),
  note        text not null default '' check (char_length(note) <= 2000),
  sort        int not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  updated_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- v4: feature-level task fields (added idempotently so existing boards upgrade in place).
alter table public.tasks add column if not exists phase    text not null default 'Shared';
alter table public.tasks add column if not exists story    text not null default '';
alter table public.tasks add column if not exists backend  text[] not null default '{}';
alter table public.tasks add column if not exists frontend text[] not null default '{}';
alter table public.tasks add column if not exists checks   text[] not null default '{}';
alter table public.tasks add column if not exists think    text[] not null default '{}';
alter table public.tasks add column if not exists approach text not null default '';
do $$ begin
  alter table public.tasks add constraint tasks_phase_check check (phase in ('Start','Qualify','Prepare','Immerse','Convert','Shared','Finish'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.tasks add constraint tasks_text_len check (char_length(story) <= 1000 and char_length(approach) <= 6000);
exception when duplicate_object then null; end $$;
create index if not exists tasks_assignee_idx on public.tasks (assignee);
create index if not exists tasks_stream_week_idx on public.tasks (stream, week);
create index if not exists tasks_phase_idx on public.tasks (phase);

-- History survives a task being deleted, so task_id has no foreign key.
create table if not exists public.task_events (
  id          bigint generated always as identity primary key,
  task_id     uuid,
  task_code   text not null,
  actor       uuid references public.profiles(id) on delete set null,
  kind        text not null check (kind in ('created','claimed','released','reassigned','status','edited','deleted')),
  from_value  text,
  to_value    text,
  created_at  timestamptz not null default now()
);
create index if not exists task_events_task_idx on public.task_events (task_id, created_at desc);
create index if not exists task_events_time_idx on public.task_events (created_at desc);

-- ---------- helpers ----------

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

-- ---------- profile rules: nobody makes themselves a manager from the app ----------

create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;            -- SQL editor / service role
  if tg_op = 'INSERT' then
    if new.id <> auth.uid() then raise exception 'You can only create your own profile'; end if;
    -- The role comes from the admin's list, never from what the app sent.
    new.role := case when exists (
      select 1 from public.manager_emails m join auth.users u on lower(u.email) = m.email where u.id = new.id
    ) then 'manager' else 'developer' end;
  else
    if new.id <> old.id then raise exception 'Profile id cannot change'; end if;
    new.role := old.role;                                     -- role is set by an admin in SQL only
    new.created_at := old.created_at;
  end if;
  new.full_name := btrim(new.full_name);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- Keeps profiles in step with the manager list: listing an email promotes that person if they already
-- have a profile, removing it makes them a developer again.
create or replace function public.manager_emails_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.profiles p set role = 'developer' from auth.users u where u.id = p.id and lower(u.email) = old.email;
    if tg_op = 'DELETE' then return old; end if;
  end if;
  new.email := lower(btrim(new.email));
  update public.profiles p set role = 'manager' from auth.users u where u.id = p.id and lower(u.email) = new.email;
  return new;
end $$;

drop trigger if exists manager_emails_sync on public.manager_emails;
create trigger manager_emails_sync before insert or update or delete on public.manager_emails
  for each row execute function public.manager_emails_sync();

-- ---------- task rules ----------

create or replace function public.tasks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mgr boolean := public.is_manager();
begin
  if uid is null then return new; end if;                   -- seeding from the SQL editor
  if tg_op = 'INSERT' then
    new.created_by := uid;
    new.updated_by := uid;
    if new.assignee is not null and new.assignee <> uid and not mgr then
      raise exception 'Only a manager can create a task for someone else';
    end if;
    new.claimed_at := case when new.assignee is null then null else now() end;
    return new;
  end if;

  -- UPDATE
  new.code := old.code;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_by := uid;
  new.updated_at := now();

  if not (mgr or old.created_by is not distinct from uid or old.assignee is not distinct from uid) then
    -- Anyone else may only take an unassigned task, with their claim details.
    if not (old.assignee is null and new.assignee is not distinct from uid) then
      raise exception 'You can only take a task that nobody has taken';
    end if;
    new.title := old.title;   new.goal := old.goal;       new.module := old.module;
    new.stream := old.stream; new.week := old.week;       new.blocking := old.blocking;
    new.depends := old.depends; new.uses := old.uses;     new.refs := old.refs;
    new.files := old.files;   new.api := old.api;         new.acceptance := old.acceptance;
    new.sort := old.sort;     new.pr_url := old.pr_url;
    new.phase := old.phase;   new.story := old.story;     new.backend := old.backend;
    new.frontend := old.frontend; new.checks := old.checks; new.think := old.think;
  end if;

  -- "My approach" is the developer's own thinking: only the person doing the task (or taking it now) or a manager writes it.
  if not (mgr or old.assignee is not distinct from uid or (old.assignee is null and new.assignee is not distinct from uid)) then
    new.approach := old.approach;
  end if;

  if new.assignee is distinct from old.assignee then
    if not mgr and not (
      (old.assignee is null and new.assignee is not distinct from uid) or     -- take it
      (old.assignee is not distinct from uid and new.assignee is null)         -- give it back
    ) then
      raise exception 'Only a manager can hand a task to someone else';
    end if;
    new.claimed_at := case when new.assignee is null then null else now() end;
  else
    new.claimed_at := old.claimed_at;
  end if;

  if new.status in ('doing','review','done') and new.assignee is null then
    raise exception 'Take the task before you move it to %', new.status;
  end if;
  return new;
end $$;

drop trigger if exists tasks_guard on public.tasks;
create trigger tasks_guard before insert or update on public.tasks
  for each row execute function public.tasks_guard();

-- Every change writes one or more history rows. Clients cannot write history directly.
create or replace function public.tasks_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.task_events (task_id, task_code, actor, kind, to_value)
      values (new.id, new.code, uid, 'created', new.title);
    if new.assignee is not null then
      insert into public.task_events (task_id, task_code, actor, kind, to_value)
        values (new.id, new.code, uid, 'claimed', new.assignee::text);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.task_events (task_id, task_code, actor, kind, from_value)
      values (old.id, old.code, uid, 'deleted', old.title);
    return old;
  end if;

  if new.assignee is distinct from old.assignee then
    insert into public.task_events (task_id, task_code, actor, kind, from_value, to_value)
      values (new.id, new.code, uid,
        case when old.assignee is null then 'claimed'
             when new.assignee is null then 'released'
             else 'reassigned' end,
        old.assignee::text, new.assignee::text);
  end if;
  if new.status is distinct from old.status then
    insert into public.task_events (task_id, task_code, actor, kind, from_value, to_value)
      values (new.id, new.code, uid, 'status', old.status, new.status);
  end if;
  if new.assignee is not distinct from old.assignee and ((new.title, new.goal, new.module, new.stream, new.week, new.blocking, new.depends, new.acceptance, new.target_date, new.pr_url, new.phase, new.story, new.backend, new.frontend, new.checks, new.think, new.approach)
     is distinct from
     (old.title, old.goal, old.module, old.stream, old.week, old.blocking, old.depends, old.acceptance, old.target_date, old.pr_url, old.phase, old.story, old.backend, old.frontend, old.checks, old.think, old.approach)) then
    insert into public.task_events (task_id, task_code, actor, kind)
      values (new.id, new.code, uid, 'edited');
  end if;
  return new;
end $$;

drop trigger if exists tasks_audit on public.tasks;
create trigger tasks_audit after insert or update or delete on public.tasks
  for each row execute function public.tasks_audit();

-- ---------- row-level security ----------

alter table public.profiles    enable row level security;
alter table public.tasks       enable row level security;
alter table public.task_events enable row level security;
-- The manager list has no policies and no grants: only the admin in the SQL editor reads or changes it.
alter table public.manager_emails enable row level security;
revoke all on public.manager_emails from anon, authenticated;

revoke all on public.profiles, public.tasks, public.task_events from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select on public.task_events to authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using (true);
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated with check (true);
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (assignee is null or assignee = auth.uid() or created_by = auth.uid() or public.is_manager())
  with check (true);  -- column rules live in tasks_guard
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_manager() or (created_by = auth.uid() and assignee is null));

drop policy if exists events_read on public.task_events;
create policy events_read on public.task_events for select to authenticated using (true);

-- ---------- writes over POST ----------
-- Some office networks strip PATCH and DELETE from the browser's CORS preflight, so the app
-- sends every change through these functions (POST). They run as the signed-in person
-- (security invoker), so the policies and guard triggers above still decide what is allowed.
-- A key missing from the patch leaves that column alone; a key set to null clears it.

create or replace function public.profile_update(p_patch jsonb) returns setof uuid
language sql security invoker set search_path = public as $$
  update public.profiles p
     set (full_name, title, stream) =
         (select n.full_name, n.title, n.stream from jsonb_populate_record(p, p_patch) n)
   where p.id = auth.uid()
  returning p.id;
$$;

-- p_only_unassigned makes taking a task safe when two people press at once: only one update wins.
create or replace function public.task_update(p_id uuid, p_patch jsonb, p_only_unassigned boolean default false) returns setof uuid
language sql security invoker set search_path = public as $$
  update public.tasks t
     set (title, goal, module, stream, week, status, blocking, depends, uses, refs, files, api, acceptance,
          assignee, target_date, pr_url, note, sort, phase, story, backend, frontend, checks, think, approach) =
         (select n.title, n.goal, n.module, n.stream, n.week, n.status, n.blocking, n.depends, n.uses, n.refs, n.files, n.api, n.acceptance,
                 n.assignee, n.target_date, n.pr_url, n.note, n.sort, n.phase, n.story, n.backend, n.frontend, n.checks, n.think, n.approach
            from jsonb_populate_record(t, p_patch) n)
   where t.id = p_id and (not p_only_unassigned or t.assignee is null)
  returning t.id;
$$;

create or replace function public.task_delete(p_id uuid) returns setof uuid
language sql security invoker set search_path = public as $$
  delete from public.tasks where id = p_id returning id;
$$;

-- A signed-in person replaces the password they were given. Supabase's own password change uses PUT,
-- which the same networks block, so this does it over POST. It only ever touches the caller's own
-- account and only after the current password matches.
create or replace function public.change_password(p_current text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if p_new is null or char_length(p_new) < 8 then raise exception 'The new password needs at least 8 characters'; end if;
  if char_length(p_new) > 72 then raise exception 'The new password is too long (72 characters at most)'; end if;
  if p_new = p_current then raise exception 'Choose a password different from the current one'; end if;
  update auth.users
     set encrypted_password = crypt(p_new, gen_salt('bf', 10)), updated_at = now()
   where id = uid and encrypted_password = crypt(p_current, encrypted_password);
  if not found then raise exception 'The current password is wrong'; end if;
end $$;

revoke all on function public.profile_update(jsonb), public.task_update(uuid, jsonb, boolean), public.task_delete(uuid), public.change_password(text, text) from public, anon;
grant execute on function public.profile_update(jsonb), public.task_update(uuid, jsonb, boolean), public.task_delete(uuid), public.change_password(text, text) to authenticated;
notify pgrst, 'reload schema';

-- ---------- live updates ----------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.tasks;       exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.task_events; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.profiles;    exception when duplicate_object then null; end;
  end if;
end $$;
