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
      <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Moderation Gate</h1>
          <p className="text-sm text-[#666]">Reports submitted by users on accounts, posts, vibes, closet items, comments and mirrors.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-xl border border-[#222] px-3 py-2 text-xs text-gray-300 hover:border-[#333]">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {(['OPEN', 'RESOLVED', 'DISMISSED'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${status === s ? 'bg-white text-black' : 'bg-[#111] text-gray-400 border border-[#1A1A1A]'}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && reports.length === 0 ? (
        <div className="rounded-2xl bg-[#111] p-8 border border-[#1A1A1A] flex flex-col items-center justify-center min-h-[240px] text-center">
          <ShieldAlert size={40} className="text-gray-600 mb-3" />
          <h3 className="text-base font-bold text-gray-300">No {status.toLowerCase()} reports</h3>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#1A1A1A]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0D0D0D] text-[11px] uppercase tracking-wider text-[#666]">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Reported user</th>
                <th className="px-4 py-3">Reporter</th>
                <th className="px-4 py-3">Content ID</th>
                {status === 'OPEN' && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} className="border-t border-[#1A1A1A] align-top">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{r.contentType ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-red-300">{REASON_LABEL[r.reason] ?? r.reason}</div>
                    {r.details && <div className="mt-1 max-w-xs text-xs text-gray-400">{r.details}</div>}
                  </td>
                  <td className="px-4 py-3">{r.reportedUser ? `@${r.reportedUser.username}` : '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{r.reporter ? `@${r.reporter.username}` : '—'}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-gray-500">{r.contentId}</td>
                  {status === 'OPEN' && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {r.contentType !== 'USER' && (
                          <button disabled={busyId === r.id} onClick={() => act(r, 'RESOLVED', true)}
                            className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/25 disabled:opacity-40">
                            <Trash2 size={12} /> Remove
                          </button>
                        )}
                        <button disabled={busyId === r.id} onClick={() => act(r, 'RESOLVED')}
                          className="flex items-center gap-1 rounded-lg bg-green-500/15 px-2.5 py-1.5 text-xs text-green-300 hover:bg-green-500/25 disabled:opacity-40">
                          <Check size={12} /> Resolved
                        </button>
                        <button disabled={busyId === r.id} onClick={() => act(r, 'DISMISSED')}
                          className="flex items-center gap-1 rounded-lg bg-[#1A1A1A] px-2.5 py-1.5 text-xs text-gray-300 hover:bg-[#222] disabled:opacity-40">
                          <X size={12} /> Dismiss
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-600">For reported accounts, suspend the user from User Directory, then mark the report resolved.</p>
    </div>
  );
}
