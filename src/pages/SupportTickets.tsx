import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { LifeBuoy, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { getAdminToken } from '../lib/useAdminApi';
import { PageHeader, Card, Badge, EmptyState, InlineError } from '../components/ui';

/* Support inbox. Beautify tickets arrive with the source photo, the studio
   shots that went wrong and the quality-check numbers, so the decision can be
   made from the ticket alone. A note on Resolve is sent to the user. */

type Ticket = {
  id: string; kind: string; subject: string; message: string | null; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  attachments: string[]; context: any; adminNote: string | null; createdAt: string;
  user: { id: string; username: string; plan: string } | null;
};
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ');
const authed = () => ({ headers: { Authorization: `Bearer ${getAdminToken()}` } });

export default function SupportTickets() {
  const [status, setStatus] = useState<typeof STATUSES[number]>('OPEN');
  const [rows, setRows] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}tickets?status=${status}`, authed());
      setRows(res.data.data?.tickets ?? []); setCounts(res.data.data?.counts ?? {});
    } catch (e: any) { setError(e?.response?.data?.message || 'Could not load tickets.'); } finally { setLoading(false); }
  }, [status]);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  const update = async (t: Ticket, next: Ticket['status']) => {
    setBusy(t.id);
    try {
      await axios.patch(`${API_BASE_URL}tickets/${t.id}`, { status: next, adminNote: notes[t.id] ?? t.adminNote ?? undefined }, authed());
      setRows(r => r.filter(x => x.id !== t.id));
      setCounts(c => ({ ...c, [t.status]: Math.max(0, (c[t.status] ?? 1) - 1), [next]: (c[next] ?? 0) + 1 }));
    } catch (e: any) { alert(e?.response?.data?.message || 'Update failed.'); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Support" subtitle="Tickets raised from the app. Studio-shot tickets carry the photos and quality scores."
        actions={<button onClick={load} className="inline-flex items-center gap-1.5 rounded-inner border border-ink-700 px-3 py-2 text-xs text-ink-200 hover:border-brand-line">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh</button>} />
      <div className="flex flex-wrap gap-2" role="tablist">
        {STATUSES.map(s => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${status === s ? 'bg-ink-50 text-ink-900' : 'border border-ink-700 bg-ink-800 text-ink-300'}`}>
            {label(s)}{counts[s] ? ` · ${counts[s]}` : ''}
          </button>
        ))}
      </div>
      {error && <InlineError message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && <EmptyState icon={<LifeBuoy size={28} />} title={`No ${label(status).toLowerCase()} tickets`} body="Tickets users raise from the app show up here." />}
      <ul className="space-y-3">
        {rows.map(t => (
          <li key={t.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={t.kind === 'beautify' ? 'brand' : 'neutral'}>{t.kind}</Badge>
                    {t.context?.refunded && <Badge tone="ok">use given back</Badge>}
                    {t.context?.qc?.ok === false && <Badge tone="bad">failed quality check</Badge>}
                    {t.context?.qc?.ok === true && <Badge tone="warn">passed quality check</Badge>}
                  </div>
                  <p className="mt-2 text-sm font-medium text-ink-100">{t.subject}</p>
                  {t.message && <p className="mt-1 text-sm text-ink-300">{t.message}</p>}
                  <p className="mt-1 text-xs text-ink-400">{t.user ? `@${t.user.username} · ${t.user.plan}` : 'unknown user'} · {new Date(t.createdAt).toLocaleString()}</p>
                  {t.context?.qc?.reasons?.length > 0 && <p className="mt-1 text-xs text-ink-400">Check: {t.context.qc.reasons.join(', ')}{t.context.retryN ? ` · retry #${t.context.retryN}` : ''}</p>}
                </div>
              </div>
              {t.attachments.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {t.attachments.map((u, i) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="shrink-0">
                      <img src={u} alt={i === 0 ? 'Source photo' : `Studio shot ${i}`} className="h-36 w-28 rounded-inner border border-ink-700 bg-white object-contain" />
                    </a>
                  ))}
                </div>
              )}
              {(t.status === 'OPEN' || t.status === 'IN_PROGRESS') && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input aria-label="Note to the user" placeholder="Note to the user (sent when resolved)" value={notes[t.id] ?? t.adminNote ?? ''}
                    onChange={e => setNotes(n => ({ ...n, [t.id]: e.target.value }))}
                    className="min-w-0 flex-1 rounded-inner border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-ink-50 focus:border-brand-line focus:outline-none" />
                  <div className="flex gap-2">
                    {t.status === 'OPEN' && <button disabled={busy === t.id} onClick={() => update(t, 'IN_PROGRESS')} className="rounded-inner border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-700 disabled:opacity-40">In progress</button>}
                    <button disabled={busy === t.id} onClick={() => update(t, 'RESOLVED')} className="rounded-inner border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100 disabled:opacity-40">Resolve</button>
                    <button disabled={busy === t.id} onClick={() => update(t, 'CLOSED')} className="rounded-inner border border-ink-700 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-700 disabled:opacity-40">Close</button>
                  </div>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
