import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function LoginPortal() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim()) { setError('Enter your username or email address.'); return; }
    if (!password)          { setError('Enter your password.'); return; }

    setLoading(true);
    setError(null);

    try {
      // The admin base URL ends in /api/admin/; auth lives one level up.
      const loginUrl = `${API_BASE_URL.replace(/\/$/, '').replace(/\/admin$/, '')}/auth/login`;

      const res = await axios.post(loginUrl, { identifier: identifier.trim(), password });

      if (!res.data?.success) {
        setError(res.data?.message || 'That username or password is not correct.');
        return;
      }

      const { accessToken, user } = res.data;
      const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

      if (!isAdmin) {
        // A valid account without admin rights: say so plainly rather than
        // echoing a status code at someone who cannot act on it.
        localStorage.removeItem('admin_session_token');
        localStorage.removeItem('admin_user');
        setError('This account does not have admin access. Ask an administrator to grant it.');
        return;
      }

      localStorage.setItem('admin_session_token', accessToken);
      localStorage.setItem('admin_user', JSON.stringify(user));
      navigate('/admin/dashboard');
    } catch (err: any) {
      const status = err?.response?.status;
      setError(
        status === 401 || status === 400
          ? 'That username or password is not correct.'
          : err?.response?.data?.message || 'We couldn’t reach the server. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grain flex min-h-dvh items-center justify-center bg-ink-900 px-6 py-12">
      {/* Off-centre rather than a perfectly centred card on a flat field, with
          a soft radial behind it so the panel sits in light instead of on top
          of nothing. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(201,168,76,0.07), transparent 70%)' }}
      />

      <main className="relative z-10 w-full max-w-[380px]">
        <div className="mb-8">
          <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-inner border border-brand-line bg-brand-wash font-mono text-base font-semibold text-brand">
            F
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-ink-50">Sign in to Fluntr admin</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
            Admin accounts only. Sign-ins are recorded.
          </p>
        </div>

        <form onSubmit={handleSignIn} noValidate className="space-y-4">
          <div>
            <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-ink-100">
              Username or email
            </label>
            <div className="relative">
              <User size={16} strokeWidth={1.75} aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={e => { setIdentifier(e.target.value); if (error) setError(null); }}
                className="w-full rounded-inner border border-ink-700 bg-ink-850 py-2.5 pl-10 pr-3 text-sm text-ink-50 placeholder:text-ink-400 transition focus:border-brand-line focus:outline-none"
                placeholder="you@fluntr.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-100">
              Password
            </label>
            <div className="relative">
              <Lock size={16} strokeWidth={1.75} aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); if (error) setError(null); }}
                className="w-full rounded-inner border border-ink-700 bg-ink-850 py-2.5 pl-10 pr-10 text-sm text-ink-50 placeholder:text-ink-400 transition focus:border-brand-line focus:outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 transition hover:text-ink-100"
              >
                {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          {/* Inline, next to the fields it concerns — never window.alert. */}
          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-inner border border-bad/25 bg-bad/5 px-3 py-2.5">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-bad" aria-hidden="true" />
              <p className="text-sm leading-snug text-bad">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-inner bg-brand px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {loading ? 'Signing in' : 'Sign in'}
          </button>
        </form>

        <p className="mt-8 text-xs leading-relaxed text-ink-400">
          Locked out? Another administrator can reset your password from the Team section.
        </p>
      </main>
    </div>
  );
}
