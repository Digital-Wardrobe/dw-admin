import { useState } from 'react';
import { RotateCcw, Pencil } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { PageHeader, Badge, InlineError, Skeleton } from '../../components/ui';
import { ChartCard, th, td } from '../../components/dash';

/* The one price table every cost on the dashboards is estimated from. Defaults live in the API
   (src/config/aiPrices.js); an edit here saves an override that wins over the default and takes
   effect within a minute. Past calls keep the cost they were recorded with. SUPERADMIN only. */

const MODEL_FIELDS = ['inputPerM', 'outputPerM', 'cacheReadPerM', 'cacheWritePerM', 'perGpuSecond', 'perCpuSecond', 'perImage', 'perRequest', 'idleTailSeconds'];
const FIELD_LABEL: Record<string, string> = {
  inputPerM: 'Input $/M tokens', outputPerM: 'Output $/M', cacheReadPerM: 'Cache read $/M', cacheWritePerM: 'Cache write $/M',
  perGpuSecond: '$/GPU second', perCpuSecond: '$/CPU second', perImage: '$/image', perRequest: '$/request', idleTailSeconds: 'Idle tail (s)',
  monthlyBudgetUsd: 'Budget $/month', monthlyCreditUsd: 'Free credit $/month', monthlyRequests: 'Requests/month', rpm: 'Per minute', rph: 'Per hour',
  usdInr: '₹ per $', totalMonthlyUsd: 'All AI $/month', gstPct: 'GST %',
};
const inputCls = 'h-7 w-28 rounded-inner border border-ink-600 bg-ink-800 px-2 text-xs text-ink-100';

/** Edits one entry: numbers, flags, short text, and one level of nested numbers (e.g. feesPct). */
function EntryEditor({ value, fields, onSave, onCancel }: { value: any; fields: string[]; onSave: (v: any) => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState<any>(() => JSON.parse(JSON.stringify(value ?? {})));
  const [err, setErr] = useState<string | null>(null);
  const keys = [...new Set([...fields, ...Object.keys(v)])];
  const set = (k: string, x: any) => setV({ ...v, [k]: x });
  return (
    <form className="flex flex-wrap items-end gap-3 rounded-inner border border-ink-700 bg-ink-850 p-3" onSubmit={async (e) => { e.preventDefault(); setErr(null); try { await onSave(v); } catch (x: any) { setErr(x.message); } }}>
      {keys.map((k) => {
        const cur = v[k];
        if (typeof cur === 'boolean' || k === 'free') return <label key={k} className="text-xs text-ink-300"><span className="mb-1 block text-label uppercase text-ink-400">{k}</span><input type="checkbox" checked={!!cur} onChange={(e) => set(k, e.target.checked || undefined)} /></label>;
        if (cur && typeof cur === 'object') return (
          <fieldset key={k} className="flex flex-wrap gap-2 text-xs text-ink-300"><legend className="mb-1 text-label uppercase text-ink-400">{k}</legend>
            {Object.entries(cur).map(([kk, vv]) => <label key={kk}>{kk} <input type="number" step="any" min={0} className={inputCls} value={vv as any} onChange={(e) => set(k, { ...cur, [kk]: Number(e.target.value) })} /></label>)}
          </fieldset>
        );
        if (typeof cur === 'string' && !FIELD_LABEL[k]) return <label key={k} className="text-xs text-ink-300"><span className="mb-1 block text-label uppercase text-ink-400">{k}</span><input className={`${inputCls} w-56`} value={cur} onChange={(e) => set(k, e.target.value)} /></label>;
        return <label key={k} className="text-xs text-ink-300"><span className="mb-1 block text-label uppercase text-ink-400">{FIELD_LABEL[k] || k}</span><input type="number" step="any" min={0} className={inputCls} value={cur ?? ''} onChange={(e) => set(k, e.target.value === '' ? undefined : Number(e.target.value))} /></label>;
      })}
      <button className="h-7 rounded-inner bg-brand px-3 text-xs font-medium text-ink-950">Save override</button>
      <button type="button" onClick={onCancel} className="h-7 px-2 text-xs text-ink-300 hover:text-ink-100">Cancel</button>
      {err && <span className="text-xs text-bad">{err}</span>}
    </form>
  );
}

export default function PriceTable() {
  const { data, loading, error, reload } = useAdminApi<any>('prices');
  const [editing, setEditing] = useState<string | null>(null);
  const [routeText, setRouteText] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const canEdit = !!data?.canEdit;
  const overridden = new Set((data?.overrides || []).map((o: any) => o.key));
  const save = async (key: string, value: any) => { await adminSend('PUT', 'prices', { key, value }); setEditing(null); setMsg(`Saved ${key}. New calls use it within a minute.`); reload(); };
  const reset = async (key: string) => { if (!confirm(`Go back to the default for ${key}?`)) return; try { await adminSend('PUT', 'prices', { key, value: null }); setMsg(`${key} is back to its default.`); reload(); } catch (e: any) { setMsg(e.message); } };

  const Actions = ({ k }: { k: string }) => canEdit ? (
    <span className="inline-flex gap-2">
      <button onClick={() => setEditing(k)} className="text-ink-400 hover:text-brand" aria-label={`Edit ${k}`}><Pencil size={13} /></button>
      {overridden.has(k) && <button onClick={() => reset(k)} className="text-ink-400 hover:text-warn" aria-label={`Reset ${k}`} title="Back to the default"><RotateCcw size={13} /></button>}
    </span>
  ) : null;
  const Tag = ({ k }: { k: string }) => (overridden.has(k) ? <Badge tone="warn">edited</Badge> : null);

  if (error) return <><PageHeader title="Price table" /><InlineError message={error} onRetry={reload} /></>;
  if (loading || !data) return <><PageHeader title="Price table" /><Skeleton className="h-96 w-full" /></>;
  const t = data.table;

  return (
    <>
      <PageHeader
        title="Price table"
        subtitle={`What every AI model, GPU and paid API costs (USD), each provider's allowance and budget, and the finance settings revenue is computed with. Version ${t.version}. Edits save an override on top of the defaults in the API and apply to new calls within a minute; past calls keep the cost they were recorded with.${canEdit ? '' : ' Only a SUPERADMIN can edit.'}`}
      />
      {msg && <p className="mb-4 text-sm text-ink-300" role="status">{msg}</p>}

      <ChartCard title="Models" caption="Per call: tokens, GPU or CPU seconds, images or a flat request price. “provider:*” is the fallback for that provider.">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className={th}>Model</th>{MODEL_FIELDS.map((f) => <th key={f} className={`${th} text-right`}>{FIELD_LABEL[f]}</th>)}<th className={th} /></tr></thead>
            <tbody>
              {Object.entries(t.models).map(([id, p]: any) => {
                const key = `models:${id}`;
                return editing === key ? (
                  <tr key={id}><td colSpan={MODEL_FIELDS.length + 2} className="py-2"><EntryEditor value={p} fields={MODEL_FIELDS} onCancel={() => setEditing(null)} onSave={(v) => save(key, v)} /></td></tr>
                ) : (
                  <tr key={id} className="border-t border-ink-700">
                    <td className={td}>{id} <Tag k={key} /> {p.free && <Badge tone="ok">free</Badge>}</td>
                    {MODEL_FIELDS.map((f) => <td key={f} className={`${td} text-right text-ink-300`} data-numeric>{p[f] != null ? +Number(p[f]).toPrecision(4) : ''}</td>)}
                    <td className={`${td} text-right`}><Actions k={key} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <div className="mt-4">
        <ChartCard title="Providers" caption="Budgets, free allowances and rate limits behind the provider cards, the limits list and the default alerts.">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>Provider</th>{['monthlyBudgetUsd', 'monthlyCreditUsd', 'monthlyRequests', 'rpm', 'rph'].map((f) => <th key={f} className={`${th} text-right`}>{FIELD_LABEL[f]}</th>)}<th className={th}>Note</th><th className={th} /></tr></thead>
              <tbody>
                {Object.entries(t.providers).map(([id, p]: any) => {
                  const key = `providers:${id}`;
                  return editing === key ? (
                    <tr key={id}><td colSpan={8} className="py-2"><EntryEditor value={p} fields={['monthlyBudgetUsd', 'monthlyCreditUsd', 'monthlyRequests']} onCancel={() => setEditing(null)} onSave={(v) => save(key, v)} /></td></tr>
                  ) : (
                    <tr key={id} className="border-t border-ink-700">
                      <td className={td}>{p.label || id} <Tag k={key} /></td>
                      {['monthlyBudgetUsd', 'monthlyCreditUsd', 'monthlyRequests', 'rpm', 'rph'].map((f) => <td key={f} className={`${td} text-right text-ink-300`} data-numeric>{p[f] ?? ''}</td>)}
                      <td className={`${td} max-w-xs whitespace-normal text-xs text-ink-400`}>{p.warning || p.note || ''}</td>
                      <td className={`${td} text-right`}><Actions k={key} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[
          { key: 'fx', title: 'Exchange rate', caption: 'Rupees per dollar, for showing USD costs in ₹.', fields: ['usdInr'] },
          { key: 'budgets', title: 'Total budget', caption: 'All AI and paid APIs, per month (USD).', fields: ['totalMonthlyUsd'] },
          { key: 'finance', title: 'Finance', caption: 'GST and the store / gateway fee by payment source (%), for net revenue.', fields: ['gstPct'] },
        ].map((s) => (
          <ChartCard key={s.key} title={s.title} caption={s.caption} actions={<><Tag k={s.key} /><Actions k={s.key} /></>}>
            {editing === s.key ? <EntryEditor value={t[s.key]} fields={s.fields} onCancel={() => setEditing(null)} onSave={(v) => save(s.key, v)} /> : (
              <dl className="space-y-1 text-sm">
                {Object.entries(t[s.key] || {}).map(([k, v]: any) => typeof v === 'object'
                  ? Object.entries(v).map(([kk, vv]: any) => <div key={kk} className="flex justify-between"><dt className="text-ink-300">{k}.{kk}</dt><dd data-numeric className="text-ink-100">{vv}</dd></div>)
                  : <div key={k} className="flex justify-between"><dt className="text-ink-300">{FIELD_LABEL[k] || k}</dt><dd data-numeric className="text-ink-100">{v}</dd></div>)}
              </dl>
            )}
          </ChartCard>
        ))}
      </div>

      <div className="mt-4">
        <ChartCard title="Routes (move or keep)" caption="The routes each feature could run on, compared on the Move or keep page. JSON: id, label, model (provider:model), usage per call, fixedMonthlyUsd.">
          <div className="space-y-4">
            {Object.entries(t.routes || {}).map(([feature, routes]: any) => {
              const key = `routes:${feature}`;
              const text = routeText[key] ?? JSON.stringify(routes, null, 2);
              return (
                <div key={feature}>
                  <div className="mb-1 flex items-center gap-2 text-sm text-ink-100">{feature} <Tag k={key} /> {canEdit && overridden.has(key) && <button onClick={() => reset(key)} className="text-ink-400 hover:text-warn" aria-label={`Reset ${key}`}><RotateCcw size={13} /></button>}</div>
                  <textarea readOnly={!canEdit} spellCheck={false} aria-label={`Routes for ${feature}`} value={text} onChange={(e) => setRouteText({ ...routeText, [key]: e.target.value })}
                    className="h-40 w-full rounded-inner border border-ink-600 bg-ink-850 p-2 font-mono text-xs text-ink-100" />
                  {canEdit && routeText[key] != null && (
                    <button onClick={async () => { try { await save(key, JSON.parse(text)); setRouteText({ ...routeText, [key]: undefined as any }); } catch (e: any) { setMsg(e instanceof SyntaxError ? 'That is not valid JSON.' : e.message); } }}
                      className="mt-1 h-7 rounded-inner bg-brand px-3 text-xs font-medium text-ink-950">Save routes</button>
                  )}
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
    </>
  );
}
