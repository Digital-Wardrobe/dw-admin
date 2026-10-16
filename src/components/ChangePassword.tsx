import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, X } from 'lucide-react';
import { adminSend } from '../lib/api';
import { endSession } from '../lib/session';

/**
 * Change your own console password, in two steps: a 6-digit code to the account's email, then the
 * code + current password + new password. Every session of the account is signed out, this one
 * too, so you sign in again with the new password.
 */
const RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{12,128}$/;
const field = 'w-full rounded-inner border border-ink-700 bg-ink-850 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-400 transition focus:border-brand-line focus:outline-none';
const primary = 'flex w-full items-center justify-center gap-2 rounded-inner bg-brand px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-soft active:translate-y-px disabled:opacity-60';

export default function ChangePassword({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'start' | 'form' | 'done'>('start');
  const [sentTo, setSentTo] = useState('');
  const [wait, setWait] = useState(0);
  const [code, setCode] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // Done: this session has ended on the server too; go and sign in with the new password
  useEffect(() => {
    if (step !== 'done') return;
    const t = setTimeout(() => endSession('password'), 2500);
    return () => clearTimeout(t);
  }, [step]);

  const failed = (err: unknown, fallback: string) => setError(err instanceof Error && err.message ? err.message : fallback);

  const sendCode = async () => {
    setBusy(true); setError(null);
    try {
      const r = await adminSend<{ sentTo: string; wait: number }>('POST', 'me/password/code');
      setSentTo(r.sentTo);
      setWait(r.wait > 0 ? r.wait : 60);
      if (r.wait > 0 && step === 'form') setError(`Wait ${r.wait} seconds before asking for another code.`);
      setStep('form');
    } catch (err) { failed(err, 'Could not send the code.'); } finally { setBusy(false); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from the email.'); return; }
    if (!current) { setError('Enter your current password.'); return; }
    if (!RULE.test(next)) { setError('Use at least 12 characters with an uppercase letter, a lowercase letter, a number and a symbol.'); return; }
    if (next !== confirm) { setError('The two new passwords don’t match.'); return; }
    setBusy(true); setError(null);
    try {
      await adminSend('POST', 'me/password', { code, currentPassword: current, newPassword: next });
      setStep('done');
    } catch (err) { failed(err, 'Could not change the password.'); } finally { setBusy(false); }
  };

  const close = step === 'done' ? () => endSession('password') : onClose;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Change password" onClick={close}>
      <div className="w-full max-w-[400px] rounded-card border border-ink-700 bg-ink-900 p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-50"><KeyRound size={16} strokeWidth={1.75} aria-hidden="true" /> Change password</h2>
          <button onClick={close} aria-label="Close" className="rounded p-1 text-ink-400 transition hover:text-ink-100"><X size={16} /></button>
        </div>

        {step === 'done' ? (
          <div role="status">
            <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-200">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
              Password changed. Every session of this account was signed out, this one too. Taking you to sign in…
            </p>
            <button onClick={close} className={`${primary} mt-5`}>Sign in with the new password</button>
          </div>
        ) : step === 'start' ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-300">
              First we’ll email a 6-digit code to the address on your admin account, to make sure it’s you.
            </p>
            <p className="rounded-inner border border-ink-700 bg-ink-850 px-3 py-2.5 text-xs leading-relaxed text-ink-300">
              Changing the password signs this account out everywhere, including here. You’ll sign in again with the new one.
            </p>
            <Problem error={error} />
            <button onClick={sendCode} disabled={busy} className={primary} autoFocus>
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Mail size={15} aria-hidden="true" />}
              {busy ? 'Sending' : 'Email me a code'}
            </button>
          </div>
        ) : (
          <form onSubmit={save} noValidate className="space-y-3">
            <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-300">
              <Mail size={15} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
              <span>We sent a code to <span className="font-medium text-ink-100">{sentTo}</span>. It expires in 10 minutes.</span>
            </p>
            <label className="block text-sm font-medium text-ink-100">Code from the email
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                className={`${field} mt-1.5 font-mono tracking-[0.4em]`} placeholder="••••••" />
            </label>
            <label className="block text-sm font-medium text-ink-100">Current password
              <input type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setError(null); }} className={`${field} mt-1.5`} />
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
            <p className="text-xs leading-relaxed text-ink-400">12+ characters with an uppercase letter, a lowercase letter, a number and a symbol. You’ll be signed out everywhere, including here.</p>
            <Problem error={error} />
            <button type="submit" disabled={busy} className={primary}>
              {busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />} {busy ? 'Saving' : 'Change password and sign out'}
            </button>
            <button type="button" onClick={sendCode} disabled={wait > 0 || busy}
              className="w-full text-center text-sm text-ink-300 underline-offset-4 transition hover:text-ink-50 hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60">
              {wait > 0 ? `Send a new code in ${wait}s` : 'Didn’t get it? Send a new code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Problem({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-inner border border-bad/25 bg-bad/5 px-3 py-2.5">
      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-bad" aria-hidden="true" />
      <p className="text-sm leading-snug text-bad">{error}</p>
    </div>
  );
}
