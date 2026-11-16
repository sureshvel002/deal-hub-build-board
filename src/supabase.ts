import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False until both environment variables are set; the app then shows set-up help instead of failing. */
export const configured = Boolean(url && key);
export const allowSignup = String(import.meta.env.VITE_ALLOW_SIGNUP ?? 'false') === 'true';

export const supabase = createClient(url || 'http://localhost:54321', key || 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Turns a Supabase or Postgres error into a sentence a person can act on. */
export function explain(err: unknown): string {
  const e = err as { message?: string; code?: string } | null;
  const msg = e?.message ?? String(err ?? 'Something went wrong.');
  if (e?.code === '23505') return 'That task code is already used. Pick another code.';
  if (e?.code === '23514') return 'One of the fields is not valid. Check its length and format.';
  if (e?.code === 'PGRST202') return 'The board database needs an update. Ask the admin to run supabase/schema.sql again in Supabase.';
  if (/Invalid login credentials/i.test(msg)) return 'Email or password is wrong. Try again, or ask the manager to reset your password.';
  if (/Email not confirmed/i.test(msg)) return 'This email is not confirmed yet. Ask the manager to confirm your account in Supabase.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Cannot reach the board. Check your connection and try again.';
  return msg;
}
