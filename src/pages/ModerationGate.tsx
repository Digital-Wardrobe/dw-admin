import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldAlert, Check, X, Trash2, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';

type Report = {
  id: string;
  contentType: string | null;
  contentId: string | null;
  reason: string;
  details: string | null;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  reporter: { id: string; username: string } | null;
  reportedUser: { id: string; username: string; profileName: string | null } | null;
};

const REASON_LABEL: Record<string, string> = {
  SPAM: 'Spam', NUDITY: 'Nudity / sexual', HATE: 'Hate speech', VIOLENCE: 'Violence',
  HARASSMENT: 'Bullying / harassment', SCAM: 'Scam / fraud', FALSE_INFO: 'False information',
  IP_VIOLATION: 'IP violation', SELF_HARM: 'Suicide / self-injury', OTHER: 'Other',
};

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('admin_session_token')}` } });

export default function ModerationGate() {
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED' | 'DISMISSED'>('OPEN');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const errorMessage = (err: unknown, fallback: string) =>
    (axios.isAxiosError(err) && err.response?.data?.message) || fallback;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}reports?status=${status}`, auth());
      setReports(res.data.data ?? []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load reports.'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    const t = setTimeout(load, 0); // defer so state updates don't run inside the effect body
    return () => clearTimeout(t);
  }, [load]);

  const act = async (r: Report, next: 'RESOLVED' | 'DISMISSED', removeContent = false) => {
    if (removeContent && !window.confirm(`Remove this ${r.contentType?.toLowerCase().replace('_', ' ')}? This hides it from the app.`)) return;
    setBusyId(r.id);
    try {
      await axios.patch(`${API_BASE_URL}reports/${r.id}`, { status: next, removeContent }, auth());
      // Other open reports on the same content close too
      setReports(prev => prev.filter(x => !(x.contentId === r.contentId && x.contentType === r.contentType)));
    } catch (err) {
      alert(errorMessage(err, 'Action failed.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-ink-700 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-50">Moderation Gate</h1>
          <p className="text-sm text-ink-300">Reports submitted by users on accounts, posts, vibes, closet items, comments and mirrors.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-inner border border-ink-700 px-3 py-2 text-xs text-ink-200 hover:border-brand-line">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {(['OPEN', 'RESOLVED', 'DISMISSED'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${status === s ? 'bg-ink-50 text-ink-900' : 'bg-ink-800 text-ink-300 border border-ink-700'}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {!loading && !error && reports.length === 0 ? (
        <div className="rounded-card bg-ink-800 p-8 border border-ink-700 flex flex-col items-center justify-center min-h-[240px] text-center">
          <ShieldAlert size={40} className="text-ink-400 mb-3" />
          <h3 className="text-base font-semibold text-ink-100">No {status.toLowerCase()} reports</h3>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map(r => (
            <li key={r.id} className="rounded-card border border-ink-700 bg-ink-800 p-4 shadow-card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.4fr_1.2fr]">
                  <div className="min-w-0">
                    <div className="text-label uppercase text-ink-400">Content</div>
                    <div className="mt-1 text-sm font-medium text-ink-100">{r.contentType ?? 'Unknown'}</div>
                    <div className="truncate font-mono text-xs text-ink-400" title={r.contentId ?? ''}>{r.contentId ?? 'no id'}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-label uppercase text-ink-400">Reason</div>
                    <div className="mt-1 text-sm font-semibold text-red-700">{REASON_LABEL[r.reason] ?? r.reason}</div>
                    {r.details && <div className="mt-1 text-xs leading-relaxed text-ink-300">{r.details}</div>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-label uppercase text-ink-400">People</div>
                    <div className="mt-1 truncate text-sm text-ink-100">
                      {r.reportedUser ? `@${r.reportedUser.username}` : 'No user'}
                    </div>
                    <div className="truncate text-xs text-ink-400">
                      reported by {r.reporter ? `@${r.reporter.username}` : 'unknown'}
                    </div>
                    <div className="text-xs text-ink-400">{new Date(r.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                {status === 'OPEN' && (
                  <div className="flex flex-wrap gap-2 lg:w-[370px] lg:shrink-0 lg:flex-nowrap lg:justify-end">
                    {r.contentType !== 'USER' && (
                      <button disabled={busyId === r.id} onClick={() => act(r, 'RESOLVED', true)}
                        className="flex items-center gap-1 whitespace-nowrap rounded-inner border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40">
                        <Trash2 size={12} /> Remove content
                      </button>
                    )}
                    <button disabled={busyId === r.id} onClick={() => act(r, 'RESOLVED')}
                      className="flex items-center gap-1 whitespace-nowrap rounded-inner border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100 disabled:opacity-40">
                      <Check size={12} /> Resolved
                    </button>
                    <button disabled={busyId === r.id} onClick={() => act(r, 'DISMISSED')}
                      className="flex items-center gap-1 whitespace-nowrap rounded-inner border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs font-medium text-ink-200 hover:bg-ink-700 disabled:opacity-40">
                      <X size={12} /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-400">For reported accounts, suspend the user from User Directory, then mark the report resolved.</p>
    </div>
  );
}
