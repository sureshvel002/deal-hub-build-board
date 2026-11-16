import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase } from './supabase';
import { useBoard } from './useBoard';
import { Avatar, Dialog, ToastProvider } from './ui';
import SignIn from './components/SignIn';
import ProfileForm from './components/ProfileForm';
import Board from './components/Board';
import People from './components/People';
import Activity from './components/Activity';
import Phases from './components/Phases';
import Insights from './components/Insights';
import PasswordForm from './components/PasswordForm';

type View = 'insights' | 'board' | 'phases' | 'people' | 'activity';
const VIEWS: { key: View; label: string; managerOnly?: boolean }[] = [
  { key: 'insights', label: 'Insights', managerOnly: true },
  { key: 'board', label: 'Tasks' },
  { key: 'phases', label: 'Phases' },
  { key: 'people', label: 'People' },
  { key: 'activity', label: 'Activity' },
];
/** Null when the address names no page: a manager then lands on Insights, a developer on Tasks. */
function viewFromHash(): View | null {
  const h = window.location.hash.slice(1);
  return h === 'insights' || h === 'board' || h === 'phases' || h === 'people' || h === 'activity' ? h : null;
}

export default function App() {
  if (!configured) return <SetupHelp />;
  return <ToastProvider><Shell /></ToastProvider>;
}

function Shell() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [hashView, setView] = useState<View | null>(viewFromHash());
  const [editProfile, setEditProfile] = useState(false);
  const [offerPassword, setOfferPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => { data.subscription.unsubscribe(); window.removeEventListener('hashchange', onHash); };
  }, []);

  const uid = session?.user.id ?? null;
  const board = useBoard(uid);
  const me = uid ? board.profiles[uid] : undefined;

  if (!ready) return <main className="center-page"><p className="muted">Loading…</p></main>;
  if (!session) return <SignIn />;
  if (board.loading) return <main className="center-page"><p className="muted">Loading the board…</p></main>;
  if (!me) {
    return (
      <main className="center-page">
        <div className="card auth">
          <div className="brand"><span className="logo" aria-hidden="true">DH</span>Deal Hub Build Board</div>
          <h1>Set up your profile</h1>
          <ProfileForm userId={uid!} onSaved={() => { setOfferPassword(true); void board.reload(); }} />
        </div>
      </main>
    );
  }
  // Second step of the first sign-in: replace the password they were given, or skip and do it later from the profile.
  if (offerPassword) {
    return (
      <main className="center-page">
        <div className="card auth">
          <div className="brand"><span className="logo" aria-hidden="true">DH</span>Deal Hub Build Board</div>
          <h1>Set your own password</h1>
          <p className="muted">You signed in with a password someone gave you. Change it now, or skip and change it later from your profile.</p>
          <PasswordForm onDone={() => setOfferPassword(false)} onSkip={() => setOfferPassword(false)} />
        </div>
      </main>
    );
  }

  const isMgr = me.role === 'manager';
  const view: View = isMgr ? hashView ?? 'insights' : hashView && hashView !== 'insights' ? hashView : 'board';

  return (
    <>
      <header className="top">
        <div className="brand"><span className="logo" aria-hidden="true">DH</span><span className="hide-sm">Deal Hub</span> Build Board</div>
        <nav className="tabs" aria-label="Main">
          {VIEWS.filter((v) => isMgr || !v.managerOnly).map((v) => (
            <a key={v.key} href={`#${v.key}`} className={view === v.key ? 'on' : ''} aria-current={view === v.key ? 'page' : undefined}>{v.label}</a>
          ))}
        </nav>
        <div className="spacer" />
        <span className={`chip ${board.live ? 'ok' : 'warn'}`} title={board.live ? 'Changes from others appear instantly' : 'Reconnecting to live updates'}>{board.live ? 'Live' : 'Offline'}</span>
        <button className="me" type="button" onClick={() => setEditProfile(true)} aria-label="Edit your profile">
          <Avatar p={me} /> <span className="hide-sm">{me.full_name}</span>
        </button>
        <button className="b3" type="button" onClick={() => void supabase.auth.signOut()}>Sign out</button>
      </header>
      {board.error && <div className="banner" role="alert">{board.error} <button className="b3" type="button" onClick={() => void board.reload()}>Try again</button></div>}
      <main className="page">
        {view === 'insights' && <Insights data={board} me={me} />}
        {view === 'board' && <Board data={board} me={me} />}
        {view === 'phases' && <Phases data={board} me={me} />}
        {view === 'people' && <People data={board} />}
        {view === 'activity' && <Activity data={board} />}
      </main>
      {editProfile && (
        <Dialog title="Your profile" onClose={() => setEditProfile(false)}>
          <ProfileForm userId={me.id} existing={me} onSaved={() => { setEditProfile(false); void board.reload(); }} onCancel={() => setEditProfile(false)} />
          <PasswordForm />
        </Dialog>
      )}
    </>
  );
}

function SetupHelp() {
  return (
    <main className="center-page">
      <div className="card auth">
        <h1>Connect the board to Supabase</h1>
        <p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then rebuild.</p>
        <p className="muted">Locally: copy <code>.env.example</code> to <code>.env.local</code>. On Netlify or Vercel: add both in the site's environment variables. Full steps are in README.md.</p>
      </div>
    </main>
  );
}
