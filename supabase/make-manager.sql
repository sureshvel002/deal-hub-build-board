-- Decide who is a manager. Run in the Supabase SQL editor (after schema.sql).
-- You can run this at set-up time, before the person has an account or has signed in:
-- they become a manager the moment they save their profile. If they already have a
-- profile, they become a manager straight away. Everyone not listed is a developer.
-- Replace the email address. Add more rows for more managers.

insert into public.manager_emails (email) values
  ('manager@example.com')
on conflict (email) do nothing;

-- To make a manager a developer again, remove their email:
-- delete from public.manager_emails where email = 'manager@example.com';

-- Check: the list, then everyone who has a profile and their role.
select email as listed_manager, added_at from public.manager_emails order by email;
select p.full_name, u.email, p.role from public.profiles p join auth.users u on u.id = p.id order by p.role, p.full_name;
