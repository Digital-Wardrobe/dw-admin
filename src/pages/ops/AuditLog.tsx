import { useState } from 'react';
import { useAdminApi } from '../../lib/useAdminApi';
import { PageHeader, Badge, InlineError, EmptyState, Skeleton } from '../../components/ui';
import { ChartCard, DashControls, useDashParams, ExportButton, th, td, fmtN } from '../../components/dash';

/* Every admin change, identity reveal and export: who, what, about whom (pseudonym), when. */

const input = 'h-8 rounded-inner border border-ink-600 bg-ink-800 px-2 text-xs text-ink-100';
const tone = (a: string) => (a.includes('reveal') || a.includes('delete') ? 'bad' : a.startsWith('export') || a.includes('lookup') || a.includes('view_content') ? 'warn' : 'neutral');

export default function AuditLog() {
  const { query, ready } = useDashParams({ range: '30d' });
  const [f, setF] = useState({ actor: '', action: '', target: '' });
  const [applied, setApplied] = useState(f);
  const [page, setPage] = useState(1);
  const params = { ...query, ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)), page };
  const { data, error, reload } = useAdminApi<any>('audit', { params, enabled: ready });
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin change, reveal of who someone is, look-up by email or phone, and export. People appear as pseudonyms." />
      <DashControls compare={false} />
      <form className="mb-4 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(f); }}>
        <input className={input} placeholder="staff name" value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })} aria-label="Staff name" />
        <select className={input} value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} aria-label="Action"><option value="">any action</option>{(data?.actions || []).map((a: string) => <option key={a}>{a}</option>)}</select>
        <input className={`${input} font-mono`} placeholder="u_… (person)" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} aria-label="Person pid" />
        <button className="h-8 rounded-inner bg-brand px-3 text-xs font-medium text-ink-950">Filter</button>
        <span className="ml-auto"><ExportButton path="audit" params={params} table="audit" /></span>
      </form>
      <ChartCard title="Entries" caption={data ? `${fmtN(data.total)} in the range, newest first.` : 'Loading'}>
        {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-64 w-full" /> : !data.rows.length ? <EmptyState title="Nothing logged" body="No admin actions match these filters in this range." /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className={th}>When</th><th className={th}>Who</th><th className={th}>Action</th><th className={th}>About</th><th className={th}>Details</th></tr></thead>
                <tbody>{data.rows.map((r: any) => (
                  <tr key={r.id} className="border-t border-ink-700 align-top">
                    <td className={`${td} text-xs text-ink-300`}>{new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className={td}>{r.actorName || '–'}<span className="block text-label text-ink-400">{r.actorRole}</span></td>
                    <td className={td}><Badge tone={tone(r.action)}>{r.action}</Badge></td>
                    <td className={`${td} font-mono text-xs`}>{r.targetPseudo || (r.targetType ? r.targetType : '–')}</td>
                    <td className={`${td} max-w-md whitespace-normal font-mono text-[11px] text-ink-400`}>{r.metadata ? JSON.stringify(r.metadata) : ''}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {data.pages > 1 && <div className="mt-3 flex justify-end gap-2 text-xs text-ink-300"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-inner border border-ink-600 px-2 py-1 disabled:opacity-40">Newer</button><span className="self-center">{page} / {data.pages}</span><button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="rounded-inner border border-ink-600 px-2 py-1 disabled:opacity-40">Older</button></div>}
          </>
        )}
      </ChartCard>
    </>
  );
}
