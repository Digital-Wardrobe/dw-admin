import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import { AlertTriangle, Cpu, Zap } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { PageHeader, Card, Badge, InlineError, EmptyState, Skeleton, StatTileSkeleton, ChartSkeleton } from '../../components/ui';
import {
  DashControls, useDashParams, Kpi, ChartCard, ExportButton, Meter, ChartTip, Segmented, SourceBadge, AsOf,
  axis, th, td, fmtUsd, fmtInr, fmtN, fmtPct, fmtMs, fmtDay, fmtCompact, deltaOf, Grid,
} from '../../components/dash';
import { CHART, colourFor } from '../../chartColors';

const STATUS: Record<string, { tone: 'ok' | 'warn' | 'bad' | 'neutral'; text: string; help: string }> = {
  ok: { tone: 'ok', text: 'Healthy', help: 'Under 10% errors in the last 15 minutes' },
  degraded: { tone: 'warn', text: 'Degraded', help: '10–50% errors in the last 15 minutes' },
  down: { tone: 'bad', text: 'Down', help: 'Over half the calls failed in the last 15 minutes' },
  quiet: { tone: 'neutral', text: 'Quiet', help: 'Fewer than 20 calls in 15 minutes: too few to judge' },
  idle: { tone: 'neutral', text: 'Idle', help: 'Set up, no calls in the last 24 hours' },
  off: { tone: 'neutral', text: 'Not set up', help: 'No key or URL configured on the server' },
};

function ProviderCard({ p, fx }: { p: any; fx: number }) {
  const s = STATUS[p.status] || STATUS.idle;
  const a = p.allowance;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-50">{p.label}</p>
          <p className="text-label text-ink-400">{p.id}</p>
        </div>
        <span title={s.help}><Badge tone={s.tone}><span className={`h-1.5 w-1.5 rounded-full ${s.tone === 'ok' ? 'bg-ok' : s.tone === 'warn' ? 'bg-warn' : s.tone === 'bad' ? 'bg-bad' : 'bg-ink-400'}`} aria-hidden="true" />{s.text}</Badge></span>
      </div>
      {p.warning && <p className="flex gap-1.5 text-xs text-warn"><AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />{p.warning}</p>}
      {p.id === 'gemini' && <p className="text-xs text-ink-400">User photos: {p.photosAllowed ? 'allowed (paid key)' : 'blocked until GEMINI_BILLING=paid'}</p>}

      <div>
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="text-ink-300">This month</span>
          <span data-numeric className="text-ink-100">{fmtUsd(p.month.spentUsd)}{p.month.budgetUsd ? <span className="text-ink-400"> of {fmtUsd(p.month.budgetUsd, 0)}</span> : null}</span>
        </div>
        {p.month.budgetUsd ? <Meter pct={p.month.budgetPct} label={`${p.label} budget used`} /> : null}
        <p className="mt-1 text-label text-ink-400">
          on pace for {fmtUsd(p.month.projectedUsd)} · {fmtInr(p.month.spentUsd * fx)}
          {p.month.reportedUsd != null && <> · provider says {fmtUsd(p.month.reportedUsd)}</>}
        </p>
      </div>

      {a && a.kind !== 'rate' && (
        <div>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-ink-300">{a.kind === 'credit' ? 'Free credit' : 'Monthly requests'}</span>
            <span data-numeric className="text-ink-100">{a.kind === 'credit' ? `${fmtUsd(a.remaining)} left of ${fmtUsd(a.allowance, 0)}` : `${fmtN(a.remaining)} left of ${fmtN(a.allowance)}`}</span>
          </div>
          <Meter pct={a.used / a.allowance} label="Allowance used" />
          <p className="mt-1 text-label text-ink-400">{a.runOutDate ? `runs out around ${fmtDay(a.runOutDate)} at this pace` : 'lasts the month at this pace'}</p>
        </div>
      )}
      {a?.kind === 'rate' && <p className="text-xs text-ink-400">Rate limit: {fmtN(a.allowance)} {a.unit}</p>}

      <dl className="grid grid-cols-3 gap-2 border-t border-ink-700 pt-3 text-xs">
        <div><dt className="text-label text-ink-400">Calls</dt><dd data-numeric className="text-ink-100">{fmtCompact(p.calls)}</dd></div>
        <div><dt className="text-label text-ink-400">Errors</dt><dd data-numeric className={p.errorRate > 0.1 ? 'text-bad' : 'text-ink-100'}>{fmtPct(p.errorRate)}</dd></div>
        <div><dt className="text-label text-ink-400" title={p.latencyNote}>p50 / p95</dt><dd data-numeric className="text-ink-100">{fmtMs(p.p50Ms)} / {fmtMs(p.p95Ms)}</dd></div>
      </dl>
      {p.gpu && (
        <dl className="grid grid-cols-3 gap-2 border-t border-ink-700 pt-3 text-xs">
          <div><dt className="text-label text-ink-400">Cold starts</dt><dd data-numeric className="text-ink-100">{fmtPct(p.gpu.coldStartRate)}</dd></div>
          <div><dt className="text-label text-ink-400">GPU tier</dt><dd className="text-ink-100">{p.gpu.tier === 'fast' ? 'H100 (fast)' : 'A100'}{!p.gpu.fastConfigured && <span className="text-ink-400"> · no fast tier</span>}</dd></div>
          <div><dt className="text-label text-ink-400">Last switch</dt><dd className="text-ink-100">{p.gpu.lastSwitch ? `${new Date(p.gpu.lastSwitch.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} → ${p.gpu.lastSwitch.to}` : 'never'}</dd></div>
        </dl>
      )}
    </Card>
  );
}

function Heatmap({ data }: { data: any }) {
  const max = data.max || 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr><th className="w-10" />{Array.from({ length: 24 }, (_, h) => <th key={h} className="text-[10px] font-normal text-ink-400">{h % 3 === 0 ? h : ''}</th>)}</tr>
        </thead>
        <tbody>
          {data.grid.map((row: number[], d: number) => (
            <tr key={d}>
              <th className="pr-1 text-right text-[11px] font-normal text-ink-400">{data.weekdays[d]}</th>
              {row.map((v, h) => (
                <td key={h} title={`${data.weekdays[d]} ${h}:00 · ${data.metric === 'cost' ? fmtUsd(v) : fmtN(v)} over ${data.daysPerWeekday[d]} days`}
                  className="h-5 min-w-[14px] rounded-[3px]" style={{ background: v ? `rgb(var(--brand) / ${0.08 + 0.92 * (v / max)})` : 'rgb(var(--ink-700) / 0.5)' }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-label text-ink-400">India time. Darker = more. Hover a cell for the number.</p>
    </div>
  );
}

export default function AiCosts() {
  const { query, compare, ready } = useDashParams();
  const [heatMetric, setHeatMetric] = useState<'calls' | 'cost'>('cost');
  const prov = useAdminApi<any>('ai/providers', { params: query, enabled: ready });
  const spend = useAdminApi<any>('ai/spend', { params: query, enabled: ready });
  const limits = useAdminApi<any>('ai/limits');
  const heat = useAdminApi<any>('ai/heatmap', { params: { ...query, metric: heatMetric }, enabled: ready });
  const matrix = useAdminApi<any>('ai/matrix', { params: query, enabled: ready });

  const s = spend.data;
  const series = s?.series || [];
  const keys: string[] = s?.seriesKeys || [];
  const fx = prov.data?.fxUsdInr || s?.fxUsdInr || 88;

  return (
    <>
      <PageHeader
        title="AI & Costs"
        subtitle="What every AI model, GPU and paid API costs us, how each provider is doing, and how close we are to each limit. Costs are estimates (our usage × the price table) unless marked otherwise."
        actions={<Link to="/admin/prices" className="rounded-inner border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-100 transition hover:border-brand-line hover:text-brand">Price table</Link>}
      />
      <DashControls note="Plan, platform and other filters don't apply to provider costs: AI calls are counted per provider, not per device." />

      {spend.error ? <InlineError message={spend.error} onRetry={spend.reload} /> : (
        <Grid cols={4}>
          {!s ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
            <Kpi label="Spend in range" value={fmtUsd(s.total.costUsd)} source="estimated" delta={compare ? deltaOf(s.total.costUsd, s.total.prevCostUsd, 'down') : null} spark={series.map((r: any) => r.total)} hint={fmtInr(s.total.costInr)} />
            <Kpi label="This month" value={fmtUsd(prov.data?.spentMonthUsd)} source="estimated" hint={prov.data?.budgetTotalUsd ? `of ${fmtUsd(prov.data.budgetTotalUsd, 0)} budget (${fmtPct(prov.data.spentMonthUsd / prov.data.budgetTotalUsd, 0)})` : undefined} />
            <Kpi label="Cost per active user" value={fmtInr(s.costPerActiveUserInr)} source="estimated" hint={`${fmtN(s.activeUsers)} people active in the range`} />
            <Kpi label="AI calls" value={fmtCompact(s.total.calls)} delta={compare ? deltaOf(s.total.calls, s.total.prevCalls) : null} hint={`${fmtUsd(s.total.calls ? s.total.costUsd / s.total.calls : null)} a call on average`} />
          </>}
        </Grid>
      )}

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-medium text-ink-100"><Cpu size={15} aria-hidden="true" /> Providers {prov.data && <AsOf at={prov.data.asOf} />}</h2>
      {prov.error ? <InlineError message={prov.error} onRetry={prov.reload} /> : !prov.data ? (
        <Grid cols={3}>{Array.from({ length: 6 }, (_, i) => <Card key={i} className="p-4"><Skeleton className="h-40 w-full" /></Card>)}</Grid>
      ) : (
        <Grid cols={3}>{prov.data.providers.map((p: any) => <ProviderCard key={p.id} p={p} fx={fx} />)}</Grid>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {!s ? <><ChartSkeleton /><ChartSkeleton /></> : <>
          <ChartCard className="xl:col-span-2" title="Spend by provider" caption="Estimated USD a day, stacked by provider." asOf={s.asOf} source="estimated"
            actions={<ExportButton path="ai/spend" params={query} table="daily" />}>
            {series.every((r: any) => !r.total) ? <EmptyState title="No AI spend in this range" body="Calls are recorded as they happen; the chart fills in as people use AI features." /> : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" {...axis} tickFormatter={fmtDay} minTickGap={24} />
                  <YAxis {...axis} width={48} tickFormatter={(v) => fmtUsd(v, 0)} />
                  <Tooltip content={<ChartTip format={(v: number) => fmtUsd(v)} labelFormat={fmtDay} />} />
                  {keys.map((k) => <Area key={k} type="monotone" dataKey={k} name={k} stackId="1" stroke={colourFor(k, keys)} fill={colourFor(k, keys)} fillOpacity={0.35} strokeWidth={1.5} />)}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
          <ChartCard title="Spend by feature" caption="Which part of the app the money goes to, over the range." asOf={s.asOf} source="estimated"
            actions={<ExportButton path="ai/spend" params={query} table="features" />}>
            {!s.features.length ? <EmptyState title="Nothing yet" body="No AI calls in this range." /> : (
              <ResponsiveContainer width="100%" height={Math.max(180, s.features.slice(0, 10).length * 30)}>
                <BarChart data={s.features.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                  <XAxis type="number" {...axis} tickFormatter={(v) => fmtUsd(v, 0)} />
                  <YAxis type="category" dataKey="feature" {...axis} width={96} />
                  <Tooltip content={<ChartTip format={(v: number) => fmtUsd(v)} />} cursor={{ fill: 'rgb(var(--ink-700) / 0.4)' }} />
                  <Bar dataKey="costUsd" name="Spend" fill={CHART.brand} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </>}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="AI cost against revenue, by plan" caption="AI cost per active person on each plan, next to what one paying person on it brings in (net of GST and fees)." asOf={s?.asOf} source="estimated"
          actions={<ExportButton path="ai/spend" params={query} table="plans" />}>
          {!s ? <Skeleton className="h-40 w-full" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className={th}>Plan</th><th className={`${th} text-right`}>Active</th><th className={`${th} text-right`} title="AI cost per active person on the plan">AI / person</th><th className={`${th} text-right`} title="Net revenue per paying person (after GST and fees)">Revenue / payer</th><th className={`${th} text-right`}>Margin</th></tr></thead>
                <tbody>
                  {s.plans.map((p: any) => (
                    <tr key={p.plan} className="border-t border-ink-700">
                      <td className={td}>{p.plan}</td>
                      <td className={`${td} text-right`} data-numeric>{fmtN(p.activeUsers)}</td>
                      <td className={`${td} text-right`} data-numeric>{fmtInr(p.costPerActiveUserInr)}</td>
                      <td className={`${td} text-right`} data-numeric>{p.plan === 'FREE' ? '–' : p.netRevenuePerPayerInr == null ? <span className="text-ink-400">no payers yet</span> : fmtInr(p.netRevenuePerPayerInr)}</td>
                      <td className={`${td} text-right`}>{p.plan === 'FREE' ? <span className="text-ink-400">free</span> : p.margin == null ? '–' : <Badge tone={p.margin >= 0 ? 'ok' : 'bad'}>{p.margin >= 0 ? `+${fmtInr(p.margin)}` : fmtInr(p.margin)}</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Limits and quotas" caption="Budgets, free credit, monthly quotas and rate limits this month. Marks at 50% and 80%." asOf={limits.data?.asOf}
          actions={<ExportButton path="ai/limits" params={{}} table="limits" />}>
          {limits.error ? <InlineError message={limits.error} onRetry={limits.reload} /> : !limits.data ? <Skeleton className="h-40 w-full" /> : (
            <ul className="space-y-3">
              {limits.data.items.map((it: any) => (
                <li key={it.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-ink-100">{it.name}</span>
                    <span data-numeric className={`shrink-0 ${it.level === '100' ? 'text-bad' : it.level === '80' ? 'text-warn' : 'text-ink-300'}`}>
                      {it.unit === 'USD' ? `${fmtUsd(it.used)} / ${fmtUsd(it.limit, 0)}` : `${fmtN(it.used)} / ${fmtN(it.limit)} ${it.unit}`} · {fmtPct(it.pct, 0)}
                    </span>
                  </div>
                  <Meter pct={it.pct} label={it.name} />
                  {it.runOutDate && <p className="mt-0.5 text-label text-ink-400">reaches the limit around {fmtDay(it.runOutDate)}</p>}
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <ChartCard title="When AI is used" caption="Hour of day × day of week over the range, summed." asOf={heat.data?.asOf} source={heatMetric === 'cost' ? 'estimated' : 'measured'}
          actions={<><Segmented value={heatMetric} onChange={setHeatMetric} label="Heatmap metric" options={[{ id: 'cost', label: 'Spend' }, { id: 'calls', label: 'Calls' }]} /><ExportButton path="ai/heatmap" params={{ ...query, metric: heatMetric }} table="grid" /></>}>
          {heat.error ? <InlineError message={heat.error} onRetry={heat.reload} /> : !heat.data ? <Skeleton className="h-44 w-full" /> : heat.data.max === 0 ? <EmptyState title="No calls in this range" body="The heatmap fills in as AI features are used." /> : <Heatmap data={heat.data} />}
        </ChartCard>

        <ChartCard title="Feature × provider" caption="Each feature by the provider that served it: spend, calls, errors and p95 latency. Fallbacks show when the first provider failed." asOf={matrix.data?.asOf} source="estimated"
          actions={<ExportButton path="ai/matrix" params={query} table="cells" />}>
          {matrix.error ? <InlineError message={matrix.error} onRetry={matrix.reload} /> : !matrix.data ? <Skeleton className="h-40 w-full" /> : !matrix.data.cells.length ? <EmptyState title="No calls yet" body="Nothing to break down in this range." /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className={th}>Feature</th>{matrix.data.providers.map((p: string) => <th key={p} className={`${th} text-right`}>{p}</th>)}</tr></thead>
                <tbody>
                  {matrix.data.features.map((f: string) => (
                    <tr key={f} className="border-t border-ink-700">
                      <td className={td}>{f}</td>
                      {matrix.data.providers.map((p: string) => {
                        const c = matrix.data.cells.find((x: any) => x.feature === f && x.provider === p);
                        return (
                          <td key={p} className={`${td} text-right align-top`} title={c ? `${fmtN(c.calls)} calls · ${fmtPct(c.errorRate)} errors · p95 ${fmtMs(c.p95Ms)} · ${fmtN(c.fallbacks)} fallbacks · ${fmtUsd(c.costPerCallUsd)} a call` : ''}>
                            {c ? <>
                              <span data-numeric className="block text-ink-100">{fmtUsd(c.costUsd)}</span>
                              <span data-numeric className={`block text-label ${c.errorRate > 0.1 ? 'text-bad' : 'text-ink-400'}`}>{fmtCompact(c.calls)} calls · {fmtPct(c.errorRate, 0)}{c.fallbacks ? ` · ${fmtN(c.fallbacks)} fb` : ''}</span>
                            </> : <span className="text-ink-600">·</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-ink-400"><Zap size={13} aria-hidden="true" /> Sources: <SourceBadge source="measured" /> counted in our ledger · <SourceBadge source="estimated" /> usage × price table · <SourceBadge source="provider" /> the provider's own figure (see Reconciliation).</p>
    </>
  );
}
