-- Start the board fresh: removes ALL tasks, ALL activity history and ALL profiles. This cannot be undone.
-- Run in the Supabase SQL editor, then run seed.sql again to load the 84 tasks untaken and "To do".
-- Kept: the database rules (schema.sql), the manager list (manager_emails) and the sign-in accounts.
-- After this, each person sets up their profile again the next time they sign in.

truncate public.task_events, public.tasks, public.profiles restart identity;

-- Optional: also remove the sign-in accounts used for testing, so nobody can sign in until you add
-- them again under Authentication > Users. This removes EVERY account, including your own.
-- Safer: delete only the test accounts by hand under Authentication > Users.
-- delete from auth.users;

-- Optional: clear the manager list as well.
-- truncate public.manager_emails;

-- Check: all three should be 0 before you run seed.sql.
select (select count(*) from public.tasks) as tasks,
       (select count(*) from public.task_events) as history,
       (select count(*) from public.profiles) as profiles;
