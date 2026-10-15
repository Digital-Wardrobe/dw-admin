import { useState } from 'react';
import { BellRing, Check, Plus, Trash2 } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { PageHeader, Badge, InlineError, EmptyState, Skeleton } from '../../components/ui';
import { ChartCard, ExportButton, th, td, fmtN } from '../../components/dash';

/* Alerts: rules checked every 5 minutes on the server. A rule fires once when its condition
   becomes true and resolves itself when it stops being true. Delivered here always, and by email
   and Slack when the rule says so. */

type Rule = { id: string; name: string; metric: string; comparator: 'gt' | 'lt'; threshold: number; windowMin: number; scope: any; channels: string[]; enabled: boolean; firing: any };

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const inputCls = 'h-8 rounded-inner border border-ink-600 bg-ink-800 px-2 text-sm text-ink-100';

function RuleForm({ metrics, initial, onSave, onCancel }: { metrics: Record<string, any>; initial?: Partial<Rule>; onSave: (r: any) => Promise<void>; onCancel: () => void }) {
  const [r, setR] = useState<any>({ name: '', metric: 'spend_day_usd', comparator: 'gt', threshold: 10, windowMin: 15, scope: {}, channels: ['ui'], ...initial });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const m = metrics[r.metric] || {};
  const toggle = (c: string) => setR({ ...r, channels: r.channels.includes(c) ? r.channels.filter((x: string) => x !== c) : [...r.channels, c] });
  return (
    <form className="grid grid-cols-1 gap-3 rounded-inner border border-ink-700 bg-ink-850 p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { await onSave(r); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } }}>
      <label className="text-xs text-ink-300 sm:col-span-2">Name<input required maxLength={100} className={`${inputCls} mt-1 w-full`} value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></label>
      <label className="text-xs text-ink-300 sm:col-span-2">Watch
        <select className={`${inputCls} mt-1 w-full`} value={r.metric} onChange={(e) => setR({ ...r, metric: e.target.value })}>
          {Object.entries(metrics).map(([k, v]: any) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </label>
      <label className="text-xs text-ink-300">When it is
        <span className="mt-1 flex gap-2">
          <select className={inputCls} value={r.comparator} onChange={(e) => setR({ ...r, comparator: e.target.value })}><option value="gt">above</option><option value="lt">below</option></select>
          <input type="number" step="any" min={0} required className={`${inputCls} w-28`} value={r.threshold} onChange={(e) => setR({ ...r, threshold: Number(e.target.value) })} />
          <span className="self-center text-ink-400">{m.unit}</span>
        </span>
      </label>
      {m.window && <label className="text-xs text-ink-300">Over the last (minutes)<input type="number" min={5} max={1440} className={`${inputCls} mt-1 w-full`} value={r.windowMin} onChange={(e) => setR({ ...r, windowMin: Number(e.target.value) })} /></label>}
      {(m.scope || []).includes('provider') && <label className="text-xs text-ink-300">Provider (empty = any)<input className={`${inputCls} mt-1 w-full`} placeholder="anthropic, modal-gpu…" value={r.scope?.provider || ''} onChange={(e) => setR({ ...r, scope: { ...r.scope, provider: e.target.value || undefined } })} /></label>}
      {(m.scope || []).includes('worker') && <label className="text-xs text-ink-300">Worker<input className={`${inputCls} mt-1 w-full`} placeholder="metrics-daily, ai-queue…" value={r.scope?.worker || ''} onChange={(e) => setR({ ...r, scope: { ...r.scope, worker: e.target.value || undefined } })} /></label>}
      <fieldset className="text-xs text-ink-300">
        <legend>Tell us by</legend>
        <span className="mt-2 flex gap-3">
          {['ui', 'email', 'slack'].map((c) => <label key={c} className="inline-flex items-center gap-1"><input type="checkbox" disabled={c === 'ui'} checked={r.channels.includes(c)} onChange={() => toggle(c)} />{c === 'ui' ? 'here' : c}</label>)}
        </span>
      </fieldset>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button disabled={busy} className="h-8 rounded-inner bg-brand px-3 text-xs font-medium text-ink-950 disabled:opacity-60">{busy ? 'Saving…' : 'Save rule'}</button>
        <button type="button" onClick={onCancel} className="h-8 rounded-inner px-3 text-xs text-ink-300 hover:text-ink-100">Cancel</button>
        {err && <span className="text-xs text-bad">{err}</span>}
      </div>
    </form>
  );
}

export default function Alerts() {
  const rules = useAdminApi<any>('alerts/rules');
  const open = useAdminApi<any>('alerts/events', { params: { status: 'open' } });
  const [page, setPage] = useState(1);
  const history = useAdminApi<any>('alerts/events', { params: { status: 'all', page } });
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const canEdit = !!rules.data?.canEdit;
  const metrics = rules.data?.metrics || {};
  const refresh = () => { rules.reload(); open.reload(); history.reload(); };
  const act = async (fn: () => Promise<any>, done?: string) => { setMsg(null); try { const r = await fn(); if (done) setMsg(typeof done === 'string' ? done : ''); refresh(); return r; } catch (e: any) { setMsg(e.message); } };

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="Rules checked every 5 minutes. An alert fires once, stays open while the condition holds, and closes itself when it clears. Email goes to ALERT_EMAILS (else the SUPERADMIN staff); Slack when a webhook is set on the server."
        actions={canEdit ? <button onClick={() => act(() => adminSend('POST', 'alerts/evaluate'), 'Checked all rules now.')} className="rounded-inner border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-100 hover:border-brand-line hover:text-brand">Check now</button> : undefined}
      />
      {msg && <p className="mb-4 text-sm text-ink-300" role="status">{msg}</p>}

      <ChartCard title="Open now" caption="Alerts whose condition is still true." actions={<BellRing size={15} className="text-ink-400" aria-hidden="true" />}>
        {open.error ? <InlineError message={open.error} onRetry={open.reload} /> : !open.data ? <Skeleton className="h-16 w-full" /> : !open.data.events.length ? (
          <EmptyState title="All clear" body="No alert is firing right now." />
        ) : (
          <ul className="divide-y divide-ink-700">
            {open.data.events.map((e: any) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-ink-100">{e.message}</p>
                  <p className="text-label text-ink-400">since {when(e.firedAt)}{e.ackBy && ` · seen by ${e.ackBy}`}{e.notifiedAt && ' · sent'}</p>
                </div>
                {canEdit && !e.ackBy && <button onClick={() => act(() => adminSend('POST', `alerts/events/${e.id}/ack`))} className="inline-flex items-center gap-1 rounded-inner border border-ink-600 px-2 py-1 text-xs text-ink-100 hover:border-brand-line hover:text-brand"><Check size={13} aria-hidden="true" /> Got it</button>}
              </li>
            ))}
          </ul>
        )}
      </ChartCard>

      <div className="mt-4">
        <ChartCard title="Rules" caption="What is watched, and the threshold." actions={canEdit && editing !== 'new' ? <button onClick={() => setEditing('new')} className="inline-flex items-center gap-1 rounded-inner border border-ink-600 px-2 py-1 text-xs text-ink-100 hover:border-brand-line hover:text-brand"><Plus size={13} aria-hidden="true" /> New rule</button> : undefined}>
          {rules.error ? <InlineError message={rules.error} onRetry={rules.reload} /> : !rules.data ? <Skeleton className="h-40 w-full" /> : (
            <>
              {editing === 'new' && <div className="mb-4"><RuleForm metrics={metrics} onCancel={() => setEditing(null)} onSave={async (r) => { await adminSend('POST', 'alerts/rules', r); setEditing(null); refresh(); }} /></div>}
              {!rules.data.rules.length ? <EmptyState title="No rules yet" body="The default rules are created the first time the server checks alerts." /> : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><th className={th}>Rule</th><th className={th}>Condition</th><th className={th}>Channels</th><th className={th}>State</th>{canEdit && <th className={th} />}</tr></thead>
                    <tbody>
                      {rules.data.rules.map((r: Rule) => editing === r.id ? (
                        <tr key={r.id}><td colSpan={5} className="py-2"><RuleForm metrics={metrics} initial={r} onCancel={() => setEditing(null)} onSave={async (x) => { const { id, firing, createdAt, updatedAt, createdBy, ...body } = x; await adminSend('PATCH', `alerts/rules/${r.id}`, body); setEditing(null); refresh(); }} /></td></tr>
                      ) : (
                        <tr key={r.id} className="border-t border-ink-700">
                          <td className={td}>{r.name}</td>
                          <td className={`${td} text-ink-300`}>{metrics[r.metric]?.label || r.metric} {r.comparator === 'lt' ? '<' : '>'} {fmtN(r.threshold, 2)}{metrics[r.metric]?.unit === '%' ? '%' : ` ${metrics[r.metric]?.unit || ''}`}{metrics[r.metric]?.window ? ` over ${r.windowMin} min` : ''}{r.scope?.provider ? ` · ${r.scope.provider}` : ''}{r.scope?.worker ? ` · ${r.scope.worker}` : ''}</td>
                          <td className={`${td} text-ink-300`}>{r.channels.map((c) => (c === 'ui' ? 'here' : c)).join(', ')}</td>
                          <td className={td}>{!r.enabled ? <Badge>off</Badge> : r.firing ? <Badge tone="bad">firing</Badge> : <Badge tone="ok">ok</Badge>}</td>
                          {canEdit && (
                            <td className={`${td} text-right`}>
                              <button onClick={() => act(() => adminSend('PATCH', `alerts/rules/${r.id}`, { enabled: !r.enabled }))} className="mr-2 text-xs text-ink-300 hover:text-brand">{r.enabled ? 'Turn off' : 'Turn on'}</button>
                              <button onClick={() => setEditing(r.id)} className="mr-2 text-xs text-ink-300 hover:text-brand">Edit</button>
                              <button onClick={() => { if (confirm(`Delete “${r.name}”?`)) act(() => adminSend('DELETE', `alerts/rules/${r.id}`)); }} className="text-ink-400 hover:text-bad" aria-label={`Delete ${r.name}`}><Trash2 size={14} /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard title="History" caption="Every alert that fired, newest first." actions={<ExportButton path="alerts/events" params={{ status: 'all' }} table="events" />}>
          {history.error ? <InlineError message={history.error} onRetry={history.reload} /> : !history.data ? <Skeleton className="h-32 w-full" /> : !history.data.events.length ? <EmptyState title="Nothing has fired yet" body="Alerts show here once a rule's condition becomes true." /> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr><th className={th}>Fired</th><th className={th}>Closed</th><th className={th}>What</th><th className={th}>Seen by</th></tr></thead>
                  <tbody>
                    {history.data.events.map((e: any) => (
                      <tr key={e.id} className="border-t border-ink-700">
                        <td className={td}>{when(e.firedAt)}</td>
                        <td className={`${td} text-ink-300`}>{e.resolvedAt ? when(e.resolvedAt) : <Badge tone="bad">open</Badge>}</td>
                        <td className={`${td} whitespace-normal`}>{e.message}</td>
                        <td className={`${td} text-ink-300`}>{e.ackBy || '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {history.data.pages > 1 && (
                <div className="mt-3 flex items-center justify-end gap-2 text-xs text-ink-300">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-inner border border-ink-600 px-2 py-1 disabled:opacity-40">Newer</button>
                  <span>Page {page} of {history.data.pages}</span>
                  <button disabled={page >= history.data.pages} onClick={() => setPage(page + 1)} className="rounded-inner border border-ink-600 px-2 py-1 disabled:opacity-40">Older</button>
                </div>
              )}
            </>
          )}
        </ChartCard>
      </div>
    </>
  );
}
