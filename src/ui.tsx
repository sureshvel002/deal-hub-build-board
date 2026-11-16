import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Profile, Status } from './types';
import { STATUS_LABEL } from './types';

/* ---------- toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const t = useRef<number | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(''), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={`toast${msg ? ' show' : ''}`} role="status" aria-live="polite">{msg}</div>
    </ToastCtx.Provider>
  );
}

/* ---------- small pieces ---------- */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
/** A stable hue per person, so the same person has the same colour everywhere. */
function hue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}
export function Avatar({ p, size = 26 }: { p: Profile | undefined; size?: number }) {
  if (!p) return <span className="avatar empty" style={{ width: size, height: size }} aria-hidden="true">?</span>;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue(p.id)} 55% 42%)` }} title={p.full_name} aria-hidden="true">
      {initials(p.full_name)}
    </span>
  );
}
export function StatusChip({ s }: { s: Status }) {
  const cls = s === 'done' ? 'ok' : s === 'review' ? 'acc' : s === 'doing' ? 'warn' : '';
  return <span className={`chip ${cls}`}>{STATUS_LABEL[s]}</span>;
}
export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/* ---------- dialog ---------- */
export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="scrim over" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="dialog-head"><h2>{title}</h2><button className="b3" type="button" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}
