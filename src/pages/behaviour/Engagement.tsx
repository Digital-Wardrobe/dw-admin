import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useAdminApi } from '../../lib/useAdminApi';
import { PageHeader, InlineError, EmptyState, Skeleton, StatTileSkeleton } from '../../components/ui';
import {
  DashControls, useDashParams, useHashScroll, Kpi, ChartCard, ExportButton, ChartTip, ShareBar, Spark,
  axis, th, td, fmtN, fmtPct, fmtDay, deltaOf, Grid,
} from '../../components/dash';
import { CHART, colourFor } from '../../chartColors';
import { FEATURE_NAMES } from '../../lib/names';

/* Dashboard 2: how often people come back, how long they stay, how each sign-up week holds up,
   and which features go with people staying. Everything here is counts from the daily rollups. */

const PLAN_KEYS = ['FREE', 'PLUS', 'PRO', 'STUDIO'];
const pctTick = (v: number) => `${Math.round(v * 100)}%`;

function Heatmap({ rows }: { rows: any[] }) {
  if (!rows.length) return <EmptyState title="No sign-ups in this range" body="Pick a longer range to see weekly cohorts." />;
  const weeks = rows[0].weeks.length;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className={th}>Signed up (week of)</th><th className={`${th} text-right`}>People</th>
            {Array.from({ length: weeks }, (_, k) => <th key={k} className={`${th} text-center`}>W{k}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.week}>
              <td className="whitespace-nowrap px-2 py-1 text-ink-100">{fmtDay(r.week)}</td>
              <td className="px-2 py-1 text-right text-ink-300" data-numeric>{fmtN(r.size)}</td>
              {r.weeks.map((v: number | null, k: number) => (
                <td key={k} className="min-w-[2.6rem] rounded-[4px] px-1 py-1 text-center" data-numeric
                  style={v == null ? undefined : { background: `rgb(var(--brand) / ${0.08 + v * 0.8})`, color: v > 0.5 ? 'rgb(var(--ink-950))' : undefined }}
                  title={v == null ? 'not reached yet' : `${fmtPct(v)} of ${fmtN(r.size)} active in week ${k}`}>
                  {v == null ? '' : Math.round(v * 100)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Engagement() {
  const { query, compare, ready } = useDashParams();
  const e = useAdminApi<any>('behaviour/engagement', { params: query, enabled: ready });
  const r = useAdminApi<any>('behaviour/retention', { params: { range: query.range, ...(query.from && { from: query.from, to: query.to }) }, enabled: ready });
  const a = useAdminApi<any>('behaviour/adoption', { params: { range: query.range, ...(query.from && { from: query.from, to: query.to }) }, enabled: ready });
  useHashScroll(!!r.data && !!a.data);
  const k = e.data?.kpis, p = compare ? e.data?.prev : null;
  const filtered = e.data && Object.keys(e.data.filters || {}).length > 0;
  const totalPlatform = e.data?.platforms.reduce((s: number, x: any) => s + x.peopleDays, 0) || 0;

  return (
    <>
      <PageHeader title="Engagement" subtitle="How often people come back, how long they stay, and which features go with staying." />
      <DashControls filters note="Plan, platform, version, city tier and source filter the activity numbers; retention and feature adoption always cover everyone." />
      {e.error ? <InlineError message={e.error} onRetry={e.reload} /> : (
        <>
          <Grid cols={4}>
            {!k ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
              <Kpi label="Daily active (average)" value={fmtN(k.dauAvg)} delta={deltaOf(k.dauAvg, p?.dauAvg)} spark={e.data.series.map((x: any) => x.dau)} hint={p ? `${fmtN(p.dauAvg)} the period before` : 'people who did something in the app'} />
              <Kpi label="Weekly active" value={fmtN(k.wau)} delta={deltaOf(k.wau, p?.wau)} hint="distinct people in the 7 days to the last day" />
              <Kpi label="Monthly active" value={fmtN(k.mau)} delta={deltaOf(k.mau, p?.mau)} hint="distinct people in the 30 days to the last day" />
              <Kpi label="Stickiness" value={fmtPct(k.stickiness)} delta={deltaOf(k.stickiness, p?.stickiness)} hint="average daily ÷ monthly active (20%+ is a habit)" />
            </>}
          </Grid>
          <div className="mt-4">
            <Grid cols={3}>
              {!k ? Array.from({ length: 3 }, (_, i) => <StatTileSkeleton key={i} />) : <>
                <Kpi label="Sessions a day" value={k.sessionsPerUserDay != null ? k.sessionsPerUserDay.toFixed(1) : '–'} delta={deltaOf(k.sessionsPerUserDay, p?.sessionsPerUserDay)} hint="per person, on days they open the app" />
                <Kpi label="Average session" value={k.avgSessionMin != null ? `${k.avgSessionMin.toFixed(1)} min` : '–'} delta={deltaOf(k.avgSessionMin, p?.avgSessionMin)} hint="foreground time; back after 30 minutes is a new session" />
                <Kpi label="Time a day" value={k.minutesPerUserDay != null ? `${k.minutesPerUserDay.toFixed(1)} min` : '–'} delta={deltaOf(k.minutesPerUserDay, p?.minutesPerUserDay)} hint="per person, on days they open the app" />
              </>}
            </Grid>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard className="xl:col-span-2" title="Daily, weekly and monthly active" asOf={e.data?.asOf}
              caption={filtered ? 'With filters, only daily active is drawn; weekly and monthly are for the last day (above).' : 'Distinct people active that day, in the 7 days and in the 30 days to that day.'}
              actions={<ExportButton path="behaviour/engagement" params={query} table="daily" />}>
              {!e.data ? <Skeleton className="h-64 w-full" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={e.data.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" {...axis} tickFormatter={fmtDay} minTickGap={32} />
                    <YAxis {...axis} width={44} />
                    <Tooltip content={<ChartTip labelFormat={fmtDay} />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: CHART.text }} />
                    <Line type="monotone" dataKey="dau" name="Daily" stroke={CHART.brand} dot={false} strokeWidth={1.75} />
                    {e.data.wauMauDaily && <Line type="monotone" dataKey="wau" name="Weekly" stroke="rgb(var(--c3))" dot={false} strokeWidth={1.5} />}
                    {e.data.wauMauDaily && <Line type="monotone" dataKey="mau" name="Monthly" stroke="rgb(var(--c2))" dot={false} strokeWidth={1.5} />}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Platforms" caption="Share of active people-days." actions={<ExportButton path="behaviour/engagement" params={query} table="platforms" />}>
              {!e.data ? <Skeleton className="h-40 w-full" /> : !e.data.platforms.length ? <p className="text-sm text-ink-400">{filtered ? 'Not split by platform when filters are on.' : 'No activity yet.'}</p> : (
                <ul className="space-y-3">
                  {e.data.platforms.map((x: any) => (
                    <li key={x.key}>
                      <div className="mb-1 flex justify-between text-sm"><span className="text-ink-100">{x.key === 'ios' ? 'iOS' : x.key === 'android' ? 'Android' : x.key}</span><span data-numeric className="text-ink-100">{fmtPct(totalPlatform ? x.peopleDays / totalPlatform : 0, 0)}</span></div>
                      <ShareBar pct={totalPlatform ? x.peopleDays / totalPlatform : 0} label={x.key} />
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          </div>

          {!filtered && (
            <div className="mt-4">
              <ChartCard title="Active people by plan" caption="Each day, by the plan people had that day." actions={<ExportButton path="behaviour/engagement" params={query} table="plans" />}>
                {!e.data ? <Skeleton className="h-56 w-full" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={e.data.byPlan} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" {...axis} tickFormatter={fmtDay} minTickGap={32} />
                      <YAxis {...axis} width={44} />
                      <Tooltip content={<ChartTip labelFormat={fmtDay} />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: CHART.text }} />
                      {e.data.planKeys.map((pk: string) => <Area key={pk} type="monotone" dataKey={pk} name={pk} stackId="p" stroke={colourFor(pk, PLAN_KEYS)} fill={colourFor(pk, PLAN_KEYS)} fillOpacity={0.35} strokeWidth={1} />)}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          )}
        </>
      )}

      <section id="retention" className="mt-8 scroll-mt-32 lg:scroll-mt-8">
        <h2 className="mb-2 text-label uppercase text-ink-400">Retention</h2>
        {r.error ? <InlineError message={r.error} onRetry={r.reload} /> : (
          <>
            <Grid cols={3}>
              {!r.data ? Array.from({ length: 3 }, (_, i) => <StatTileSkeleton key={i} />) : (['d1', 'd7', 'd30'] as const).map((n) => (
                <Kpi key={n} label={`Day ${n.slice(1)} retention`} value={fmtPct(r.data[n].rate)} hint={r.data[n].cohort ? `of ${fmtN(r.data[n].cohort)} people who signed up in the range and are ${n.slice(1)}+ days in` : 'no one in the range is old enough yet'} />
              ))}
            </Grid>
            <div className="mt-4 grid grid-cols-1 gap-4">
              <ChartCard title="Retention by sign-up day" caption="Share of each day’s sign-ups who came back exactly 1, 7 and 30 days later." asOf={r.data?.asOf}
                actions={<ExportButton path="behaviour/retention" params={{ range: query.range, from: query.from, to: query.to }} table="daily" />}>
                {!r.data ? <Skeleton className="h-64 w-full" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={r.data.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" {...axis} tickFormatter={fmtDay} minTickGap={32} />
                      <YAxis {...axis} width={40} tickFormatter={pctTick} domain={[0, 1]} />
                      <Tooltip content={<ChartTip labelFormat={fmtDay} format={(v: number) => fmtPct(v)} />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: CHART.text }} />
                      <Line type="monotone" dataKey="d1" name="Day 1" stroke={CHART.brand} dot={false} strokeWidth={1.5} connectNulls={false} />
                      <Line type="monotone" dataKey="d7" name="Day 7" stroke="rgb(var(--c3))" dot={false} strokeWidth={1.5} />
                      <Line type="monotone" dataKey="d30" name="Day 30" stroke="rgb(var(--c2))" dot={false} strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
              <ChartCard title="Weekly cohorts" caption="Share of each sign-up week active at least once in each week after (W0 = their first week). Up to 26 weeks of cohorts."
                actions={<ExportButton path="behaviour/retention" params={{ range: query.range, from: query.from, to: query.to }} table="cohorts" />}>
                {!r.data ? <Skeleton className="h-64 w-full" /> : <Heatmap rows={r.data.heatmap} />}
              </ChartCard>
            </div>
          </>
        )}
      </section>

      <section id="adoption" className="mt-8 scroll-mt-32 lg:scroll-mt-8">
        <h2 className="mb-2 text-label uppercase text-ink-400">Feature adoption</h2>
        {a.error ? <InlineError message={a.error} onRetry={a.reload} /> : (
          <ChartCard title="Who uses what, and does it go with staying?" asOf={a.data?.asOf}
            caption={a.data ? `People in the range: ${fmtN(a.data.activeUsers)}. Lift: of ${fmtN(a.data.lift.cohort)} people who signed up ${fmtDay(a.data.lift.from)}–${fmtDay(a.data.lift.to)}, retention (active on days 28–34) of those who used the feature in week one minus those who didn’t (base ${fmtPct(a.data.lift.baseRate, 0)}). It shows what goes together, not what causes what.` : 'Loading…'}
            actions={<ExportButton path="behaviour/adoption" params={{ range: query.range, from: query.from, to: query.to }} table="features" />}>
            {!a.data ? <Skeleton className="h-72 w-full" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={th}>Feature</th><th className={`${th} text-right`}>People</th><th className={`${th} w-40`}>Share of active</th><th className={`${th} w-32`}>People a day</th>
                      <th className={`${th} text-right`}>Retained if used</th><th className={`${th} text-right`}>If not</th><th className={`${th} text-right`}>Lift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.data.features.map((f: any) => (
                      <tr key={f.feature} className="border-t border-ink-700">
                        <td className={td}>{FEATURE_NAMES[f.feature] || f.feature}</td>
                        <td className={`${td} text-right`} data-numeric>{fmtN(f.users)}</td>
                        <td className={td}><span className="flex items-center gap-2"><ShareBar pct={f.share} label={f.feature} /><span data-numeric className="w-10 text-right text-xs text-ink-300">{fmtPct(f.share, 0)}</span></span></td>
                        <td className={td}><Spark values={f.trend} height={22} /></td>
                        <td className={`${td} text-right text-ink-300`} data-numeric>{f.lift == null ? '–' : fmtPct(f.retainedWith, 0)}</td>
                        <td className={`${td} text-right text-ink-300`} data-numeric>{f.lift == null ? '–' : fmtPct(f.retainedWithout, 0)}</td>
                        <td className={`${td} text-right`} data-numeric title={f.lift == null ? `Only ${fmtN(f.cohortUsed)} people used it in week one: too few to compare` : undefined}>
                          {f.lift == null ? <span className="text-xs text-ink-400">too few</span> : <span className={f.lift > 0.02 ? 'text-ok' : f.lift < -0.02 ? 'text-bad' : 'text-ink-300'}>{f.lift > 0 ? '+' : ''}{Math.round(f.lift * 100)} pts</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        )}
      </section>
    </>
  );
}
