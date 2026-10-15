import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useAdminApi } from '../../lib/useAdminApi';
import { PageHeader, InlineError, EmptyState, Skeleton, StatTileSkeleton } from '../../components/ui';
import {
  DashControls, useDashParams, useHashScroll, Kpi, ChartCard, ExportButton, ChartTip, ShareBar,
  axis, th, td, fmtN, fmtPct, fmtDay, deltaOf, Grid,
} from '../../components/dash';
import { CHART, colourFor } from '../../chartColors';

/* Where new people come from: install source, city tier and state, and how much of our growth
   comes from people sharing Fluntr (invites and the k-factor). Counts only, never who. */

const SOURCE_LABEL: Record<string, string> = { organic: 'Organic (store search)', invite: 'Someone’s share', google_ads: 'Google Ads', unknown: 'Not known', other: 'Other' };
const TIER_LABEL: Record<string, string> = { tier1: 'Tier 1 (metros)', tier2: 'Tier 2', tier3: 'Tier 3 and rural', unknown: 'Not known' };
const label = (k: string, map: Record<string, string>) => map[k] || k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function ShareList({ rows, total, labels, keys }: { rows: { key: string; users: number }[]; total: number; labels?: Record<string, string>; keys?: string[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 truncate text-ink-100">
              {keys && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colourFor(keys.includes(r.key) ? r.key : 'other', keys) }} aria-hidden="true" />}
              {labels ? label(r.key, labels) : r.key}
            </span>
            <span data-numeric className="shrink-0 text-ink-100">{fmtN(r.users)} <span className="text-xs text-ink-400">{fmtPct(total ? r.users / total : 0, 0)}</span></span>
          </div>
          <ShareBar pct={total ? r.users / total : 0} colour={keys ? colourFor(keys.includes(r.key) ? r.key : 'other', keys) : undefined} label={`${r.key} share`} />
        </li>
      ))}
    </ul>
  );
}

export default function Growth() {
  const { query, ready } = useDashParams();
  const { data: d, error, reload } = useAdminApi<any>('business/growth', { params: query, enabled: ready });
  useHashScroll(!!d);
  const inv = d?.invites;
  const total = d?.newUsers.now || 0;
  const loop = inv ? [
    { label: 'Shared something', value: inv.shares, help: 'posts, looks, closet items, profiles and collections shared out' },
    { label: 'Shared their own profile or collection', value: inv.sent, help: 'counted as an invite' },
    { label: 'Signed up from a share', value: inv.invitedSignups, help: 'new accounts whose install link named the person who shared' },
  ] : [];

  return (
    <>
      <PageHeader title="Growth" subtitle="Where new people come from, and how much of our growth comes from people sharing Fluntr." />
      <DashControls note="Sources come from the Play install referrer on the first launch; city tier and state from the city people give at sign-up." />
      {error ? <InlineError message={error} onRetry={reload} /> : (
        <>
          <Grid cols={4}>
            {!d ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
              <Kpi label="New sign-ups" value={fmtN(total)} delta={deltaOf(total, d.newUsers.prev)} spark={d.newUsers.series.map((r: any) => r.value)} hint={d.newUsers.prev != null ? `${fmtN(d.newUsers.prev)} the period before` : 'in the selected range'} />
              <Kpi label="From someone’s share" value={fmtN(inv.invitedSignups)} hint={`${fmtPct(inv.invitedShare)} of sign-ups`} />
              <Kpi label="k-factor" value={inv.kFactor != null ? inv.kFactor.toFixed(3) : '–'} hint={`sign-ups from shares ÷ ${fmtN(inv.activeUsers)} active people (1.0 = each person brings one more)`} />
              <Kpi label="Invites sent" value={fmtN(inv.sent)} hint={`${fmtN(inv.shares)} shares of anything in all`} />
            </>}
          </Grid>

          <div className="mt-4">
            <ChartCard title="Sign-ups by source" caption="New accounts each day by where they came from (top six sources; the rest are grouped as Other)." asOf={d?.asOf}
              actions={<ExportButton path="business/growth" params={query} table="daily" />}>
              {!d ? <Skeleton className="h-64 w-full" /> : !total ? <EmptyState title="No sign-ups in this range" body="Pick a longer range, or check back after the next sign-up." /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={d.bySource} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" {...axis} tickFormatter={fmtDay} minTickGap={32} />
                    <YAxis {...axis} width={40} allowDecimals={false} />
                    <Tooltip content={<ChartTip labelFormat={fmtDay} />} cursor={{ fill: 'rgb(var(--ink-700) / 0.4)' }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: CHART.text }} formatter={(v) => label(String(v), SOURCE_LABEL)} />
                    {d.sourceKeys.map((k: string) => <Bar key={k} dataKey={k} name={label(k, SOURCE_LABEL)} stackId="s" fill={colourFor(k, d.sourceKeys)} maxBarSize={28} />)}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard title="Sources" caption="Share of sign-ups in the range." actions={<ExportButton path="business/growth" params={query} table="sources" />}>
              {!d ? <Skeleton className="h-48 w-full" /> : !d.sources.length ? <p className="text-sm text-ink-400">No sign-ups yet.</p> : <ShareList rows={d.sources} total={total} labels={SOURCE_LABEL} keys={d.sourceKeys} />}
            </ChartCard>
            <ChartCard title="City tier" caption="Metros, smaller cities and towns." actions={<ExportButton path="business/growth" params={query} table="city_tiers" />}>
              {!d ? <Skeleton className="h-48 w-full" /> : !d.cityTiers.length ? <p className="text-sm text-ink-400">No sign-ups yet.</p> : <ShareList rows={d.cityTiers} total={total} labels={TIER_LABEL} />}
            </ChartCard>
            <ChartCard title="States" caption="Top 15 states by sign-ups (people who gave a city)." actions={<ExportButton path="business/growth" params={query} table="states" />}>
              {!d ? <Skeleton className="h-48 w-full" /> : !d.states.length ? <p className="text-sm text-ink-400">No states yet: people add a city at sign-up.</p> : (
                <table className="w-full">
                  <thead><tr><th className={th}>State</th><th className={`${th} text-right`}>Sign-ups</th><th className={`${th} text-right`}>Share</th></tr></thead>
                  <tbody>{d.states.map((s: any) => <tr key={s.key} className="border-t border-ink-700"><td className={td}>{s.key}</td><td className={`${td} text-right`} data-numeric>{fmtN(s.users)}</td><td className={`${td} text-right text-ink-300`} data-numeric>{fmtPct(total ? s.users / total : 0, 0)}</td></tr>)}</tbody>
                </table>
              )}
            </ChartCard>
          </div>

          <div id="invites" className="mt-4 scroll-mt-32 lg:scroll-mt-8">
            <ChartCard title="The share loop" caption="Sharing out, inviting, and the people who joined because of it. Share links carry who shared, never what was in the photo." asOf={d?.asOf}>
              {!d ? <Skeleton className="h-32 w-full" /> : (
                <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {loop.map((s, i) => (
                    <li key={s.label} className="rounded-inner border border-ink-700 p-4">
                      <p className="text-label uppercase text-ink-400">Step {i + 1}</p>
                      <p data-numeric className="mt-1 text-2xl font-semibold text-ink-50">{fmtN(s.value)}</p>
                      <p className="text-sm text-ink-100">{s.label}</p>
                      <p className="mt-1 text-xs text-ink-400">{s.help}</p>
                    </li>
                  ))}
                </ol>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}
