import { Link } from 'react-router-dom';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { BellRing, ShieldAlert, Cog } from 'lucide-react';
import { useAdminApi } from '../lib/useAdminApi';
import { useMe } from '../lib/me';
import { PageHeader, Card, Badge, InlineError, EmptyState, Skeleton, StatTileSkeleton } from '../components/ui';
import { Kpi, ChartCard, ChartTip, AsOf, axis, fmtN, fmtUsd, fmtInr, deltaOf, Grid } from '../components/dash';
import { CHART } from '../chartColors';

/* The first page: today against yesterday, what's waiting (jobs, reports, alerts), and the
   last 7 days. Numbers come from the rollups (today's update every 15 minutes, hours every 5). */

const hourLabel = (iso: string) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', hour: '2-digit' });

export default function Overview() {
  const { can } = useMe();
  const { data, error, reload } = useAdminApi<any>('overview');
  const d = data?.today;
  const tr = data?.trends || {};
  const spark = (m: string) => (tr[m] || []).map((r: any) => r.value);

  return (
    <>
      <PageHeader title="Overview" subtitle="Today so far against yesterday, what is waiting on us, and the last seven days." actions={data && <AsOf at={data.asOf} />} />
      {error ? <InlineError message={error} onRetry={reload} /> : (
        <>
          <Grid cols={4}>
            {!d ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
              <Kpi label="Active today" value={fmtN(d.activeUsers)} delta={deltaOf(d.activeUsers, d.activeUsersYesterday)} spark={spark('users.active')} hint={`${fmtN(d.activeUsersYesterday)} yesterday`} />
              <Kpi label="Sign-ups today" value={fmtN(d.signups)} delta={deltaOf(d.signups, d.signupsYesterday)} spark={spark('users.new')} hint={`${fmtN(d.signupsYesterday)} yesterday`} />
              <Kpi label="AI spend today" value={fmtUsd(d.aiCostUsd)} source="estimated" delta={deltaOf(d.aiCostUsd, d.aiCostYesterdayUsd, 'down')} spark={spark('ai.cost_usd')} hint={`${fmtInr(d.aiCostInr)} · ${fmtN(d.aiCalls)} calls, ${fmtN(d.aiErrors)} failed`} />
              <Kpi label="Net revenue today" value={fmtInr(d.revenueNetInr)} delta={deltaOf(d.revenueNetInr, d.revenueYesterdayInr)} spark={spark('revenue.net_inr')} hint={d.newSubs ? `${fmtN(d.newSubs)} new subscriptions` : 'no purchases yet today'} />
            </>}
          </Grid>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-100"><Cog size={15} aria-hidden="true" /> Background jobs</div>
              {!data ? <Skeleton className="h-16 w-full" /> : (
                <>
                  <p className="text-sm text-ink-300"><span data-numeric className="text-2xl font-semibold text-ink-50">{fmtN(data.jobs.queued)}</span> waiting · {fmtN(data.jobs.running)} running</p>
                  {data.jobs.oldestQueuedMinutes != null && <p className={`mt-1 text-xs ${data.jobs.oldestQueuedMinutes > 15 ? 'text-warn' : 'text-ink-400'}`}>oldest has waited {fmtN(data.jobs.oldestQueuedMinutes)} min</p>}
                  <ul className="mt-2 space-y-0.5 text-xs text-ink-400">{data.jobs.byKind.map((j: any) => <li key={`${j.kind}-${j.status}`}>{j.kind} · {j.status.toLowerCase()}: {fmtN(j.count)}</li>)}</ul>
                </>
              )}
            </Card>
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-100"><ShieldAlert size={15} aria-hidden="true" /> Reports</div>
              {!data ? <Skeleton className="h-16 w-full" /> : (
                <>
                  <p className="text-sm text-ink-300"><span data-numeric className="text-2xl font-semibold text-ink-50">{fmtN(data.reports.open)}</span> open</p>
                  <p className="mt-1 text-xs">{data.reports.overdue ? <span className="text-bad">{fmtN(data.reports.overdue)} past their deadline</span> : <span className="text-ink-400">none past their deadline</span>} · {fmtN(data.reports.appeals)} appeals waiting</p>
                  {can('moderation') && <Link to="/admin/moderation" className="mt-2 inline-block text-xs text-brand hover:underline">Open the queue</Link>}
                </>
              )}
            </Card>
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-100"><BellRing size={15} aria-hidden="true" /> Alerts</div>
              {!data ? <Skeleton className="h-16 w-full" /> : !data.alerts.length ? <p className="text-sm text-ink-400">All clear.</p> : (
                <ul className="space-y-2">
                  {data.alerts.map((a: any) => <li key={a.id} className="text-xs"><Badge tone="bad">firing</Badge> <span className="text-ink-100">{a.message}</span></li>)}
                </ul>
              )}
              {can('ai.read') && <Link to="/admin/ai/alerts" className="mt-2 inline-block text-xs text-brand hover:underline">All alerts</Link>}
            </Card>
          </div>

          <div className="mt-4">
            <ChartCard title="Last 48 hours" caption="People active and AI calls per hour (India time)." asOf={data?.asOfHourly}>
              {!data ? <Skeleton className="h-64 w-full" /> : !data.hourly.length ? <EmptyState title="Nothing yet" body="Hourly numbers appear within five minutes of the first activity." /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={data.hourly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hour" {...axis} tickFormatter={hourLabel} minTickGap={40} />
                    <YAxis yAxisId="l" {...axis} width={40} />
                    <YAxis yAxisId="r" orientation="right" {...axis} width={44} />
                    <Tooltip content={<ChartTip labelFormat={hourLabel} />} />
                    <Area yAxisId="l" type="monotone" dataKey="users.active" name="Active people" stroke={CHART.brand} fill={CHART.brand} fillOpacity={0.15} strokeWidth={1.5} />
                    <Line yAxisId="r" type="monotone" dataKey="ai.calls" name="AI calls" stroke="rgb(var(--c3))" dot={false} strokeWidth={1.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}
