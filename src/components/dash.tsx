import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { Card, Badge } from './ui';
import { useMe } from '../lib/me';
import { useAdminApi } from '../lib/useAdminApi';
import { downloadCsv } from '../lib/api';
import { CHART } from '../chartColors';

/* ──────────────────────────────────────────────────────────────────────────
   What every dashboard page shares: the date range, compare and filter bar
   (kept in the URL, so a view can be shared), CSV export, KPI tiles with a
   delta and a sparkline, and chart cards that say what they show, where the
   numbers come from, and when they were computed.
   ────────────────────────────────────────────────────────────────────────── */

export type Range = 'today' | '7d' | '30d' | '90d' | 'custom';
export const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }, { id: '90d', label: '90 days' }, { id: 'custom', label: 'Custom' },
];
export const FILTER_KEYS = ['plan', 'platform', 'appVersion', 'cityTier', 'source'] as const;
const FILTER_LABELS: Record<string, string> = { plan: 'Plan', platform: 'Platform', appVersion: 'App version', cityTier: 'City tier', source: 'Source' };

/** Range, compare and filters from the URL, as API query params. */
export function useDashParams(defaults: { range?: Range } = {}) {
  const [sp, setSp] = useSearchParams();
  const range = (sp.get('range') as Range) || defaults.range || '30d';
  const query = useMemo(() => {
    const q: Record<string, string> = { range };
    if (range === 'custom') { q.from = sp.get('from') || ''; q.to = sp.get('to') || ''; }
    if (sp.get('compare') === '1') q.compare = '1';
    for (const k of FILTER_KEYS) { const v = sp.get(k); if (v) q[k] = v; }
    return q;
  }, [sp, range]);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === '') next.delete(k); else next.set(k, v); }
    setSp(next, { replace: true });
  };
  const ready = range !== 'custom' || (!!query.from && !!query.to);
  return { query, range, compare: query.compare === '1', set, ready };
}

const selectCls = 'h-8 rounded-inner border border-ink-600 bg-ink-800 px-2 text-xs text-ink-100 transition hover:border-brand-line focus:border-brand';

/** The bar above a dashboard: range, custom dates, compare, filters. */
export function DashControls({ filters = false, compare = true, note }: { filters?: boolean; compare?: boolean; note?: string }) {
  const { query, range, compare: on, set } = useDashParams();
  const { data: options } = useAdminApi<Record<string, string[]>>('meta/filters', { enabled: filters });
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Date range and filters">
      <Segmented value={range} options={RANGES} onChange={(v) => set({ range: v, ...(v !== 'custom' && { from: null, to: null }) })} label="Date range" />
      {range === 'custom' && (
        <span className="flex items-center gap-1.5 text-xs text-ink-300">
          <input type="date" aria-label="From" className={selectCls} value={query.from || ''} max={query.to || undefined} onChange={(e) => set({ from: e.target.value })} />
          <span aria-hidden="true">–</span>
          <input type="date" aria-label="To" className={selectCls} value={query.to || ''} min={query.from || undefined} onChange={(e) => set({ to: e.target.value })} />
        </span>
      )}
      {compare && (
        <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-xs text-ink-300">
          <input type="checkbox" className="accent-[rgb(var(--brand))]" checked={on} onChange={(e) => set({ compare: e.target.checked ? '1' : null })} />
          Compare with the previous period
        </label>
      )}
      {filters && (
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {FILTER_KEYS.map((k) => (
            <select key={k} aria-label={FILTER_LABELS[k]} className={selectCls} value={query[k] || ''} onChange={(e) => set({ [k]: e.target.value || null })}>
              <option value="">{FILTER_LABELS[k]}: all</option>
              {(options?.[k] || []).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          ))}
        </div>
      )}
      {note && <p className="basis-full text-xs text-ink-400">{note}</p>}
    </div>
  );
}

/** Small segmented control (one choice of a few). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-inner border border-ink-600 bg-ink-800 p-0.5">
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={`rounded-[6px] px-2.5 py-1 text-xs transition ${value === o.id ? 'bg-brand text-ink-950' : 'text-ink-300 hover:text-ink-100'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** CSV of one table in a response. Only for roles that can export; every export is logged. */
export function ExportButton({ path, params, table, label = 'CSV' }: { path: string; params: Record<string, any>; table: string; label?: string }) {
  const { can } = useMe();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!can('export')) return null;
  return (
    <span className="inline-flex items-center gap-2">
      {err && <span className="text-label text-bad">{err}</span>}
      <button
        onClick={async () => { setBusy(true); setErr(null); try { await downloadCsv(path, params, table); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }}
        className="inline-flex items-center gap-1 rounded-inner border border-ink-600 px-2 py-1 text-label font-medium text-ink-300 transition hover:border-brand-line hover:text-brand disabled:opacity-60"
        disabled={busy} title="Download as CSV (logged)"
      >
        {busy ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Download size={12} aria-hidden="true" />} {label}
      </button>
    </span>
  );
}

/* ── Numbers ─────────────────────────────────────────────────────────── */

const isNum = (n: any): n is number => typeof n === 'number' && Number.isFinite(n);
export const fmtN = (n: any, dp = 0) => (isNum(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: dp, minimumFractionDigits: 0 }) : '–');
/** 950 · 12.4K · 3.2L · 1.1Cr (thousands as K: the Indian locale's "T" reads like trillion) */
export const fmtCompact = (n: any) => {
  if (!isNum(n)) return '–';
  const a = Math.abs(n), one = (x: number) => (x >= 100 ? Math.round(x).toString() : x.toFixed(1).replace(/\.0$/, ''));
  if (a < 1000) return fmtN(n, 1);
  if (a < 1e5) return `${one(n / 1e3)}K`;
  if (a < 1e7) return `${one(n / 1e5)}L`;
  return `${one(n / 1e7)}Cr`;
};
export const fmtUsd = (n: any, dp?: number) => (isNum(n) ? `$${n.toLocaleString('en-US', { minimumFractionDigits: dp ?? (Math.abs(n) < 10 ? 2 : 0), maximumFractionDigits: dp ?? (Math.abs(n) < 1 ? 4 : Math.abs(n) < 10 ? 2 : 0) })}` : '–');
export const fmtInr = (n: any, dp?: number) => (isNum(n) ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: dp ?? (Math.abs(n) < 10 ? 2 : 0) })}` : '–');
export const fmtPct = (n: any, dp = 1) => (isNum(n) ? `${(n * 100).toFixed(dp)}%` : '–');
export const fmtMs = (n: any) => (isNum(n) ? (n >= 10_000 ? `${(n / 1000).toFixed(0)} s` : n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`) : '–');
export const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** "+12.3%" with a direction; good = which direction is good news (cost going down is good). */
export function deltaOf(now: number | null | undefined, before: number | null | undefined, good: 'up' | 'down' = 'up') {
  if (!isNum(now) || !isNum(before) || before === 0) return null;
  const d = (now - before) / Math.abs(before);
  const direction = Math.abs(d) < 0.005 ? 'flat' : d > 0 ? 'up' : 'down';
  const tone = direction === 'flat' ? 'flat' : direction === good ? 'good' : 'bad';
  return { text: `${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}%`, tone } as const;
}

/* ── Pieces ──────────────────────────────────────────────────────────── */

/** A tiny line for a KPI tile. */
export function Spark({ values, height = 28 }: { values: number[]; height?: number }) {
  if (!values?.length || values.every((v) => !v)) return <div style={{ height }} />;
  const w = 120, max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${height - 2 - ((v - min) / (max - min || 1)) * (height - 4)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={CHART.brand} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Headline number: value, change against the previous period, and a sparkline. */
export function Kpi({ label, value, delta, spark, hint, source }: {
  label: string; value: React.ReactNode; delta?: ReturnType<typeof deltaOf>; spark?: number[]; hint?: string; source?: Source;
}) {
  const tone = delta?.tone === 'good' ? 'text-ok' : delta?.tone === 'bad' ? 'text-bad' : 'text-ink-400';
  return (
    <Card className="flex flex-col p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-label uppercase text-ink-400">{label}</span>
        {source && <SourceBadge source={source} />}
      </div>
      <div className="flex items-baseline gap-2">
        <span data-numeric className="text-2xl font-semibold tracking-tight text-ink-50">{value}</span>
        {delta && <span className={`text-xs font-medium ${tone}`} title="Against the previous period">{delta.text}</span>}
      </div>
      {spark && <div className="mt-2"><Spark values={spark} /></div>}
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </Card>
  );
}

export type Source = 'measured' | 'estimated' | 'provider' | 'manual';
const SOURCE_TEXT: Record<Source, string> = {
  measured: 'Counted in our own ledger',
  estimated: 'Our usage × the price table',
  provider: 'Reported by the provider',
  manual: 'Entered from an invoice',
};
/** Where a figure comes from. Every money figure carries one. */
export function SourceBadge({ source }: { source: Source }) {
  return <span title={SOURCE_TEXT[source]}><Badge tone={source === 'provider' || source === 'manual' ? 'ok' : source === 'estimated' ? 'warn' : 'neutral'}>{source}</Badge></span>;
}

/** "as of 10:42" */
export function AsOf({ at }: { at?: string | null }) {
  if (!at) return <span className="text-label text-ink-400">not computed yet</span>;
  const d = new Date(at);
  const today = d.toDateString() === new Date().toDateString();
  return <span className="text-label text-ink-400" title={d.toLocaleString()}>as of {today ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>;
}

/** A chart (or table) with its one-line caption, source and "as of". */
export function ChartCard({ title, caption, asOf, source, actions, children, className = '' }: {
  title: string; caption: string; asOf?: string | null; source?: Source; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={`flex min-w-0 flex-col ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-700 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-ink-100">{title}</h2>
          <p className="mt-0.5 text-xs text-ink-400">{caption}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {source && <SourceBadge source={source} />}
          {asOf !== undefined && <AsOf at={asOf} />}
          {actions}
        </div>
      </div>
      <div className="min-w-0 flex-1 p-4">{children}</div>
    </Card>
  );
}

/** Usage against a limit, with marks at 50 / 80 / 100%. */
export function Meter({ pct, label }: { pct: number | null | undefined; label?: string }) {
  const p = isNum(pct) ? pct : 0;
  const tone = p >= 1 ? 'bg-bad' : p >= 0.8 ? 'bg-warn' : p >= 0.5 ? 'bg-brand-soft' : 'bg-brand';
  return (
    <div className="relative h-2 w-full rounded-full bg-ink-700" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} aria-label={label}>
      <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.min(100, p * 100)}%` }} />
      {[0.5, 0.8].map((m) => <span key={m} className="absolute top-[-2px] h-3 w-px bg-ink-400/60" style={{ left: `${m * 100}%` }} aria-hidden="true" />)}
    </div>
  );
}

/** Tooltip for recharts, in the console's style. */
export function ChartTip({ active, payload, label, format = fmtN, labelFormat }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-inner border border-ink-600 bg-ink-850 px-3 py-2 shadow-lift">
      {label != null && <p className="mb-1 text-xs font-medium text-ink-100">{labelFormat ? labelFormat(label) : label}</p>}
      {payload.filter((p: any) => p.value != null).map((p: any) => (
        <p key={p.dataKey ?? p.name} data-numeric className="flex items-center gap-2 text-xs text-ink-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill || p.stroke }} aria-hidden="true" />
          {p.name}: <span className="text-ink-100">{format(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** Shared axis props so charts look the same everywhere. */
export const axis = { stroke: CHART.axis, tick: { fill: CHART.axis, fontSize: 11 }, tickLine: false, axisLine: false } as const;

/** Simple table styles. */
export const th = 'whitespace-nowrap px-3 py-2 text-left text-label font-medium uppercase text-ink-400';
export const td = 'whitespace-nowrap px-3 py-2 text-sm text-ink-100';

/** A debounced copy of a value (what-if inputs). */
export function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Page grid helpers */
export function Grid({ cols = 4, children }: { cols?: 2 | 3 | 4 | 5; children: React.ReactNode }) {
  const c = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }[cols];
  return <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${c}`}>{children}</div>;
}

/** Scroll to #anchor once the section has rendered (links from the "where we're lacking" list). */
export function useHashScroll(ready: boolean) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [ready, hash]);
}

/** In place of a number that can't exist yet (no payments, too little history). */
export function NoData({ text = 'no data yet' }: { text?: string }) {
  return <span className="text-base font-normal text-ink-400">{text}</span>;
}

/** This month as YYYY-MM, and a month shifted by n. */
export const thisMonth = () => new Date().toISOString().slice(0, 7);
export const shiftMonth = (m: string, n: number) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
export const fmtMonth = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

/** ‹ October 2026 › */
export function MonthPicker({ value, onChange, max = thisMonth() }: { value: string; onChange: (m: string) => void; max?: string }) {
  const btn = 'rounded-inner border border-ink-600 px-2 py-1 text-xs text-ink-300 transition hover:border-brand-line hover:text-brand disabled:opacity-40';
  return (
    <span className="inline-flex items-center gap-1.5">
      <button className={btn} onClick={() => onChange(shiftMonth(value, -1))} aria-label="Previous month">‹</button>
      <span className="min-w-[8.5rem] text-center text-xs font-medium text-ink-100">{fmtMonth(value)}</span>
      <button className={btn} onClick={() => onChange(shiftMonth(value, 1))} disabled={value >= max} aria-label="Next month">›</button>
    </span>
  );
}

export const inputCls = 'h-8 rounded-inner border border-ink-600 bg-ink-800 px-2 text-xs text-ink-100 transition hover:border-brand-line focus:border-brand';
export const btnCls = 'inline-flex items-center gap-1.5 rounded-inner border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-100 transition hover:border-brand-line hover:text-brand disabled:opacity-50';
export const primaryBtnCls = 'h-8 rounded-inner bg-brand px-3 text-xs font-medium text-ink-950 transition hover:opacity-90 disabled:opacity-50';

/** A share of a whole (no thresholds, unlike Meter): plan mix, sources, counts. */
export function ShareBar({ pct, colour = CHART.brand, label }: { pct: number | null | undefined; colour?: string; label?: string }) {
  const p = isNum(pct) ? Math.max(0, Math.min(1, pct)) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-ink-700" role="img" aria-label={label ? `${label}: ${Math.round(p * 100)}%` : undefined}>
      <div className="h-2 rounded-full" style={{ width: `${p * 100}%`, background: colour }} />
    </div>
  );
}

export type FunnelStep = { key: string; label: string; people: number; fromPrevious: number | null; medianHours?: number | null };
const fmtHours = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(h < 10 ? 1 : 0)} h` : `${(h / 24).toFixed(1)} d`);

/**
 * Steps as bars against the first, with the share that went on from the step before (and the median
 * wait, when known). mode "start": steps are milestones that needn't happen in order, so each is shown
 * as a share of the first step instead.
 */
export function FunnelBars({ steps, warnBelow = 0.2, mode = 'previous' }: { steps: FunnelStep[]; warnBelow?: number; mode?: 'previous' | 'start' }) {
  const first = steps[0]?.people || 0;
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => {
        const pct = first ? s.people / first : 0;
        return (
          <li key={s.key + i} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(9rem,14rem)_1fr_auto]">
            <span className="text-sm text-ink-100">{s.label}</span>
            <div className="col-span-2 row-start-2 h-6 w-full rounded-inner bg-ink-800 sm:col-span-1 sm:row-start-auto">
              <div className="h-6 rounded-inner" style={{ width: `${Math.max(1, Math.min(100, pct * 100))}%`, background: CHART.brand, opacity: Math.max(0.35, 1 - i * 0.09) }} />
            </div>
            <span data-numeric className="col-start-2 row-start-1 text-right text-xs text-ink-300 sm:col-start-auto sm:row-start-auto sm:w-52">
              <span className="mr-2 text-ink-100">{fmtN(s.people)}</span>
              {i === 0 ? 'start' : mode === 'start' ? <><span className="text-ink-100">{fmtPct(pct, 0)}</span> of {steps[0].label.toLowerCase()}</>
                : s.fromPrevious != null ? <><span className={s.fromPrevious < warnBelow ? 'text-warn' : 'text-ink-100'}>{fmtPct(s.fromPrevious, 0)}</span> of previous</> : '–'}
              {s.medianHours != null && <span className="ml-1 text-ink-400">· {fmtHours(s.medianHours)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
