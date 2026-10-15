import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { PageHeader, Badge, InlineError, Skeleton, StatTileSkeleton } from '../../components/ui';
import { Kpi, ChartCard, ChartTip, Meter, Grid, axis, th, td, fmtN, fmtUsd, fmtMs, fmtPct, fmtDay, inputCls, btnCls, primaryBtnCls } from '../../components/dash';
import { CHART } from '../../chartColors';

/* The GPU and the plan limits. Watch what the controller is doing, spend against the monthly
   cap, whether paid single images keep the 30 s promise and when a warm GPU would pay for
   itself; then change limits and GPU rules without a deploy (ADMIN and SUPERADMIN; every
   change is logged with before and after). Counts and money only, nobody singled out. */

type PerPlan = Record<string, number | null>;
type Settings = {
  canEdit: boolean;
  plans: string[];
  limits: Record<string, { window: string; defaults: PerPlan; current: PerPlan }>;
  settings: Record<string, { defaults: PerPlan; current: PerPlan }>;
  gpu: Record<string, number>; qc: Record<string, number>; retry: Record<string, number>; group?: Record<string, number>;
  defaults: { gpu: Record<string, number>; qc: Record<string, number>; retry: Record<string, number>; group?: Record<string, number> };
};

const FEATURE_LABEL: Record<string, string> = {
  items: 'Wardrobe items', collections: 'Collections', scan: 'Smart Scan', scanDaily: 'Smart Scan (daily)',
  beautify: 'Beautify', beautifyPro: 'Beautify Pro', tryon: 'Virtual try-on', fitcheck: 'Fit check',
  kween: 'Kween messages', beautifyBulkDay: 'Bulk Beautify (daily)', beautifyBatch: 'Bulk batch size',
  plannerDays: 'Planner range (days)', historyDays: 'Outfit history (days)',
};
const GPU_LABEL: Record<string, string> = {
  maxGpus: 'Max GPUs (keep at or under Modal’s FLUNTR_MAX_CONTAINERS)', coldSec: 'Cold start (s)', secPerImage: 'Seconds per image (starting guess)',
  scaleDownSec: 'Release a GPU after it’s unneeded for (s)', freeMaxGpus: 'Free plan: max GPUs', freeBusySec: 'Free: suggest upgrading when the wait is over (s)',
  tapTargetSec: 'Paid single-image promise (s)', spendCapUsd: 'Monthly spend cap ($)', peakStartHour: 'Peak starts (IST hour)',
  peakEndHour: 'Peak ends (IST hour)', gpuUsdPerHour: 'GPU $ per hour (for estimates)', warmAdviceColdTaps: 'Suggest a warm GPU at this many cold paid taps per peak hour',
};
const QC_LABEL: Record<string, string> = {
  minSimilarity: 'Min similarity to the source photo (0–1)', maxBodyShare: 'Max skin / face share left (0–1)',
  minBorderWhite: 'Min white border (0–1)', maxPersonProb: 'Max “person or mannequin” score (0–1)',
};
const RETRY_LABEL: Record<string, string> = { maxFree: 'Free retries per studio shot' };
const GROUP_LABEL: Record<string, string> = {
  sameOutfit: 'Same outfit at similarity of at least (0–1)', unsureBand: 'Ask the person when within this of it',
};

const shown = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
const numCls = `${inputCls} w-20 text-right font-mono disabled:opacity-60`;

type Change = { key: string; from: string; to: string };

/** Save with a look at what changes first: these numbers move spend and what people can do. */
function SaveBar({ changes, canEdit, onSave, note, saved }: { changes: Change[]; canEdit: boolean; onSave: () => Promise<void>; note?: string; saved?: boolean }) {
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const reviewing = review && changes.length > 0;
  if (!canEdit) return <p className="mt-3 text-xs text-ink-400">View only. ADMIN or SUPERADMIN can change these.</p>;
  const save = async () => {
    setBusy(true); setMsg(null);
    try { await onSave(); setReview(false); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-2 border-t border-ink-700 pt-3">
      {reviewing && (
        <ul className="space-y-0.5 text-xs text-ink-300">
          {changes.map((c) => <li key={c.key}><span className="text-ink-100">{c.key}</span>: <span data-numeric>{c.from || '∞'}</span> → <span data-numeric className="text-brand">{c.to || '∞'}</span></li>)}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {msg ? <span role="status" className={`text-xs ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</span>
          : saved && !changes.length ? <span role="status" className="text-xs text-ok">Saved. Live on every server within a minute.</span>
          : note && <span className="text-xs text-ink-400">{note}</span>}
        {reviewing ? (
          <>
            <button className={btnCls} onClick={() => setReview(false)} disabled={busy}>Cancel</button>
            <button className={primaryBtnCls} onClick={save} disabled={busy}>{busy ? 'Saving…' : `Save ${changes.length} change${changes.length === 1 ? '' : 's'}`}</button>
          </>
        ) : (
          changes.length > 0 && <button className={primaryBtnCls} onClick={() => { setMsg(null); setReview(true); }}>Review {changes.length} change{changes.length === 1 ? '' : 's'}</button>
        )}
      </div>
    </div>
  );
}

/** One row per feature, one column per plan. Empty = unlimited. (Keyed on the saved values, so a reload starts a fresh draft.) */
function PlanTable({ section, rows, plans, canEdit, onSaved, saved }: {
  section: 'limits' | 'settings'; rows: Settings['limits'] | Settings['settings']; plans: string[]; canEdit: boolean; onSaved: () => void; saved?: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(Object.entries(rows).map(([k, r]) => [k, Object.fromEntries(plans.map((p) => [p, shown(r.current[p])]))])));
  const changes: Change[] = Object.entries(rows).flatMap(([k, r]) => plans
    .filter((p) => draft[k] && draft[k][p] !== shown(r.current[p]))
    .map((p) => ({ key: `${FEATURE_LABEL[k] ?? k} · ${p}`, from: shown(r.current[p]), to: draft[k][p] })));
  const save = async () => {
    const body = Object.fromEntries(Object.entries(draft).map(([k, per]) => [k, Object.fromEntries(Object.entries(per).map(([p, v]) => [p, v.trim() === '' ? null : Number(v)]))]));
    await adminSend('PUT', `ai-settings/${section}`, body);
    onSaved();
  };
  return (
    <>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr>
              <th className={th}>Feature</th>
              {section === 'limits' && <th className={th}>Per</th>}
              {plans.map((p) => <th key={p} className={`${th} text-right`}>{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.entries(rows).map(([k, r]) => (
              <tr key={k} className="border-t border-ink-700">
                <td className={td}>{FEATURE_LABEL[k] ?? k}</td>
                {section === 'limits' && <td className={`${td} text-ink-400`}>{(r as any).window}</td>}
                {plans.map((p) => {
                  const v = draft[k]?.[p] ?? '';
                  const custom = v !== shown(r.defaults[p]);
                  return (
                    <td key={p} className={`${td} text-right`}>
                      <span className="inline-flex items-center gap-1.5">
                        {custom && <span className="h-1.5 w-1.5 rounded-full bg-brand" title={`Code default: ${shown(r.defaults[p]) || '∞'}`} aria-hidden="true" />}
                        <input inputMode="numeric" aria-label={`${FEATURE_LABEL[k] ?? k}, ${p}`} placeholder="∞" disabled={!canEdit}
                          className={`${numCls} ${v !== shown(r.current[p]) ? 'border-brand' : ''}`} value={v} title={`Code default: ${shown(r.defaults[p]) || '∞'}`}
                          onChange={(e) => setDraft((d) => ({ ...d, [k]: { ...d[k], [p]: e.target.value.replace(/[^0-9]/g, '') } }))} />
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveBar changes={changes} canEdit={canEdit} onSave={save} saved={saved} note="Empty = unlimited. A dot marks a value that differs from the code default." />
    </>
  );
}

/** Flat number settings (gpu / qc / retry). */
function NumberForm({ section, values, defaults, labels, canEdit, onSaved, saved }: {
  section: 'gpu' | 'qc' | 'retry' | 'group'; values: Record<string, number>; defaults: Record<string, number>; labels: Record<string, string>; canEdit: boolean; onSaved: () => void; saved?: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])));
  const changes: Change[] = Object.entries(values).filter(([k, v]) => draft[k] !== undefined && draft[k] !== String(v)).map(([k, v]) => ({ key: labels[k] ?? k, from: String(v), to: draft[k] }));
  const save = async () => {
    await adminSend('PUT', `ai-settings/${section}`, Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)])));
    onSaved();
  };
  return (
    <>
      <div className="space-y-2">
        {Object.keys(values).map((k) => {
          const v = draft[k] ?? '';
          return (
            <label key={k} className="flex items-center justify-between gap-3">
              <span className="min-w-0 text-sm text-ink-200">
                {labels[k] ?? k}
                {String(defaults[k]) !== v && <span className="ml-1.5 text-label text-ink-400">default {defaults[k]}</span>}
              </span>
              <input inputMode="decimal" disabled={!canEdit} className={`${numCls} ${v !== String(values[k]) ? 'border-brand' : ''}`} value={v}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value.replace(/[^0-9.]/g, '') }))} />
            </label>
          );
        })}
      </div>
      <SaveBar changes={changes} canEdit={canEdit} onSave={save} saved={saved} />
    </>
  );
}

export default function GpuPlans() {
  const ops = useAdminApi<any>('ai-ops');
  const cfg = useAdminApi<Settings>('ai-settings');
  const o = ops.data;
  const c = o?.controller;
  const paidTap = o?.lanes?.find((l: any) => l.paid && !l.bulk);
  const freeTap = o?.lanes?.find((l: any) => !l.paid && !l.bulk);
  const targetMs = (o?.tapTargetSec ?? 30) * 1000;
  const spendShare = o ? o.spend.monthUsd / Math.max(1, o.spend.capUsd) : 0;
  const warmOn = o?.warmGpu && /^Turn on/.test(o.warmGpu.advice);
  const canEdit = !!cfg.data?.canEdit;
  // Which section was just saved: its form remounts with the new values, so the "Saved" note lives here
  const [saved, setSaved] = useState<string | null>(null);
  const done = (section: string, alsoOps = false) => () => { setSaved(section); cfg.reload(); if (alsoOps) ops.reload(); };

  return (
    <>
      <PageHeader
        title="GPU & plans"
        subtitle="What the GPU is doing, what it costs, and the limits each plan gets. Changes go live within a minute, no deploy, and are logged."
        actions={<button className={btnCls} onClick={() => { ops.reload(); cfg.reload(); }}><RefreshCw size={13} className={ops.loading ? 'animate-spin' : ''} aria-hidden="true" />Refresh</button>}
      />

      {ops.error ? <InlineError message={ops.error} onRetry={ops.reload} /> : (
        <Grid cols={4}>
          {!o ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
            <Kpi label="GPUs in use" value={`${(c?.paidRunning ?? 0) + (c?.freeRunning ?? 0)} / ${c?.slots ?? 1}`} hint={`${fmtN(c?.paidQueued)} paid and ${fmtN(c?.freeQueued)} free waiting · ${c?.perImageSec ?? '–'} s per image`} source="measured" />
            <Kpi label="Paid single image, p95" value={paidTap ? fmtMs(paidTap.p95TotalMs) : '–'} hint={paidTap ? (paidTap.p95TotalMs > targetMs ? `Over the ${o.tapTargetSec} s promise (last 24 h)` : `Within the ${o.tapTargetSec} s promise (last 24 h)`) : 'No paid taps in the last 24 h'} source="measured" />
            <Kpi label="Spend this month" value={fmtUsd(o.spend.monthUsd, 2)} source="estimated"
              hint={`${fmtPct(spendShare, 0)} of the ${fmtUsd(o.spend.capUsd, 0)} cap. Past it only paid single images run; at ${fmtUsd(o.spend.hardCapUsd, 0)} new GPU work waits.`}>
              <Meter pct={spendShare} label="Spend against the monthly cap" />
            </Kpi>
            <Kpi label="Free single image, p95" value={freeTap ? fmtMs(freeTap.p95TotalMs) : '–'} hint="Free shares a couple of GPUs at most" source="measured" />
          </>}
        </Grid>
      )}

      {o && (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard title="Warm GPU for peak hours" caption={`Paid single taps ${o.warmGpu.windowIst} IST over the last 7 days that landed on a sleeping GPU.`} source="estimated">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={warmOn ? 'warn' : 'ok'}>{warmOn ? 'Recommended' : 'Not needed yet'}</Badge>
                <span className="text-sm text-ink-200">{o.warmGpu.advice}</span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-label uppercase text-ink-400">Cold paid taps / peak h</dt><dd data-numeric className="text-ink-50">{o.warmGpu.coldPerPeakHour} <span className="text-ink-400">/ {o.warmGpu.threshold}</span></dd></div>
                <div><dt className="text-label uppercase text-ink-400">Peak p95</dt><dd data-numeric className={o.warmGpu.p95PeakMs > o.warmGpu.targetMs ? 'text-bad' : 'text-ink-50'}>{o.warmGpu.p95PeakMs ? fmtMs(o.warmGpu.p95PeakMs) : '–'}</dd></div>
                <div><dt className="text-label uppercase text-ink-400">Warm GPU</dt><dd data-numeric className="text-ink-50">{fmtUsd(o.warmGpu.warmMonthlyUsd, 0)}/mo</dd></div>
                <div><dt className="text-label uppercase text-ink-400">Cold starts now</dt><dd data-numeric className="text-ink-50">{fmtUsd(o.warmGpu.coldStartsMonthlyUsd, 2)}/mo</dd></div>
              </dl>
              {o.warmGpu.days.length > 0 && (
                <ResponsiveContainer width="100%" height={140}>
                  <ComposedChart data={o.warmGpu.days} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" {...axis} tickFormatter={fmtDay} />
                    <YAxis {...axis} width={32} allowDecimals={false} />
                    <Tooltip content={<ChartTip labelFormat={fmtDay} />} cursor={{ fill: 'rgb(var(--ink-700) / 0.4)' }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: CHART.text }} />
                    <Bar dataKey="taps" name="Paid taps" fill={CHART.brand} maxBarSize={18} />
                    <Bar dataKey="cold" name="On a sleeping GPU" fill="rgb(var(--c3))" maxBarSize={18} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              <p className="text-xs text-ink-400">To turn it on, keep one GPU running in the peak window on Modal (min containers 1). Do it when this card says so.</p>
            </div>
          </ChartCard>

          <ChartCard title="Last 24 hours by lane" caption="Finished studio shots and try-ons: wait plus run time, cold starts and estimated GPU cost." source="estimated">
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[440px]">
                <thead><tr>
                  <th className={th}>Lane</th><th className={`${th} text-right`}>Images</th><th className={`${th} text-right`}>Cold</th>
                  <th className={`${th} text-right`}>p50</th><th className={`${th} text-right`}>p95</th><th className={`${th} text-right`}>Cost</th>
                </tr></thead>
                <tbody>
                  {!o.lanes.length && <tr className="border-t border-ink-700"><td colSpan={6} className={`${td} py-6 text-center text-ink-400`}>No studio shots in the last 24 hours.</td></tr>}
                  {o.lanes.map((l: any) => (
                    <tr key={`${l.paid}-${l.bulk}`} className="border-t border-ink-700">
                      <td className={td}>{l.paid ? 'Paid' : 'Free'} · {l.bulk ? 'bulk' : 'single'}</td>
                      <td data-numeric className={`${td} text-right`}>{fmtN(l.jobs)}</td>
                      <td data-numeric className={`${td} text-right`}>{fmtN(l.cold)}</td>
                      <td data-numeric className={`${td} text-right`}>{fmtMs(l.p50TotalMs)}</td>
                      <td data-numeric className={`${td} text-right ${l.paid && !l.bulk && l.p95TotalMs > targetMs ? 'text-bad' : ''}`}>{fmtMs(l.p95TotalMs)}</td>
                      <td data-numeric className={`${td} text-right`}>{fmtUsd(l.usd ?? 0, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-ink-700 pt-3 text-sm">
              <div><dt className="text-label uppercase text-ink-400">Retries this month</dt><dd data-numeric className="text-ink-50">{fmtN(o.qc.retries)}</dd></div>
              <div><dt className="text-label uppercase text-ink-400">Failed quality check</dt><dd data-numeric className="text-ink-50">{fmtN(o.qc.bad)} <span className="text-ink-400">/ {fmtN(o.qc.checked)} checked</span></dd></div>
              <div><dt className="text-label uppercase text-ink-400">Open tickets</dt><dd data-numeric className="text-ink-50">{fmtN(o.qc.openTickets)}</dd></div>
            </dl>
          </ChartCard>

          <ChartCard className="xl:col-span-2" title="AI image cost by plan" caption="Studio shots and try-ons finished this month, by the plan of the person who asked." source="estimated">
            {!o.byPlan.length ? <p className="text-sm text-ink-400">Nothing this month yet.</p> : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {o.byPlan.map((p: any) => (
                  <div key={p.plan}>
                    <p className="text-label uppercase text-ink-400">{p.plan}</p>
                    <p data-numeric className="text-lg font-semibold text-ink-50">{fmtUsd(p.usd ?? 0, 2)}</p>
                    <p className="text-xs text-ink-400">{fmtN(p.images)} images · {fmtN(p.users)} people · {p.users ? fmtUsd(p.usd / p.users, 3) : '–'} each</p>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      )}

      <h2 className="mb-2 mt-8 text-label uppercase text-ink-400">Limits and rules</h2>
      {cfg.error ? <InlineError message={cfg.error} onRetry={cfg.reload} /> : !cfg.data ? <Skeleton className="h-96 w-full" /> : (
        <div className="space-y-4">
          <ChartCard title="Plan limits" caption="What each plan can do per month, per day or in total.">
            <PlanTable key={JSON.stringify(cfg.data.limits)} section="limits" rows={cfg.data.limits} plans={cfg.data.plans} canEdit={canEdit} onSaved={done('limits')} saved={saved === 'limits'} />
          </ChartCard>
          <ChartCard title="Plan settings" caption="Bulk batch size, planner range and outfit history per plan.">
            <PlanTable key={JSON.stringify(cfg.data.settings)} section="settings" rows={cfg.data.settings} plans={cfg.data.plans} canEdit={canEdit} onSaved={done('settings')} saved={saved === 'settings'} />
          </ChartCard>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="GPU controller" caption="Paid adds a GPU only when waiting would take longer than a cold start; free is capped.">
              <NumberForm key={JSON.stringify(cfg.data.gpu)} section="gpu" values={cfg.data.gpu} defaults={cfg.data.defaults.gpu} labels={GPU_LABEL} canEdit={canEdit} onSaved={done('gpu', true)} saved={saved === 'gpu'} />
            </ChartCard>
            <div className="flex flex-col gap-4">
              <ChartCard title="Quality check" caption="Runs only when someone taps Retry on a studio shot.">
                <NumberForm key={JSON.stringify(cfg.data.qc)} section="qc" values={cfg.data.qc} defaults={cfg.data.defaults.qc} labels={QC_LABEL} canEdit={canEdit} onSaved={done('qc')} saved={saved === 'qc'} />
              </ChartCard>
              <ChartCard title="Retries" caption="Free retries; after the last one the app offers a support ticket.">
                <NumberForm key={JSON.stringify(cfg.data.retry)} section="retry" values={cfg.data.retry} defaults={cfg.data.defaults.retry} labels={RETRY_LABEL} canEdit={canEdit} onSaved={done('retry')} saved={saved === 'retry'} />
              </ChartCard>
              {cfg.data.group && cfg.data.defaults.group && (
                <ChartCard title="Multi-photo scan" caption="When photos count as one outfit (one scan use). Near the line, the app asks the person to confirm.">
                  <NumberForm key={JSON.stringify(cfg.data.group)} section="group" values={cfg.data.group} defaults={cfg.data.defaults.group} labels={GROUP_LABEL} canEdit={canEdit} onSaved={done('group')} saved={saved === 'group'} />
                </ChartCard>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
