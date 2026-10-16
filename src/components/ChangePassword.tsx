import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react';
import { adminSend } from '../lib/api';

/**
 * Change your own console password (current + new). The server signs out every other session and
 * hands this one a fresh token, so you stay signed in here.
 */
const RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{12,128}$/;
const field = 'w-full rounded-inner border border-ink-700 bg-ink-850 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-400 transition focus:border-brand-line focus:outline-none';

export default function ChangePassword({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) { setError('Enter your current password.'); return; }
    if (!RULE.test(next)) { setError('Use at least 12 characters with an uppercase letter, a lowercase letter, a number and a symbol.'); return; }
    if (next !== confirm) { setError('The two new passwords don’t match.'); return; }
    setBusy(true); setError(null);
    try {
      const r = await adminSend<{ accessToken: string }>('POST', 'me/password', { currentPassword: current, newPassword: next });
      if (r?.accessToken) localStorage.setItem('admin_session_token', r.accessToken);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not change the password.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Change password" onClick={onClose}>
      <div className="w-full max-w-[400px] rounded-card border border-ink-700 bg-ink-900 p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-50"><KeyRound size={16} strokeWidth={1.75} aria-hidden="true" /> Change password</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-ink-400 transition hover:text-ink-100"><X size={16} /></button>
        </div>
        {done ? (
          <div>
            <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-200">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
              Password changed. Every other session was signed out; you stay signed in here.
            </p>
            <button onClick={onClose} className="mt-5 w-full rounded-inner bg-brand px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-soft">Done</button>
          </div>
        ) : (
          <form onSubmit={save} noValidate className="space-y-3">
            <label className="block text-sm font-medium text-ink-100">Current password
              <input type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setError(null); }} className={`${field} mt-1.5`} autoFocus />
            </label>
            <label className="block text-sm font-medium text-ink-100">New password
              <input type={show ? 'text' : 'password'} autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setError(null); }} className={`${field} mt-1.5`} placeholder="At least 12 characters" />
            </label>
            <label className="block text-sm font-medium text-ink-100">New password again
              <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(null); }} className={`${field} mt-1.5`} />
            </label>
            <button type="button" onClick={() => setShow((s) => !s)} className="flex items-center gap-1.5 text-xs text-ink-300 transition hover:text-ink-100">
              {show ? <EyeOff size={14} /> : <Eye size={14} />} {show ? 'Hide passwords' : 'Show passwords'}
            </button>
            <p className="text-xs leading-relaxed text-ink-400">12+ characters with an uppercase letter, a lowercase letter, a number and a symbol. Changing it signs out your other sessions.</p>
            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-inner border border-bad/25 bg-bad/5 px-3 py-2.5">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-bad" aria-hidden="true" />
                <p className="text-sm leading-snug text-bad">{error}</p>
              </div>
            )}
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-inner bg-brand px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-soft disabled:opacity-60">
              {busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />} {busy ? 'Saving' : 'Change password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
