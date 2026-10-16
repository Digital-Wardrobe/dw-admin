import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, User } from 'lucide-react';
import { API_BASE_URL } from '../config';

/**
 * "Forgot password" for admin console accounts: a 6-digit code goes to the account's own email,
 * then a new password. The server answers the same whether or not the account exists, and a new
 * password signs out every session of the account.
 */

const ROOT = `${API_BASE_URL.replace(/\/$/, '').replace(/\/admin$/, '')}/auth/admin`;
const RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{12,128}$/;
const input = 'w-full rounded-inner border border-ink-700 bg-ink-850 py-2.5 pl-10 pr-3 text-sm text-ink-50 placeholder:text-ink-400 transition focus:border-brand-line focus:outline-none';
const icon = 'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400';
const primary = 'flex w-full items-center justify-center gap-2 rounded-inner bg-brand px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60';

export default function AdminPasswordReset() {
  const [params] = useSearchParams();
  const [step, setStep] = useState<'ask' | 'reset' | 'done'>('ask');
  const [identifier, setIdentifier] = useState(params.get('u') || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const failed = (err: unknown) => {
    const res = (err as { response?: { data?: { message?: string } } })?.response;
    setError(res?.data?.message || (res ? 'Something went wrong. Please try again.' : 'We couldn’t reach the server. Check your connection and try again.'));
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!identifier.trim()) { setError('Enter your username or email address.'); return; }
    setLoading(true); setError(null);
    try {
      await axios.post(`${ROOT}/forgot-password`, { identifier: identifier.trim() });
      setStep('reset'); setWait(60); setCode('');
    } catch (err) { failed(err); } finally { setLoading(false); }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code from the email.'); return; }
    if (!RULE.test(password)) { setError('Use at least 12 characters with an uppercase letter, a lowercase letter, a number and a symbol.'); return; }
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setLoading(true); setError(null);
    try {
      await axios.post(`${ROOT}/reset-password`, { identifier: identifier.trim(), code: code.trim(), password });
      setStep('done');
    } catch (err) { failed(err); } finally { setLoading(false); }
  };

  return (
    <div className="grain flex min-h-dvh items-center justify-center bg-ink-900 px-6 py-12">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgb(var(--brand) / 0.07), transparent 70%)' }} />
      <main className="relative z-10 w-full max-w-[380px]">
        <Link to="/portal/secure-gateway-entry" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-300 transition hover:text-ink-50">
          <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" /> Back to sign in
        </Link>

        {step === 'done' ? (
          <div>
            <CheckCircle2 size={36} strokeWidth={1.5} className="mb-4 text-ok" aria-hidden="true" />
            <h1 className="text-xl font-semibold tracking-tight text-ink-50">Password changed</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
              Every session of this account was signed out, and we emailed the account to say so. Sign in with your new password.
            </p>
            <Link to="/portal/secure-gateway-entry" className={`${primary} mt-6`}>Sign in</Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-inner border border-brand-line bg-brand-wash text-brand">
                <KeyRound size={18} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-ink-50">{step === 'ask' ? 'Reset your password' : 'Check your email'}</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
                {step === 'ask'
                  ? 'We’ll email a 6-digit code to the address on your admin account.'
                  : 'If that admin account exists, a 6-digit code is on its way to its email address. It expires in 10 minutes.'}
              </p>
            </div>

            {step === 'ask' ? (
              <form onSubmit={sendCode} noValidate className="space-y-4">
                <div>
                  <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-ink-100">Username or email</label>
                  <div className="relative">
                    <User size={16} strokeWidth={1.75} aria-hidden="true" className={icon} />
                    <input id="identifier" type="text" autoComplete="username" value={identifier} autoFocus
                      onChange={(e) => { setIdentifier(e.target.value); if (error) setError(null); }} className={input} placeholder="you@fluntr.com" />
                  </div>
                </div>
                <Problem error={error} />
                <button type="submit" disabled={loading} className={primary}>
                  {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  {loading ? 'Sending' : 'Email me a code'}
                </button>
              </form>
            ) : (
              <form onSubmit={reset} noValidate className="space-y-4">
                <div>
                  <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-ink-100">Code from the email</label>
                  <div className="relative">
                    <Mail size={16} strokeWidth={1.75} aria-hidden="true" className={icon} />
                    <input id="code" inputMode="numeric" autoComplete="one-time-code" value={code} autoFocus maxLength={6}
                      onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); if (error) setError(null); }}
                      className={`${input} font-mono tracking-[0.4em]`} placeholder="••••••" />
                  </div>
                </div>
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-ink-100">New password</label>
                  <div className="relative">
                    <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" className={icon} />
                    <input id="new-password" type={show ? 'text' : 'password'} autoComplete="new-password" value={password}
                      onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }} className={`${input} pr-10`} placeholder="At least 12 characters" />
                    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide passwords' : 'Show passwords'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 transition hover:text-ink-100">
                      {show ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-400">12+ characters with an uppercase letter, a lowercase letter, a number and a symbol.</p>
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-ink-100">New password again</label>
                  <div className="relative">
                    <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" className={icon} />
                    <input id="confirm-password" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); if (error) setError(null); }} className={input} />
                  </div>
                </div>
                <Problem error={error} />
                <button type="submit" disabled={loading} className={primary}>
                  {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  {loading ? 'Saving' : 'Set new password'}
                </button>
                <button type="button" onClick={() => sendCode()} disabled={wait > 0 || loading}
                  className="w-full text-center text-sm text-ink-300 underline-offset-4 transition hover:text-ink-50 hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60">
                  {wait > 0 ? `Send a new code in ${wait}s` : 'Didn’t get it? Send a new code'}
                </button>
              </form>
            )}
          </>
        )}
      </main>
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
