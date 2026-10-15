import { useEffect, useState } from 'react';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend, downloadFile } from '../../lib/api';
import { PageHeader, Card, Badge, InlineError, Skeleton, StatTileSkeleton } from '../../components/ui';
import { DashControls, useDashParams, Kpi, ChartCard, th, td, fmtN, fmtPct, fmtDay, Grid, inputCls, primaryBtnCls } from '../../components/dash';

/* What our own models can learn from, and the datasets built from it. Consented people only;
   behaviour signals, item metadata and FashionSigLIP embeddings; never photos, faces or text. */

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const mb = (b: number | null) => (b == null ? '–' : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const STATUS: Record<string, 'ok' | 'warn' | 'bad'> = { ready: 'ok', building: 'warn', failed: 'bad' };

export default function Training() {
  const { query, ready } = useDashParams();
  const { data: d, error, reload } = useAdminApi<any>('behaviour/training', { params: query, enabled: ready });
  const [form, setForm] = useState({ kind: 'all', from: daysAgo(89), to: daysAgo(0) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const building = d?.datasets.some((x: any) => x.status === 'building');
  // While something builds, check every few seconds
  useEffect(() => { if (!building) return; const t = setInterval(reload, 3000); return () => clearInterval(t); }, [building, reload]);

  const build = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try { await adminSend('POST', 'behaviour/datasets', form); setMsg({ ok: true, text: 'Building. It appears below when ready.' }); reload(); } catch (x: any) { setMsg({ ok: false, text: x.message }); } finally { setBusy(false); }
  };
  const act = async (fn: () => Promise<any>) => { setMsg(null); try { await fn(); reload(); } catch (x: any) { setMsg({ ok: false, text: x.message }); } };
  const s = d?.signals;

  return (
    <>
      <PageHeader title="Training data" subtitle="What our own models can learn from, and the datasets built from it." />
      <Card className="mb-6 flex items-start gap-3 border-brand-line p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium text-ink-100">Your photos never train AI.</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-300">{(d?.rules || ['Consented people only.']).map((r: string) => <li key={r}>{r}</li>)}</ul>
        </div>
      </Card>
      <DashControls compare={false} note="Signals in the selected range, from people who agreed to personalisation (checked now)." />
      {error ? <InlineError message={error} onRetry={reload} /> : (
        <>
          <Grid cols={5}>
            {!s ? Array.from({ length: 5 }, (_, i) => <StatTileSkeleton key={i} />) : <>
              <Kpi label="Consented people" value={fmtN(d.consented.people)} hint={`${fmtPct(d.consented.shareOfActive, 0)} of active people-days in the range`} />
              <Kpi label="Suggestion outcomes" value={fmtN(s.suggestions)} hint={`${fmtN((s.suggestionOutcomes.accepted || 0) + (s.suggestionOutcomes.worn || 0))} accepted or worn`} />
              <Kpi label="Tag corrections" value={fmtN(s.tagCorrections)} hint="people fixing what a model filled in" />
              <Kpi label="Wears logged" value={fmtN(s.wears)} hint={`${fmtN(s.tasteSignals)} taste signals`} />
              <Kpi label="Item vectors" value={fmtN(s.itemEmbeddings)} hint="FashionSigLIP embeddings of consented people’s items" />
            </>}
          </Grid>

          <div className="mt-4">
            <ChartCard title="Datasets" caption={d ? `Gzipped JSON lines in a private bucket. Each is deleted after ${d.ttlDays} days, or as soon as anyone in it deletes their account or withdraws consent. Building, downloading and deleting are logged.` : 'Loading…'}>
              {!d ? <Skeleton className="h-40 w-full" /> : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
                  <div className="overflow-x-auto xl:col-span-3">
                    {!d.datasets.length ? <p className="py-6 text-center text-sm text-ink-400">No datasets yet.</p> : (
                      <table className="w-full">
                        <thead><tr><th className={th}>Version</th><th className={th}>Contents</th><th className={th}>Covers</th><th className={`${th} text-right`}>Rows</th><th className={`${th} text-right`}>People</th><th className={`${th} text-right`}>Size</th><th className={th}>Status</th><th className={th}>Built by</th><th className={th} /></tr></thead>
                        <tbody>
                          {d.datasets.map((x: any) => (
                            <tr key={x.id} className="border-t border-ink-700 align-top">
                              <td className={td}>v{x.version}</td>
                              <td className={td}>{d.kinds[x.kind] || x.kind}</td>
                              <td className={`${td} text-xs text-ink-300`}>{x.filters?.from ? `${fmtDay(x.filters.from)} – ${fmtDay(x.filters.to)}` : '–'}</td>
                              <td className={`${td} text-right`} data-numeric>{x.status === 'ready' ? fmtN(x.rowCount) : '–'}</td>
                              <td className={`${td} text-right`} data-numeric>{x.filters?.people != null ? fmtN(x.filters.people) : '–'}</td>
                              <td className={`${td} text-right`} data-numeric>{mb(x.bytes)}</td>
                              <td className={td}><Badge tone={STATUS[x.status] || 'neutral'}>{x.status}</Badge>{x.error && <span className="mt-1 block max-w-[14rem] whitespace-normal text-label text-bad">{x.error}</span>}{x.status === 'ready' && <span className="mt-1 block text-label text-ink-400">deleted {fmtDay(new Date(x.expiresAt).toISOString().slice(0, 10))}</span>}</td>
                              <td className={`${td} text-xs text-ink-400`}>{x.createdBy || '–'}<span className="block">{new Date(x.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></td>
                              <td className={`${td} text-right`}>
                                {d.canBuild && (
                                  <span className="inline-flex items-center gap-2">
                                    {x.status === 'ready' && <button aria-label={`Download v${x.version}`} title="Download (logged)" className="text-ink-300 hover:text-brand" onClick={() => act(() => downloadFile(`behaviour/datasets/${x.id}/download`, `dataset-v${x.version}.jsonl.gz`))}><Download size={14} aria-hidden="true" /></button>}
                                    {x.status !== 'building' && <button aria-label={`Delete v${x.version}`} title="Delete (logged)" className="text-ink-400 hover:text-bad" onClick={() => act(() => adminSend('DELETE', `behaviour/datasets/${x.id}`))}><Trash2 size={14} aria-hidden="true" /></button>}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {d.canBuild ? (
                    <form className="space-y-2" onSubmit={build}>
                      <p className="text-xs font-medium text-ink-100">Build a dataset</p>
                      <select aria-label="Contents" className={`${inputCls} w-full`} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                        {Object.entries(d.kinds).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
                      </select>
                      <div className="flex items-center gap-1.5 text-xs text-ink-300">
                        <input type="date" aria-label="From" className={`${inputCls} min-w-0 flex-1`} value={form.from} max={form.to} onChange={(e) => setForm({ ...form, from: e.target.value })} />
                        <span aria-hidden="true">–</span>
                        <input type="date" aria-label="To" className={`${inputCls} min-w-0 flex-1`} value={form.to} min={form.from} max={daysAgo(0)} onChange={(e) => setForm({ ...form, to: e.target.value })} />
                      </div>
                      <button className={primaryBtnCls} disabled={busy || building}>{building ? 'Building…' : 'Build'}</button>
                      {msg && <p className={`text-xs ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}
                      <p className="text-label text-ink-400">Each person and item becomes a code that only means something inside this one file. Builds count towards the hourly export limit.</p>
                    </form>
                  ) : <p className="text-xs text-ink-400">A SUPERADMIN or ADMIN builds and downloads datasets.</p>}
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}
