import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { useMe } from '../../lib/me';
import { PageHeader, InlineError, EmptyState, Skeleton, Badge } from '../../components/ui';
import { ChartCard, ExportButton, SourceBadge, th, td, fmtUsd, fmtN, fmtPct } from '../../components/dash';

/* Our ledger's estimate against what each provider says we spent. Anthropic is pulled daily
   from its Admin API when the server has an Admin key; the rest come from the invoice, entered
   once a month. A big gap means a price in the price table is out of date (or calls are missing). */

const monthsBack = (n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7); });

function ManualEntry({ provider, month, current, onSaved }: { provider: string; month: string; current: number | null; onSaved: () => void }) {
  const [v, setV] = useState(current != null ? String(current) : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try { await adminSend('PUT', 'ai/reconciliation/manual', { provider, month, costUsd: v === '' ? null : Number(v), note }); onSaved(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
    }}>
      <span className="text-xs text-ink-400">$</span>
      <input aria-label={`Invoice total for ${provider}`} type="number" min={0} step="0.01" value={v} onChange={(e) => setV(e.target.value)} className="h-7 w-24 rounded-inner border border-ink-600 bg-ink-800 px-2 text-xs text-ink-100" />
      <input aria-label="Note" placeholder="invoice no." maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className="h-7 w-28 rounded-inner border border-ink-600 bg-ink-800 px-2 text-xs text-ink-100" />
      <button disabled={busy} className="h-7 rounded-inner border border-ink-600 px-2 text-xs text-ink-100 hover:border-brand-line hover:text-brand disabled:opacity-50">{busy ? '…' : 'Save'}</button>
      {err && <span className="text-xs text-bad">{err}</span>}
    </form>
  );
}

export default function Reconciliation() {
  const { can } = useMe();
  const [month, setMonth] = useState(monthsBack(1)[0]);
  const { data, loading, error, reload } = useAdminApi<any>('ai/reconciliation', { params: { month } });
  const [pull, setPull] = useState<string | null>(null);
  const edit = can('ops.write');

  return (
    <>
      <PageHeader
        title="Reconciliation"
        subtitle="Our estimate (usage × price table) next to what each provider says we spent. Anthropic comes from its Admin API daily when the server has an Admin key; enter the others from the invoice once a month. Compare whole months: Anthropic's days are UTC, ours are India time."
        actions={
          <select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 rounded-inner border border-ink-600 bg-ink-800 px-2 text-xs text-ink-100">
            {monthsBack(12).map((m) => <option key={m} value={m}>{new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</option>)}
          </select>
        }
      />
      {data && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-ink-300">
          <span>Anthropic Admin API: {data.anthropicAdminConfigured ? <Badge tone="ok">connected</Badge> : <Badge>not set up (ANTHROPIC_ADMIN_KEY)</Badge>}</span>
          {data.lastPullAt && <span>last pulled {new Date(data.lastPullAt).toLocaleString('en-IN')}</span>}
          {edit && data.anthropicAdminConfigured && (
            <button onClick={async () => { setPull('Pulling…'); try { const r = await adminSend('POST', 'ai/reconciliation/pull'); setPull(`Pulled ${r.days ?? 0} days.`); reload(); } catch (e: any) { setPull(e.message); } }}
              className="inline-flex items-center gap-1 rounded-inner border border-ink-600 px-2 py-1 text-ink-100 hover:border-brand-line hover:text-brand"><RefreshCw size={12} aria-hidden="true" /> Pull now</button>
          )}
          {pull && <span role="status">{pull}</span>}
        </div>
      )}
      <ChartCard title={`Spend by provider, ${data?.from ?? ''} to ${data?.to ?? ''}`} caption="A gap over about 10% usually means a price in the price table needs updating." actions={<ExportButton path="ai/reconciliation" params={{ month }} table="providers" />}>
        {error ? <InlineError message={error} onRetry={reload} /> : loading || !data ? <Skeleton className="h-48 w-full" /> : !data.rows.length ? <EmptyState title="No spend this month" body="Nothing recorded or reported yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>Provider</th><th className={`${th} text-right`}>Calls</th><th className={`${th} text-right`}>Our estimate</th><th className={`${th} text-right`}>Provider says</th><th className={`${th} text-right`}>Gap</th>{edit && <th className={th}>Invoice total (manual)</th>}</tr></thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={r.provider} className="border-t border-ink-700">
                    <td className={td}>{r.provider}</td>
                    <td className={`${td} text-right`} data-numeric>{fmtN(r.calls)}</td>
                    <td className={`${td} text-right`} data-numeric>{fmtUsd(r.estimatedUsd)} <SourceBadge source="estimated" /></td>
                    <td className={`${td} text-right`} data-numeric>{r.reportedUsd == null ? <span className="text-ink-400">–</span> : <>{fmtUsd(r.reportedUsd)} <SourceBadge source={r.reportedSource === 'manual' ? 'manual' : 'provider'} /></>}{r.reportedDays ? <span className="block text-label text-ink-400">{r.reportedDays} days</span> : null}</td>
                    <td className={`${td} text-right`} data-numeric>{r.gapUsd == null ? '–' : <span className={Math.abs(r.gapPct ?? 0) > 0.1 ? 'text-warn' : 'text-ink-100'}>{r.gapUsd >= 0 ? '+' : ''}{fmtUsd(r.gapUsd)} ({fmtPct(r.gapPct, 0)})</span>}</td>
                    {edit && <td className={td}>{r.provider === 'anthropic' && data.anthropicAdminConfigured ? <span className="text-label text-ink-400">from the API</span> : <ManualEntry provider={r.provider} month={month} current={r.reportedSource === 'manual' ? r.reportedUsd : null} onSaved={reload} />}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </>
  );
}
