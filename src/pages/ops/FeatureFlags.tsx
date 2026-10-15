import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { PageHeader, Badge, InlineError, EmptyState, Skeleton } from '../../components/ui';
import { ChartCard, th, td } from '../../components/dash';

/* Feature flags: on or off, limited to plans, rolled out to a share of people. The app reads
   them from GET /api/app/config within a minute; the same people stay in as the share grows. */

const PLANS = ['FREE', 'PLUS', 'PRO', 'STUDIO'];
const input = 'h-8 rounded-inner border border-ink-600 bg-ink-800 px-2 text-sm text-ink-100';

function FlagForm({ initial, onSave, onCancel }: { initial?: any; onSave: (key: string, f: any) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState<any>({ key: '', description: '', enabled: false, plans: [], rolloutPct: 100, ...initial });
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="grid grid-cols-1 gap-3 rounded-inner border border-ink-700 bg-ink-850 p-4 md:grid-cols-4" onSubmit={async (e) => { e.preventDefault(); setErr(null); try { await onSave(f.key, { description: f.description, enabled: f.enabled, plans: f.plans, rolloutPct: f.rolloutPct }); } catch (x: any) { setErr(x.message); } }}>
      <label className="text-xs text-ink-300">Key<input required disabled={!!initial} className={`${input} mt-1 w-full font-mono`} placeholder="new_closet" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value.toLowerCase() })} /></label>
      <label className="text-xs text-ink-300 md:col-span-3">What it does<input maxLength={200} className={`${input} mt-1 w-full`} value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <fieldset className="text-xs text-ink-300"><legend>Plans (none = all)</legend><span className="mt-2 flex flex-wrap gap-2">{PLANS.map((p) => <label key={p} className="inline-flex items-center gap-1"><input type="checkbox" checked={f.plans.includes(p)} onChange={(e) => setF({ ...f, plans: e.target.checked ? [...f.plans, p] : f.plans.filter((x: string) => x !== p) })} />{p}</label>)}</span></fieldset>
      <label className="text-xs text-ink-300 md:col-span-2">Rolled out to {f.rolloutPct}% of people<input type="range" min={0} max={100} step={5} className="mt-2 w-full accent-[rgb(var(--brand))]" value={f.rolloutPct} onChange={(e) => setF({ ...f, rolloutPct: Number(e.target.value) })} /></label>
      <label className="inline-flex items-center gap-2 text-xs text-ink-300"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> On</label>
      <div className="flex items-center gap-2 md:col-span-4"><button className="h-8 rounded-inner bg-brand px-3 text-xs font-medium text-ink-950">Save</button><button type="button" onClick={onCancel} className="h-8 px-2 text-xs text-ink-300">Cancel</button>{err && <span className="text-xs text-bad">{err}</span>}</div>
    </form>
  );
}

export default function FeatureFlags() {
  const { data, error, reload } = useAdminApi<any>('flags');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const save = async (key: string, body: any) => { await adminSend('PUT', `flags/${encodeURIComponent(key)}`, body); setEditing(null); reload(); };
  return (
    <>
      <PageHeader title="Feature flags" subtitle="Turn features on for some plans or a share of people. The app picks changes up within a minute (GET /api/app/config); people already in a rollout stay in as it grows." />
      <ChartCard title="Flags" caption="Every change is logged." actions={data?.canEdit && editing !== 'new' ? <button onClick={() => setEditing('new')} className="inline-flex items-center gap-1 rounded-inner border border-ink-600 px-2 py-1 text-xs text-ink-100 hover:border-brand-line hover:text-brand"><Plus size={13} aria-hidden="true" /> New flag</button> : undefined}>
        {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-32 w-full" /> : (
          <>
            {editing === 'new' && <div className="mb-4"><FlagForm onSave={save} onCancel={() => setEditing(null)} /></div>}
            {!data.flags.length ? <EmptyState title="No flags yet" body="Create one, then check it in the app with useFlag('key')." /> : (
              <table className="w-full">
                <thead><tr><th className={th}>Flag</th><th className={th}>State</th><th className={th}>Plans</th><th className={th}>Rollout</th><th className={th}>Changed</th>{data.canEdit && <th className={th} />}</tr></thead>
                <tbody>
                  {data.flags.map((f: any) => editing === f.key ? (
                    <tr key={f.key}><td colSpan={6} className="py-2"><FlagForm initial={f} onSave={save} onCancel={() => setEditing(null)} /></td></tr>
                  ) : (
                    <tr key={f.key} className="border-t border-ink-700">
                      <td className={td}><span className="font-mono">{f.key}</span>{f.description && <span className="block text-xs text-ink-400">{f.description}</span>}</td>
                      <td className={td}><Badge tone={f.enabled ? 'ok' : 'neutral'}>{f.enabled ? 'on' : 'off'}</Badge></td>
                      <td className={`${td} text-ink-300`}>{f.plans.length ? f.plans.join(', ') : 'all'}</td>
                      <td className={td}>{f.rolloutPct}%</td>
                      <td className={`${td} text-xs text-ink-400`}>{new Date(f.updatedAt).toLocaleDateString('en-IN')} · {f.updatedBy || '–'}</td>
                      {data.canEdit && <td className={`${td} text-right`}>
                        <button onClick={() => save(f.key, { enabled: !f.enabled })} className="mr-2 text-xs text-ink-300 hover:text-brand">{f.enabled ? 'Turn off' : 'Turn on'}</button>
                        <button onClick={() => setEditing(f.key)} className="mr-2 text-xs text-ink-300 hover:text-brand">Edit</button>
                        <button onClick={async () => { if (confirm(`Delete ${f.key}? The app treats a missing flag as off.`)) { await adminSend('DELETE', `flags/${encodeURIComponent(f.key)}`); reload(); } }} className="text-ink-400 hover:text-bad" aria-label={`Delete ${f.key}`}><Trash2 size={14} /></button>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </ChartCard>
    </>
  );
}
