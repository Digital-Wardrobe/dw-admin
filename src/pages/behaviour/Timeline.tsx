import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import { getAdminToken } from '../../lib/useAdminApi';
import { FEATURE_NAMES, humanise } from '../../lib/names';
import { PageHeader, Card, Badge, InlineError, EmptyState, Skeleton } from '../../components/ui';
import { Segmented, Kpi, ChartCard, fmtN, fmtDay, Grid, inputCls, primaryBtnCls, btnCls } from '../../components/dash';

/* One person's activity, for people who agreed to personalisation only: days, sessions, features
   and events as codes and counts. Pseudonymous ID, no photos, no text, no item or post ids.
   Every view is written to the audit log before it is shown. */

type Range = '7d' | '30d' | '90d';
const get = async (path: string, params: Record<string, string> = {}) => {
  try {
    const r = await axios.get(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${getAdminToken()}` }, params });
    return r.data;
  } catch (e: any) { throw new Error(e?.response?.data?.message || e.message); }
};
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export default function Timeline() {
  const [sp, setSp] = useSearchParams();
  const ref = sp.get('ref') || '';
  const [pid, setPid] = useState(sp.get('pid') || '');
  const [range, setRange] = useState<Range>('30d');
  const [data, setData] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ref) { setData(null); return; }
    let live = true;
    setBusy(true); setErr(null);
    get(`behaviour/timeline/${encodeURIComponent(ref)}`, { range })
      .then((d) => { if (!live) return; setData(d); setEvents(d.events); setNext(d.next); })
      .catch((e) => live && setErr(e.message))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [ref, range]);

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { const r = await get('behaviour/people', { pid: pid.trim() }); setSp({ ref: r.ref, pid: r.pid }); } catch (x: any) { setErr(x.message); setBusy(false); }
  };
  const more = async () => {
    if (!next) return;
    setBusy(true);
    try { const d = await get(`behaviour/timeline/${encodeURIComponent(ref)}`, { range, before: next }); setEvents([...events, ...d.events]); setNext(d.next); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  const byDay = events.reduce((acc: Record<string, any[]>, ev) => { const k = new Date(ev.at).toDateString(); (acc[k] ||= []).push(ev); return acc; }, {});
  const maxMin = Math.max(1, ...(data?.days || []).map((d: any) => d.minutes));
  const p = data?.person;

  return (
    <>
      <PageHeader title="Timeline" subtitle="One person’s activity, for people who agreed to personalisation. Pseudonymous; every view is logged." />
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <ShieldCheck size={16} className="shrink-0 text-brand" aria-hidden="true" />
        <form onSubmit={find} className="flex flex-wrap items-center gap-2">
          <input aria-label="Pseudonymous ID" placeholder="u_ab12cd34ef" className={`${inputCls} w-44 font-mono`} value={pid} onChange={(e) => setPid(e.target.value)} />
          <button className={primaryBtnCls} disabled={busy || !pid.trim()}>Open</button>
        </form>
        <p className="text-xs text-ink-400">Paste an ID from a cluster’s people list. Anyone who hasn’t agreed to personalisation, or has deleted their account, can’t be opened.</p>
      </Card>

      {err ? <InlineError message={err} /> : !ref ? (
        <EmptyState title="No one selected" body="Open a cluster on the Segments page and pick someone, or paste a pseudonymous ID above." />
      ) : !data ? <Skeleton className="h-96 w-full" /> : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-ink-50">{p.pid}</span>
              <Badge tone="brand">{p.plan}</Badge>
              <span className="text-xs text-ink-400">signed up {fmtDay(p.signupDay)} · {p.platform || 'unknown platform'} {p.appVersion || ''} · consented {p.consentSince ? fmtDay(new Date(p.consentSince).toISOString().slice(0, 10)) : 'at sign-up'}</span>
              {p.cluster && <Badge tone="neutral">cluster: {p.cluster.label || `#${p.cluster.idx + 1}`}</Badge>}
            </div>
            <Segmented value={range} onChange={setRange} label="Range" options={[{ id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }, { id: '90d', label: '90 days' }]} />
          </div>
          <Grid cols={4}>
            <Kpi label="Active days" value={fmtN(data.summary.activeDays)} hint={`in the last ${range.replace('d', ' days')}`} />
            <Kpi label="Sessions" value={fmtN(data.summary.sessions)} />
            <Kpi label="Time in app" value={`${fmtN(data.summary.minutes)} min`} />
            <Kpi label="Features used" value={fmtN(data.summary.features.length)} hint={data.summary.features.map((f: string) => FEATURE_NAMES[f] || f).join(', ') || 'none'} />
          </Grid>

          <div className="mt-4">
            <ChartCard title="Days" caption="Minutes in the app on each active day, and the features used that day.">
              {!data.days.length ? <p className="text-sm text-ink-400">No activity in this range.</p> : (
                <ul className="space-y-1.5">
                  {[...data.days].reverse().map((d: any) => (
                    <li key={d.date} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 text-xs sm:grid-cols-[6.5rem_10rem_1fr]">
                      <span className="text-ink-300">{fmtDay(d.date)}</span>
                      <span className="flex items-center gap-2">
                        <span className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(4, (d.minutes / maxMin) * 100)}%` }} aria-hidden="true" />
                        <span data-numeric className="shrink-0 text-ink-400">{d.minutes} min · {d.sessions}×</span>
                      </span>
                      <span className="col-span-2 flex flex-wrap gap-1 sm:col-span-1">{d.features.map((f: string) => <span key={f} className="rounded-[4px] bg-ink-800 px-1.5 py-0.5 text-label text-ink-300">{FEATURE_NAMES[f] || f}</span>)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          </div>

          <div className="mt-4">
            <ChartCard title="Events" caption="Newest first. Event names and their codes only (screens, features, outcomes); never ids, text or links.">
              {!events.length ? <p className="text-sm text-ink-400">No events in this range.</p> : (
                <>
                  <div className="space-y-4">
                    {Object.entries(byDay).map(([day, list]) => (
                      <div key={day}>
                        <p className="mb-1 text-label uppercase text-ink-400">{dayOf((list as any[])[0].at)}</p>
                        <ul className="divide-y divide-ink-700/60">
                          {(list as any[]).map((ev, i) => (
                            <li key={ev.at + i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 text-sm">
                              <span data-numeric className="w-16 shrink-0 whitespace-nowrap text-xs text-ink-400">{time(ev.at)}</span>
                              <span className="text-ink-100">{humanise(ev.type)}</span>
                              <span className="flex flex-wrap gap-1">
                                {Object.entries(ev.props || {}).filter(([k]) => !['v', 'pf'].includes(k)).map(([k, v]) => <span key={k} className="rounded-[4px] bg-ink-800 px-1.5 py-0.5 font-mono text-label text-ink-300">{k}: {String(v)}</span>)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {next && <button className={`${btnCls} mt-3`} disabled={busy} onClick={more}>{busy ? 'Loading…' : 'Older events'}</button>}
                </>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}
