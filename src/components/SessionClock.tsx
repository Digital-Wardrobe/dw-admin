import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Clock, Loader2, LogOut, TimerReset } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { EXPIRES_KEY, TOKEN_KEY, endIfUnauthorized, endSession, saveSession, savedExpiry, signOut } from '../lib/session';

/* The 2-hour console session, shown: how long until you're signed out, an Extend button that gives
   the same session 2 more hours, and a warning for the last 10 minutes. The server checks the
   session on every request; this keeps the clock honest (asks the server every minute and whenever
   the tab comes back) and in step across tabs. */

const WARN_MS = 10 * 60 * 1000;
const POLL_MS = 60 * 1000;

type Ctx = {
  /** ms left, or null when this account has no timed session (app accounts signed in as staff) */
  left: number | null;
  endsAt: number | null;
  extend: () => Promise<void>;
  extending: boolean;
  /** "Extended to 6:42 PM" for a few seconds after Extend */
  notice: string | null;
  error: string | null;
};
const SessionContext = createContext<Ctx>({ left: null, endsAt: null, extend: async () => {}, extending: false, notice: null, error: null });
const useSession = () => useContext(SessionContext);

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` });
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** 1h 52m · 52m · 9:42 (the last 10 minutes count seconds) */
function formatLeft(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (ms < WARN_MS) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [endsAt, setEndsAt] = useState<number | null>(savedExpiry);
  const [now, setNow] = useState(Date.now);
  const [extending, setExtending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);   // server clock − this computer's clock
  const finalCheck = useRef(false);

  const adopt = useCallback((expiresAt: string | null | undefined, serverNow?: string) => {
    if (serverNow) setOffset(Date.parse(serverNow) - Date.now());
    const at = expiresAt ? Date.parse(expiresAt) : NaN;
    if (Number.isFinite(at)) { localStorage.setItem(EXPIRES_KEY, new Date(at).toISOString()); setEndsAt(at); setNow(Date.now()); finalCheck.current = false; }
    else { localStorage.removeItem(EXPIRES_KEY); setEndsAt(null); }
  }, []);

  // Ask the server when the session ends (it may have been extended in another tab, or ended)
  const refresh = useCallback(async (): Promise<{ expiresAt: string | null; serverNow: string } | null> => {
    try {
      const r = await axios.get(`${API_BASE_URL}session`, { headers: headers(), timeout: 10000 });
      adopt(r.data?.expiresAt, r.data?.serverNow);
      return r.data;
    } catch (err) {
      endIfUnauthorized(err);
      return null;
    }
  }, [adopt]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const poll = setInterval(refresh, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); refresh(); } };
    // Other tabs: Extend there moves the clock here; signing out there signs out here
    const onStorage = (e: StorageEvent) => {
      if (e.key === EXPIRES_KEY && e.newValue) setEndsAt(Date.parse(e.newValue));
      if ((e.key === TOKEN_KEY || e.key === null) && !localStorage.getItem(TOKEN_KEY)) window.location.assign('/portal/secure-gateway-entry');
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => { clearTimeout(first); clearInterval(poll); clearInterval(tick); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('storage', onStorage); };
  }, [refresh]);

  const left = endsAt === null ? null : endsAt - (now + offset);

  // Time's up: one last word with the server (another tab may have just extended), then sign out
  useEffect(() => {
    if (left === null || left > 0 || finalCheck.current) return;
    finalCheck.current = true;
    (async () => {
      const r = await refresh();
      if (!r?.expiresAt || Date.parse(r.expiresAt) <= Date.parse(r.serverNow)) endSession('timeout');
    })();
  }, [left, refresh]);

  const extend = useCallback(async () => {
    setExtending(true); setError(null);
    try {
      const r = await axios.post(`${API_BASE_URL}session/extend`, {}, { headers: headers(), timeout: 10000 });
      saveSession(r.data.accessToken, r.data.expiresAt);
      adopt(r.data.expiresAt, r.data.serverNow);
      setNotice(`Extended to ${clock(Date.parse(r.data.expiresAt))}`);
      setTimeout(() => setNotice(null), 5000);
    } catch (err) {
      if (!endIfUnauthorized(err)) {
        const res = (err as { response?: { data?: { message?: string } } })?.response;
        setError(res?.data?.message || 'Couldn’t extend. Check your connection and try again.');
      }
    } finally { setExtending(false); }
  }, [adopt]);

  return <SessionContext.Provider value={{ left, endsAt, extend, extending, notice, error }}>{children}</SessionContext.Provider>;
}

/** Sidebar: "Signs out in 1h 52m" + Extend. */
export function SessionCard() {
  const { left, endsAt, extend, extending, notice, error } = useSession();
  if (left === null || endsAt === null) return null;
  const warn = left < WARN_MS;
  return (
    <div className={`mb-1.5 rounded-inner border px-3 py-2.5 ${warn ? 'border-warn/40 bg-warn/5' : 'border-ink-700 bg-ink-900/40'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-label uppercase text-ink-400">
          <Clock size={13} strokeWidth={1.75} className={warn ? 'text-warn' : undefined} aria-hidden="true" /> Session
        </p>
        <button onClick={extend} disabled={extending}
          className="flex shrink-0 items-center gap-1 rounded-md border border-brand-line bg-brand-wash px-2 py-1 text-xs font-medium text-brand transition hover:bg-brand/15 active:translate-y-px disabled:opacity-60"
          aria-label="Extend the session by 2 hours">
          {extending ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <TimerReset size={12} aria-hidden="true" />} Extend
        </button>
      </div>
      <p className="mt-1.5 text-sm text-ink-200" title={`Your session ends at ${clock(endsAt)}`}>
        Signs out in <span className={`font-mono font-medium tabular-nums ${warn ? 'text-warn' : 'text-ink-50'}`}>{formatLeft(left)}</span>
      </p>
      <p className={`mt-0.5 text-xs ${error ? 'text-bad' : 'text-ink-400'}`} role={error || notice ? 'status' : undefined}>
        {error || notice || `At ${clock(endsAt)}, even if you’re still here.`}
      </p>
    </div>
  );
}

/** Small screens: the time left, tap to extend. */
export function SessionPill() {
  const { left, extend, extending } = useSession();
  if (left === null) return null;
  const warn = left < WARN_MS;
  return (
    <button onClick={extend} disabled={extending}
      className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-60 lg:hidden ${warn ? 'border-warn/40 text-warn' : 'border-ink-700 text-ink-300 hover:text-ink-100'}`}
      aria-label={`Signs out in ${formatLeft(left)}. Extend by 2 hours`}>
      {extending ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Clock size={12} aria-hidden="true" />}
      <span className="font-mono tabular-nums">{formatLeft(left)}</span>
      <span className="font-medium text-brand">Extend</span>
    </button>
  );
}

/** The last 10 minutes: a banner on every page, with Extend and Sign out. */
export function SessionWarning() {
  const { left, extend, extending, error } = useSession();
  if (left === null || left >= WARN_MS || left <= 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 lg:left-60">
      <div role="alert"
        className="flex w-full max-w-[560px] flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-warn/40 bg-ink-900 px-4 py-3 shadow-lift">
        <Clock size={18} strokeWidth={1.75} className="shrink-0 text-warn" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-50">
            You’ll be signed out in <span className="font-mono tabular-nums text-warn" aria-hidden="true">{formatLeft(left)}</span>
            <span className="sr-only">under 10 minutes</span>
          </p>
          <p className={`text-xs ${error ? 'text-bad' : 'text-ink-400'}`}>{error || 'Sessions last 2 hours. Extend to keep working.'}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => signOut()} className="flex items-center gap-1.5 rounded-inner px-3 py-2 text-sm text-ink-300 transition hover:bg-ink-800 hover:text-ink-50">
            <LogOut size={14} aria-hidden="true" /> Sign out
          </button>
          <button onClick={extend} disabled={extending}
            className="flex items-center gap-1.5 rounded-inner bg-brand px-3 py-2 text-sm font-semibold text-ink-950 transition hover:bg-brand-soft active:translate-y-px disabled:opacity-60">
            {extending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <TimerReset size={14} aria-hidden="true" />} Extend 2 hours
          </button>
        </div>
      </div>
    </div>
  );
}
