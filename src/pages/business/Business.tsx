import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ArrowRight, Info, Trash2 } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { PageHeader, Card, Badge, InlineError, EmptyState, Skeleton, StatTileSkeleton } from '../../components/ui';
import {
  DashControls, useDashParams, useHashScroll, Kpi, ChartCard, ExportButton, ChartTip, AsOf, Meter, ShareBar, NoData, MonthPicker,
  axis, th, td, fmtN, fmtInr, fmtPct, fmtDay, fmtCompact, fmtMonth, thisMonth, deltaOf, Grid, inputCls, btnCls, primaryBtnCls,
} from '../../components/dash';
import { CHART, colourFor } from '../../chartColors';

/* Dashboard 3, Business: who signs up, who pays, what that is worth, how this month is going
   against its targets, and what is holding us back. Money is net rupees (after GST and store or
   gateway fees) and comes only from store and gateway payments; admin and promo grants are
   "comped". Until the first payment, money figures say "no data yet" instead of showing zero. */

const PLAN_KEYS = ['PLUS', 'PRO', 'STUDIO'];
const SEVERITY: Record<string, 'bad' | 'warn' | 'neutral'> = { high: 'bad', medium: 'warn', low: 'neutral' };
const INR_METRICS = new Set(['net_revenue_inr', 'mrr_inr']);
const fmtTarget = (metric: string, v: any) => (INR_METRICS.has(metric) ? fmtInr(v) : fmtN(v));

export default function Business() {
  const { query, compare, ready } = useDashParams();
  const k = useAdminApi<any>('business/kpis', { params: query, enabled: ready });
  const lack = useAdminApi<any>('business/lacking', { params: query, enabled: ready });
  useHashScroll(!!k.data);
  const d = k.data, u = d?.users, m = d?.money, live = !!d?.paymentsLive;
  const money = (v: any, f: (x: any) => string = fmtInr) => (live ? f(v) : <NoData />);
  const prevHint = (x: any, f: (v: any) => string = fmtN) => (compare && x?.prev != null ? `${f(x.prev)} the period before` : undefined);
  const chart = m ? m.series.mrr.map((r: any, i: number) => ({ date: r.date, mrr: r.value, payers: m.series.payers[i]?.value, net: m.series.net[i]?.value })) : [];
  const mixTotal = m ? m.planMix.reduce((a: number, p: any) => a + p.mrrInr, 0) : 0;

  return (
    <>
      <PageHeader title="Business" subtitle="Sign-ups, paying people, revenue and what a person is worth. Money is net of GST and store fees." actions={d && <AsOf at={d.asOf} />} />
      <DashControls note="Plan, platform and other filters don't apply here: revenue is counted per subscription." />
      {k.error ? <InlineError message={k.error} onRetry={k.reload} /> : (
        <>
          {d && !live && (
            <Card className="mb-4 flex items-start gap-3 p-4 text-sm">
              <Info size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
              <p className="text-ink-300"><span className="font-medium text-ink-100">No payments yet.</span> Revenue, paying people, churn and LTV fill in from the first store or gateway payment. Plans granted by the team or a promo count as comped, never as revenue.</p>
            </Card>
          )}

          <h2 className="mb-2 text-label uppercase text-ink-400">People</h2>
          <Grid cols={4}>
            {!u ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
              <Kpi label="New sign-ups" value={fmtN(u.new.now)} delta={deltaOf(u.new.now, u.new.prev)} spark={u.series.new.map((r: any) => r.value)} hint={prevHint(u.new) || 'in the selected range'} />
              <Kpi label="Activated" value={fmtN(u.activated.now)} delta={deltaOf(u.activated.now, u.activated.prev)} hint={u.activationRate != null ? `${fmtPct(u.activationRate, 0)} reach 10 items and a planned or worn outfit in week one` : 'reach 10 items and a planned or worn outfit in week one'} />
              <Kpi label="Monthly active" value={fmtN(u.mau)} spark={u.series.mau.map((r: any) => r.value)} hint={`about ${fmtN(u.dauAvg)} on an average day`} />
              <Kpi label="Stickiness" value={fmtPct(u.stickiness)} hint="average daily ÷ monthly active (20%+ is a habit)" />
            </>}
          </Grid>

          <h2 className="mb-2 mt-6 text-label uppercase text-ink-400">Money</h2>
          <Grid cols={4}>
            {!m ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
              <Kpi label="MRR" source="measured" value={money(m.mrrInr)} spark={live ? m.series.mrr.map((r: any) => r.value) : undefined} hint={live ? `ARR ${fmtInr(m.arrInr)} · monthly net from active subscriptions` : 'monthly recurring revenue, net'} />
              <Kpi label="Net revenue" source="measured" value={money(m.netRevenue.now)} delta={live ? deltaOf(m.netRevenue.now, m.netRevenue.prev) : null} spark={live ? m.series.net.map((r: any) => r.value) : undefined} hint={live ? `${fmtInr(m.grossRevenue.now)} gross before GST and fees` : 'payments in the range, net'} />
              <Kpi label="Paying people" value={live ? fmtN(m.payers) : <NoData />} hint={live ? `${fmtPct(m.conversion)} of monthly active · ${fmtN(m.comped)} comped` : `${fmtN(m.comped)} on a comped plan`} />
              <Kpi label="ARPU · ARPPU" value={live ? <>{fmtInr(m.arpuInr)} <span className="text-base font-normal text-ink-400">· {fmtInr(m.arppuInr)}</span></> : <NoData />} hint="monthly net per active person · per paying person" />
            </>}
          </Grid>
          <div className="mt-4">
            <Grid cols={4}>
              {!m ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
                <Kpi label="Monthly churn" value={live && m.monthlyChurn != null ? fmtPct(m.monthlyChurn) : <NoData text={live ? 'needs 30 days' : 'no data yet'} />} hint={live ? `paying people who stopped in the last 30 days · ${fmtN(m.churned.now)} in range` : 'share of payers who stop in 30 days'} />
                <Kpi label="Net revenue retention" value={live && m.nrr != null ? fmtPct(m.nrr, 0) : <NoData text={live ? 'needs 30 days' : 'no data yet'} />} hint={live && m.nrrCohort ? `what ${fmtN(m.nrrCohort)} payers from 30 days ago pay now vs then` : 'what last month’s payers pay now vs then'} />
                <Kpi label="LTV" value={m.ltvInr != null ? fmtInr(m.ltvInr) : <NoData text={live ? 'needs 3 months' : 'no data yet'} />} hint={m.ltvInr != null ? m.ltvNote : `ARPPU × expected months; ${fmtN(d.monthsOfPaymentData, 1)} of 3 months of payments so far`} />
                <Kpi label="LTV ÷ CAC" source="manual" value={m.cac.ltvToCac != null ? `${m.cac.ltvToCac.toFixed(1)}×` : <NoData text="not yet" />}
                  hint={m.cac.perPayerInr != null ? `CAC ${fmtInr(m.cac.perPayerInr)} per new payer in ${fmtMonth(m.cac.month)} (aim for 3×+)` : `Enter ${fmtMonth(m.cac.month)}’s acquisition spend under Monthly inputs`} />
              </>}
            </Grid>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard className="xl:col-span-2" title="MRR and paying people" caption="Monthly recurring revenue (net) and how many people pay, each day." source="measured" asOf={d?.asOf}
              actions={<ExportButton path="business/kpis" params={query} table="daily" />}>
              {!m ? <Skeleton className="h-64 w-full" /> : !live ? <EmptyState title="No payments yet" body="This fills in from the first store or gateway payment." /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" {...axis} tickFormatter={fmtDay} minTickGap={32} />
                    <YAxis yAxisId="l" {...axis} width={52} tickFormatter={(v) => `₹${fmtCompact(v)}`} />
                    <YAxis yAxisId="r" orientation="right" {...axis} width={40} />
                    <Tooltip content={<ChartTip labelFormat={fmtDay} format={(v: number) => fmtN(v)} />} />
                    <Area yAxisId="l" type="monotone" dataKey="mrr" name="MRR (₹)" stroke={CHART.brand} fill={CHART.brand} fillOpacity={0.15} strokeWidth={1.5} />
                    <Line yAxisId="r" type="monotone" dataKey="payers" name="Paying people" stroke="rgb(var(--c3))" dot={false} strokeWidth={1.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Plan mix" caption="Paying people and MRR by plan, on the last day of the range." source="measured"
              actions={<ExportButton path="business/kpis" params={query} table="plans" />}>
              {!m ? <Skeleton className="h-64 w-full" /> : !live ? <EmptyState title="No payments yet" body="Plan mix appears with the first payment." /> : (
                <ul className="space-y-4">
                  {m.planMix.map((p: any) => (
                    <li key={p.plan}>
                      <div className="mb-1 flex items-baseline justify-between text-sm">
                        <span className="flex items-center gap-2 text-ink-100"><span className="h-2 w-2 rounded-full" style={{ background: colourFor(p.plan, PLAN_KEYS) }} aria-hidden="true" />{p.plan}</span>
                        <span data-numeric className="text-ink-100">{fmtInr(p.mrrInr)} <span className="text-xs text-ink-400">· {fmtN(p.payers)} paying</span></span>
                      </div>
                      <ShareBar pct={mixTotal ? p.mrrInr / mixTotal : 0} colour={colourFor(p.plan, PLAN_KEYS)} label={`${p.plan} share of MRR`} />
                    </li>
                  ))}
                  <li className="border-t border-ink-700 pt-3 text-xs text-ink-400">{fmtN(m.comped)} more on a comped plan (team or promo grants), not counted as revenue.</li>
                </ul>
              )}
            </ChartCard>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard title="Where we’re lacking" caption="Checked against simple thresholds each time the page loads. Each item links to the numbers behind it." asOf={lack.data?.asOf}
              actions={<ExportButton path="business/lacking" params={query} table="items" />}>
              {lack.error ? <InlineError message={lack.error} onRetry={lack.reload} /> : !lack.data ? <Skeleton className="h-48 w-full" /> : !lack.data.items.length ? (
                <EmptyState title="Nothing stands out" body="Activation, retention, conversion, payments, churn, invites and margins are all within their thresholds." />
              ) : (
                <ul className="divide-y divide-ink-700">
                  {lack.data.items.map((it: any) => (
                    <li key={it.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <Badge tone={SEVERITY[it.severity]}>{it.severity}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-100">{it.title}</p>
                        <p className="mt-0.5 text-xs text-ink-400">{it.detail}</p>
                        <Link to={it.link} className="mt-1 inline-flex items-center gap-1 text-xs text-brand hover:underline">See the numbers <ArrowRight size={12} aria-hidden="true" /></Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
            <Targets />
          </div>
          <MonthlyInputs />
        </>
      )}
    </>
  );
}

/** This month against its targets, with a straight-line projection to month end. */
function Targets() {
  const [month, setMonth] = useState(thisMonth());
  const { data, error, reload } = useAdminApi<any>('business/targets', { params: { month } });
  const [edit, setEdit] = useState<{ metric: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (metric: string, value: string | null) => {
    setBusy(true); setErr(null);
    try { await adminSend('PUT', 'business/targets', { month, metric, value }); setEdit(null); reload(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div id="targets" className="scroll-mt-32 lg:scroll-mt-8 xl:col-span-2">
      <ChartCard title="Monthly targets" caption={data ? `${Math.round(data.elapsed * 100)}% of ${fmtMonth(month)} gone. Projected = so far ÷ share of the month gone (levels like MRR are as of today).` : 'Targets for the month and where we are headed.'}
        asOf={data?.asOf} actions={<MonthPicker value={month} onChange={(v) => { setMonth(v); setEdit(null); }} />}>
        {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-48 w-full" /> : (
          <>
            {err && <p className="mb-2 text-xs text-bad">{err}</p>}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className={th}>Metric</th><th className={`${th} text-right`}>Target</th><th className={`${th} text-right`}>So far</th><th className={`${th} text-right`}>Projected</th><th className={th}>Progress</th><th className={th} /></tr></thead>
                <tbody>
                  {data.targets.map((t: any) => (
                    <tr key={t.metric} className="border-t border-ink-700">
                      <td className={td}>{t.label}</td>
                      <td className={`${td} text-right`} data-numeric>
                        {edit?.metric === t.metric ? (
                          <form className="flex justify-end gap-1" onSubmit={(e) => { e.preventDefault(); save(t.metric, (edit?.value ?? '')); }}>
                            <input autoFocus type="number" min={0} step="any" aria-label={`${t.label} target`} className={`${inputCls} w-28 text-right`} value={(edit?.value ?? '')} onChange={(e) => setEdit({ metric: t.metric, value: e.target.value })} />
                            <button className={primaryBtnCls} disabled={busy || (edit?.value ?? '') === ''}>Save</button>
                          </form>
                        ) : t.target != null ? <>{fmtTarget(t.metric, t.target)}{t.isDefault && <span className="ml-1 text-label text-ink-400" title="The built-in goal; set a target to replace it">default</span>}</> : <span className="text-ink-400">–</span>}
                      </td>
                      <td className={`${td} text-right`} data-numeric>{fmtTarget(t.metric, t.actual)}</td>
                      <td className={`${td} text-right`} data-numeric>{fmtTarget(t.metric, t.projected)}</td>
                      <td className={td}>{t.target != null ? <span className="flex min-w-[10rem] items-center gap-2"><Meter pct={t.progress} label={`${t.label} progress`} /><Badge tone={t.onPace ? 'ok' : 'warn'}>{t.onPace ? 'on pace' : 'behind'}</Badge></span> : <span className="text-xs text-ink-400">no target</span>}</td>
                      <td className={`${td} text-right`}>
                        {data.canEdit && edit?.metric !== t.metric && (
                          <span className="inline-flex gap-2">
                            <button className="text-xs text-brand hover:underline" onClick={() => setEdit({ metric: t.metric, value: t.target != null && !t.isDefault ? String(t.target) : '' })}>{t.target != null && !t.isDefault ? 'Edit' : 'Set'}</button>
                            {t.target != null && !t.isDefault && <button className="text-xs text-ink-400 hover:text-bad" disabled={busy} onClick={() => save(t.metric, null)}>Clear</button>}
                          </span>
                        )}
                        {edit?.metric === t.metric && <button className="text-xs text-ink-400 hover:text-ink-100" onClick={() => setEdit(null)}>Cancel</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.canEdit && <p className="mt-2 text-label text-ink-400">Your role can view targets; a SUPERADMIN or ADMIN sets them.</p>}
          </>
        )}
      </ChartCard>
    </div>
  );
}

const KINDS: Record<string, { label: string; help: string; keys: string[] }> = {
  infra_cost: { label: 'Infrastructure', help: 'Servers, database, storage and GPU invoices. Spread over active people in unit economics.', keys: ['aws', 'rds', 'modal', 'r2', 'expo', 'email', 'other'] },
  cac_spend: { label: 'Acquisition spend', help: 'Ads, influencers and referral rewards. ÷ new payers that month = CAC.', keys: ['instagram', 'google_ads', 'youtube', 'influencers', 'referral_rewards', 'events', 'other'] },
};

/** Infrastructure invoices and acquisition spend for a month, entered by hand (they aren't in our data). */
function MonthlyInputs() {
  const [month, setMonth] = useState(thisMonth());
  const { data, error, reload } = useAdminApi<any>('business/manual', { params: { month } });
  const [form, setForm] = useState({ kind: 'infra_cost', key: '', valueInr: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const put = async (body: Record<string, any>) => {
    setBusy(true); setErr(null);
    try { await adminSend('PUT', 'business/manual', { month, ...body }); reload(); return true; } catch (e: any) { setErr(e.message); return false; } finally { setBusy(false); }
  };
  return (
    <div id="inputs" className="mt-4 scroll-mt-32 lg:scroll-mt-8">
      <ChartCard title="Monthly inputs" caption="Costs and spend that aren’t in our own data. Infrastructure feeds unit economics; acquisition spend feeds CAC (last month’s is used)." source="manual"
        actions={<MonthPicker value={month} onChange={setMonth} />}>
        {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-32 w-full" /> : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {!data.rows.length ? <p className="py-6 text-center text-sm text-ink-400">Nothing entered for {fmtMonth(month)}.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><th className={th}>Kind</th><th className={th}>What</th><th className={`${th} text-right`}>Amount</th><th className={th}>Note</th><th className={th}>By</th><th className={th} /></tr></thead>
                    <tbody>
                      {data.rows.map((r: any) => (
                        <tr key={r.id} className="border-t border-ink-700">
                          <td className={td}>{KINDS[r.kind]?.label || r.kind}</td>
                          <td className={td}>{r.key}</td>
                          <td className={`${td} text-right`} data-numeric>{fmtInr(r.valueInr)}</td>
                          <td className={`${td} max-w-[16rem] truncate text-ink-300`} title={r.note || ''}>{r.note || '–'}</td>
                          <td className={`${td} text-xs text-ink-400`}>{r.createdBy || '–'}</td>
                          <td className={`${td} text-right`}>{data.canEdit && <button aria-label={`Remove ${r.key}`} className="text-ink-400 hover:text-bad" disabled={busy} onClick={() => put({ kind: r.kind, key: r.key, valueInr: null })}><Trash2 size={14} aria-hidden="true" /></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <dl className="mt-3 flex flex-wrap gap-6 border-t border-ink-700 pt-3 text-sm">
                <div><dt className="text-label uppercase text-ink-400">Infrastructure</dt><dd data-numeric className="text-ink-100">{fmtInr(data.infraInr)}</dd></div>
                <div><dt className="text-label uppercase text-ink-400">Acquisition spend</dt><dd data-numeric className="text-ink-100">{fmtInr(data.cacSpendInr)}</dd></div>
              </dl>
            </div>
            {data.canEdit ? (
              <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (await put({ kind: form.kind, key: form.key.trim().toLowerCase(), valueInr: form.valueInr, note: form.note })) setForm({ ...form, key: '', valueInr: '', note: '' }); }}>
                <p className="text-xs font-medium text-ink-100">Add or replace an amount</p>
                <select aria-label="Kind" className={`${inputCls} w-full`} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <p className="text-label text-ink-400">{KINDS[form.kind].help}</p>
                <input aria-label="What" list="manual-keys" placeholder="what, e.g. aws or instagram" className={`${inputCls} w-full`} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
                <datalist id="manual-keys">{KINDS[form.kind].keys.map((x) => <option key={x} value={x} />)}</datalist>
                <input aria-label="Amount in rupees" type="number" min={0} step="any" placeholder="amount (₹, incl. GST)" className={`${inputCls} w-full`} value={form.valueInr} onChange={(e) => setForm({ ...form, valueInr: e.target.value })} />
                <input aria-label="Note" maxLength={200} placeholder="note (optional, e.g. invoice number)" className={`${inputCls} w-full`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                {err && <p className="text-xs text-bad">{err}</p>}
                <div className="flex items-center gap-2">
                  <button className={primaryBtnCls} disabled={busy || !form.key.trim() || form.valueInr === ''}>Save</button>
                  <button type="button" className={btnCls} onClick={() => setForm({ kind: form.kind, key: '', valueInr: '', note: '' })}>Clear</button>
                </div>
                <p className="text-label text-ink-400">The same kind and name in a month replaces the earlier amount. Every change is in the audit log.</p>
              </form>
            ) : <p className="text-xs text-ink-400">Your role can view these; a SUPERADMIN or ADMIN enters them.</p>}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
