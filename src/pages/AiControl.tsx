import { useEffect, useState } from 'react';
import axios from 'axios';
import { Cpu, Gauge, Wallet, Flame, RefreshCw, Save } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAdminApi, getAdminToken } from '../lib/useAdminApi';
import { PageHeader, Card, CardHeader, StatTile, StatTileSkeleton, InlineError, Badge, fmt } from '../components/ui';

/* ──────────────────────────────────────────────────────────────────────────
   AI & limits. Two jobs:
   1. Watch the GPU: what the controller is doing, spend against the cap,
      whether paid users get their 30 s promise, and when a warm GPU starts
      paying for itself.
   2. Change limits and GPU rules without a deploy. Every value saved here
      overrides the code default; an empty limit means unlimited.
   ────────────────────────────────────────────────────────────────────────── */

type PerPlan = Record<string, number | null>;
type Settings = {
  plans: string[];
  limits: Record<string, { window: string; defaults: PerPlan; current: PerPlan }>;
  settings: Record<string, { defaults: PerPlan; current: PerPlan }>;
  gpu: Record<string, number>; qc: Record<string, number>; retry: Record<string, number>; group?: Record<string, number>;
  defaults: { gpu: Record<string, number>; qc: Record<string, number>; retry: Record<string, number>; group?: Record<string, number> };
};

const FEATURE_LABEL: Record<string, string> = {
  items: 'Wardrobe items', collections: 'Collections', scan: 'Smart Scan', scanDaily: 'Smart Scan',
  beautify: 'Beautify', beautifyPro: 'Beautify Pro', tryon: 'Virtual try-on', fitcheck: 'Fit check',
  kween: 'Kween messages', beautifyBulkDay: 'Bulk Beautify', beautifyBatch: 'Bulk batch size',
  plannerDays: 'Planner range (days)', historyDays: 'Outfit history (days)',
};
const GPU_LABEL: Record<string, string> = {
  maxGpus: 'Max GPUs (keep ≤ Modal FLUNTR_MAX_CONTAINERS)', coldSec: 'Cold start (s)', secPerImage: 'Seconds per image (starting guess)',
  scaleDownSec: 'Release a GPU after unneeded for (s)', freeMaxGpus: 'Free plan: max GPUs', freeBusySec: 'Free: suggest upgrade when wait over (s)',
  tapTargetSec: 'Paid single-image promise (s)', spendCapUsd: 'Monthly spend cap ($)', peakStartHour: 'Peak starts (IST hour)',
  peakEndHour: 'Peak ends (IST hour)', gpuUsdPerHour: 'GPU $/hour (for estimates)', warmAdviceColdTaps: 'Suggest warm GPU at cold paid taps / peak hour',
};
const QC_LABEL: Record<string, string> = {
  minSimilarity: 'Min similarity to source (0–1)', maxBodyShare: 'Max skin / face share (0–1)',
  minBorderWhite: 'Min white border (0–1)', maxPersonProb: 'Max "person / mannequin" score (0–1)', maxFree: 'Free retries per shot',
};

const GROUP_LABEL: Record<string, string> = {
  sameOutfit: 'Same outfit at similarity ≥ (0–1)', unsureBand: 'Ask the user when within ± of it',
};

const authed = () => ({ headers: { Authorization: `Bearer ${getAdminToken()}` } });
const secs = (ms?: number | null) => (typeof ms === 'number' ? `${(ms / 1000).toFixed(1)} s` : '–');
const inputCls = 'w-full rounded-inner border border-ink-700 bg-ink-850 px-2 py-1.5 text-right font-mono text-sm text-ink-50 focus:border-brand-line focus:outline-none';

function SaveBar({ dirty, saving, onSave, note }: { dirty: boolean; saving: boolean; onSave: () => void; note?: string | null }) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-ink-700 px-5 py-3">
      {note && <span className="text-xs text-ink-400">{note}</span>}
      <button disabled={!dirty || saving} onClick={onSave}
        className="inline-flex items-center gap-1.5 rounded-inner border border-brand-line bg-brand-wash px-3 py-1.5 text-xs font-medium text-brand transition hover:bg-brand/10 disabled:opacity-40">
        <Save size={13} aria-hidden="true" /> {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

/** Limits table: one row per feature, one column per plan. Empty = unlimited. */
function PlanTable({ section, rows, plans, onSaved }: {
  section: 'limits' | 'settings'; rows: Settings['limits'] | Settings['settings']; plans: string[]; onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setDraft(Object.fromEntries(Object.entries(rows).map(([k, r]) => [k, Object.fromEntries(plans.map(p => [p, r.current[p] === null ? '' : String(r.current[p])]))])));
  }, [rows, plans]);
  const dirty = Object.entries(rows).some(([k, r]) => plans.some(p => (draft[k]?.[p] ?? '') !== (r.current[p] === null ? '' : String(r.current[p]))));
  const save = async () => {
    setSaving(true); setNote(null);
    try {
      const body = Object.fromEntries(Object.entries(draft).map(([k, per]) => [k, Object.fromEntries(Object.entries(per).map(([p, v]) => [p, v.trim() === '' ? null : Number(v)]))]));
      await axios.put(`${API_BASE_URL}ai-settings/${section}`, body, authed());
      setNote('Saved. Live on every server within a minute.'); onSaved();
    } catch (e: any) { setNote(e?.response?.data?.message || 'Could not save.'); } finally { setSaving(false); }
  };
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-label uppercase text-ink-400">
              <th className="px-5 py-3 font-medium">Feature</th>
              {section === 'limits' && <th className="px-3 py-3 font-medium">Per</th>}
              {plans.map(p => <th key={p} className="px-3 py-3 text-right font-medium">{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.entries(rows).map(([k, r]) => (
              <tr key={k} className="border-b border-ink-700/60 last:border-0">
                <td className="px-5 py-2 text-ink-100">{FEATURE_LABEL[k] ?? k}</td>
                {section === 'limits' && <td className="px-3 py-2 text-ink-400">{(r as any).window}</td>}
                {plans.map(p => (
                  <td key={p} className="px-3 py-2">
                    <input inputMode="numeric" aria-label={`${FEATURE_LABEL[k] ?? k} ${p}`} placeholder="∞" className={inputCls}
                      value={draft[k]?.[p] ?? ''} title={`Code default: ${r.defaults[p] ?? '∞'}`}
                      onChange={e => setDraft(d => ({ ...d, [k]: { ...d[k], [p]: e.target.value.replace(/[^0-9]/g, '') } }))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} note={note ?? 'Empty = unlimited. Hover a field to see the code default.'} />
    </>
  );
}

/** Flat number settings (gpu / qc / retry). */
function NumberForm({ section, values, defaults, labels, onSaved }: {
  section: 'gpu' | 'qc' | 'retry' | 'group'; values: Record<string, number>; defaults: Record<string, number>; labels: Record<string, string>; onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { setDraft(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)]))); }, [values]);
  const dirty = Object.entries(values).some(([k, v]) => draft[k] !== String(v));
  const save = async () => {
    setSaving(true); setNote(null);
    try {
      await axios.put(`${API_BASE_URL}ai-settings/${section}`, Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)])), authed());
      setNote('Saved.'); onSaved();
    } catch (e: any) { setNote(e?.response?.data?.message || 'Could not save.'); } finally { setSaving(false); }
  };
  return (
    <>
      <div className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
        {Object.keys(values).map(k => (
          <label key={k} className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-sm text-ink-200">{labels[k] ?? k}</span>
            <input inputMode="decimal" className={`${inputCls} max-w-[110px]`} value={draft[k] ?? ''} title={`Code default: ${defaults[k]}`}
              onChange={e => setDraft(d => ({ ...d, [k]: e.target.value.replace(/[^0-9.]/g, '') }))} />
          </label>
        ))}
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} note={note} />
    </>
  );
}

export default function AiControl() {
  const ops = useAdminApi<any>('ai-ops');
  const cfg = useAdminApi<Settings>('ai-settings');
  const o = ops.data;
  const c = o?.controller;
  const paidTap = o?.lanes?.find((l: any) => l.paid && !l.bulk);
  const freeTap = o?.lanes?.find((l: any) => !l.paid && !l.bulk);
  const targetMs = (o?.tapTargetSec ?? 30) * 1000;
  const spendPct = o ? Math.round((o.spend.monthUsd / Math.max(1, o.spend.capUsd)) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="AI & limits"
        subtitle="What the GPU is doing, what it costs, and the limits each plan gets. Changes here go live without a deploy."
        actions={
          <button onClick={() => { ops.reload(); cfg.reload(); }}
            className="inline-flex items-center gap-1.5 rounded-inner border border-ink-700 px-3 py-2 text-xs text-ink-200 hover:border-brand-line">
            <RefreshCw size={14} className={ops.loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
          </button>
        }
      />

      {ops.error ? <InlineError message={ops.error} onRetry={ops.reload} /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {!o ? [0, 1, 2, 3].map(i => <StatTileSkeleton key={i} />) : (
            <>
              <StatTile label="GPUs in use" icon={<Cpu size={16} />} value={`${(c?.paidRunning ?? 0) + (c?.freeRunning ?? 0)} / ${c?.slots ?? 1}`}
                hint={`${fmt(c?.paidQueued)} paid and ${fmt(c?.freeQueued)} free waiting · ${c?.perImageSec ?? '–'} s per image`} />
              <StatTile label="Paid single image, p95" icon={<Gauge size={16} />} value={secs(paidTap?.p95TotalMs)}
                hint={paidTap ? (paidTap.p95TotalMs > targetMs ? `Over the ${o.tapTargetSec} s promise` : `Within the ${o.tapTargetSec} s promise`) : 'No paid taps in 24 h'} />
              <StatTile label="Spend this month" icon={<Wallet size={16} />} value={`$${o.spend.monthUsd.toFixed(2)}`}
                hint={`${spendPct}% of the $${o.spend.capUsd} cap · bulk pauses at the cap, everything at $${o.spend.hardCapUsd}`} />
              <StatTile label="Free single image, p95" icon={<Flame size={16} />} value={secs(freeTap?.p95TotalMs)} hint="Free shares at most a couple of GPUs" />
            </>
          )}
        </div>
      )}

      {o && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader title="Warm GPU for peak hours" hint={`${o.warmGpu.windowIst} IST · last 7 days`} />
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={/^Turn on/.test(o.warmGpu.advice) ? 'warn' : 'ok'}>{/^Turn on/.test(o.warmGpu.advice) ? 'Recommended' : 'Not needed yet'}</Badge>
                <span className="text-sm text-ink-200">{o.warmGpu.advice}</span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-label uppercase text-ink-400">Cold paid taps / peak h</dt><dd data-numeric className="text-ink-50">{o.warmGpu.coldPerPeakHour} <span className="text-ink-400">/ {o.warmGpu.threshold}</span></dd></div>
                <div><dt className="text-label uppercase text-ink-400">Peak p95</dt><dd data-numeric className="text-ink-50">{secs(o.warmGpu.p95PeakMs)}</dd></div>
                <div><dt className="text-label uppercase text-ink-400">Warm GPU</dt><dd data-numeric className="text-ink-50">${o.warmGpu.warmMonthlyUsd}/mo</dd></div>
                <div><dt className="text-label uppercase text-ink-400">Cold starts now</dt><dd data-numeric className="text-ink-50">${o.warmGpu.coldStartsMonthlyUsd}/mo</dd></div>
              </dl>
              <p className="text-xs text-ink-400">To turn it on: keep one GPU running in the peak window on Modal (min containers 1). Do it when this card says so.</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Last 24 hours by lane" hint="Done jobs" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead><tr className="border-b border-ink-700 text-left text-label uppercase text-ink-400">
                  <th className="px-5 py-2.5 font-medium">Lane</th><th className="px-3 py-2.5 text-right font-medium">Images</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cold</th><th className="px-3 py-2.5 text-right font-medium">p50</th>
                  <th className="px-3 py-2.5 text-right font-medium">p95</th><th className="px-5 py-2.5 text-right font-medium">Cost</th></tr></thead>
                <tbody>
                  {o.lanes.length === 0 && <tr><td colSpan={6} className="px-5 py-6 text-center text-ink-400">No studio shots in the last 24 hours.</td></tr>}
                  {o.lanes.map((l: any) => (
                    <tr key={`${l.paid}-${l.bulk}`} className="border-b border-ink-700/60 last:border-0">
                      <td className="px-5 py-2 text-ink-100">{l.paid ? 'Paid' : 'Free'} · {l.bulk ? 'bulk' : 'single'}</td>
                      <td data-numeric className="px-3 py-2 text-right">{fmt(l.jobs)}</td>
                      <td data-numeric className="px-3 py-2 text-right">{fmt(l.cold)}</td>
                      <td data-numeric className="px-3 py-2 text-right">{secs(l.p50TotalMs)}</td>
                      <td data-numeric className={`px-3 py-2 text-right ${l.paid && !l.bulk && l.p95TotalMs > targetMs ? 'text-bad' : ''}`}>{secs(l.p95TotalMs)}</td>
                      <td data-numeric className="px-5 py-2 text-right">${(l.usd ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-ink-700 px-5 py-3 text-sm">
              <div><span className="text-label uppercase text-ink-400">Retries (month)</span><p data-numeric className="text-ink-50">{fmt(o.qc.retries)}</p></div>
              <div><span className="text-label uppercase text-ink-400">Failed quality check</span><p data-numeric className="text-ink-50">{fmt(o.qc.bad)} / {fmt(o.qc.checked)}</p></div>
              <div><span className="text-label uppercase text-ink-400">Open tickets</span><p data-numeric className="text-ink-50">{fmt(o.qc.openTickets)}</p></div>
            </div>
          </Card>
          <Card className="xl:col-span-2">
            <CardHeader title="AI image cost by plan" hint="This month" />
            <div className="grid gap-3 p-5 sm:grid-cols-4">
              {(o.byPlan.length ? o.byPlan : [{ plan: '–', users: 0, images: 0, usd: 0 }]).map((p: any) => (
                <div key={p.plan}>
                  <p className="text-label uppercase text-ink-400">{p.plan}</p>
                  <p data-numeric className="text-ink-50">${(p.usd ?? 0).toFixed(2)}</p>
                  <p className="text-xs text-ink-400">{fmt(p.images)} images · {fmt(p.users)} users · ${p.users ? (p.usd / p.users).toFixed(3) : '0'}/user</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {cfg.error ? <InlineError message={cfg.error} onRetry={cfg.reload} /> : cfg.data && (
        <>
          <Card>
            <CardHeader title="Plan limits" hint="Per month, day or total" />
            <PlanTable section="limits" rows={cfg.data.limits} plans={cfg.data.plans} onSaved={cfg.reload} />
          </Card>
          <Card>
            <CardHeader title="Plan settings" hint="Batch size, planner and history" />
            <PlanTable section="settings" rows={cfg.data.settings} plans={cfg.data.plans} onSaved={cfg.reload} />
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="GPU controller" hint="Paid adds a GPU only when waiting beats a cold start" />
              <NumberForm section="gpu" values={cfg.data.gpu} defaults={cfg.data.defaults.gpu} labels={GPU_LABEL} onSaved={() => { cfg.reload(); ops.reload(); }} />
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader title="Quality check" hint="Runs only when a user taps Retry" />
                <NumberForm section="qc" values={cfg.data.qc} defaults={cfg.data.defaults.qc} labels={QC_LABEL} onSaved={cfg.reload} />
              </Card>
              <Card>
                <CardHeader title="Retries" hint="Free; after this, the user is sent to support" />
                <NumberForm section="retry" values={cfg.data.retry} defaults={cfg.data.defaults.retry} labels={QC_LABEL} onSaved={cfg.reload} />
              </Card>
              {cfg.data.group && cfg.data.defaults.group && (
                <Card>
                  <CardHeader title="Multi-photo scan" hint="When photos count as one outfit (one scan)" />
                  <NumberForm section="group" values={cfg.data.group} defaults={cfg.data.defaults.group} labels={GROUP_LABEL} onSaved={cfg.reload} />
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
