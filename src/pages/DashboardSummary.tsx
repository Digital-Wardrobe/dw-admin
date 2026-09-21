import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts';
import { Users, Activity, Smartphone } from 'lucide-react';

import { useAdminApi } from '../lib/useAdminApi';
import {
  PageHeader, Card, CardHeader, StatTile, StatTileSkeleton,
  ChartSkeleton, InlineError, EmptyState, StatusPill, fmt,
} from '../components/ui';

/* One accent plus a neutral ramp. The old chart used neon cyan, magenta and a
   stray violet, which implied three unrelated categories were each important.
   A single hue with stepped lightness reads as "parts of one whole". */
const SERIES = ['#C9A84C', '#8A7231', '#5E5A4A', '#3B4252'];

const NETWORK_LABELS: Record<string, string> = {
  WIFI: 'Wi-Fi',
  CELLULAR: 'Cellular',
  UNKNOWN: 'Not reported',
};

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-inner border border-ink-600 bg-ink-850 px-3 py-2 shadow-lift">
      <p className="text-xs font-medium text-ink-100">{p.name}</p>
      <p data-numeric className="text-xs text-ink-300">
        {fmt(p.value)} {p.value === 1 ? 'session' : 'sessions'}
      </p>
    </div>
  );
}

export default function DashboardSummary() {
  const { data, loading, error, reload } = useAdminApi<any>('dashboard-summary');

  const summary = data?.summary;
  const totalUsers = summary?.totalUsers ?? 0;
  const totalLogs = summary?.totalActivityLogs ?? 0;

  const network = (data?.networkDistribution ?? [])
    .map((row: any) => ({
      name: NETWORK_LABELS[row.networkType] ?? row.networkType ?? 'Not reported',
      value: row?._count?._all ?? 0,
    }))
    .filter((row: any) => row.value > 0)
    .sort((a: any, b: any) => b.value - a.value);

  const networkTotal = network.reduce((sum: number, r: any) => sum + r.value, 0);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Accounts, recorded activity and how people are connecting. Figures come straight from the production database."
        actions={<StatusPill ok={!error} label={error ? 'API unreachable' : 'API connected'} />}
      />

      {error ? (
        <InlineError message={error} onRetry={reload} />
      ) : (
        <>
          {/* Four tiles rather than three: a row of three equal cards is the
              most recognisable generic dashboard layout there is. */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading ? (
              <>
                <StatTileSkeleton /><StatTileSkeleton />
                <StatTileSkeleton /><StatTileSkeleton />
              </>
            ) : (
              <>
                <StatTile
                  label="Registered accounts"
                  value={fmt(totalUsers)}
                  icon={<Users size={16} strokeWidth={1.75} />}
                  hint="Every account created, including inactive ones."
                />
                <StatTile
                  label="Activity events"
                  value={fmt(totalLogs)}
                  icon={<Activity size={16} strokeWidth={1.75} />}
                  hint="Actions written to the audit log."
                />
                <StatTile
                  label="Sessions with network data"
                  value={fmt(networkTotal)}
                  icon={<Smartphone size={16} strokeWidth={1.75} />}
                  hint="Sessions that reported a connection type."
                />
                <StatTile
                  label="Events per account"
                  value={totalUsers > 0 ? (totalLogs / totalUsers).toFixed(1) : '—'}
                  hint="Average across all registered accounts."
                />
              </>
            )}
          </div>

          {/* Asymmetric split — the chart earns more room than the notes beside
              it, so a 50/50 grid would waste half the row. */}
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              {loading ? (
                <ChartSkeleton />
              ) : (
                <Card>
                  <CardHeader
                    title="How people connect"
                    hint={networkTotal > 0 ? `${fmt(networkTotal)} sessions` : undefined}
                  />
                  <div className="p-5">
                    {network.length === 0 ? (
                      <EmptyState
                        title="No connection data yet"
                        body="Network type is recorded when the mobile app reports a session. It will appear here once the app is in use."
                        icon={<Smartphone size={26} />}
                      />
                    ) : (
                      <div className="grid items-center gap-6 sm:grid-cols-2">
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={network}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={62}
                              outerRadius={96}
                              paddingAngle={2}
                              stroke="none"
                            >
                              {network.map((_: any, i: number) => (
                                <Cell key={i} fill={SERIES[i % SERIES.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>

                        {/* A readable legend with values beats recharts' default
                            swatch row, which drops the numbers entirely. */}
                        <ul className="space-y-3">
                          {network.map((row: any, i: number) => {
                            const pct = networkTotal ? (row.value / networkTotal) * 100 : 0;
                            return (
                              <li key={row.name}>
                                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                                  <span className="flex items-center gap-2 text-sm text-ink-100">
                                    <span
                                      aria-hidden="true"
                                      className="h-2.5 w-2.5 rounded-[3px]"
                                      style={{ background: SERIES[i % SERIES.length] }}
                                    />
                                    {row.name}
                                  </span>
                                  <span data-numeric className="text-sm text-ink-300">
                                    {pct.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="h-1 w-full overflow-hidden rounded-full bg-ink-700">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${pct}%`, background: SERIES[i % SERIES.length] }}
                                  />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>

            <div className="lg:col-span-2">
              {loading ? (
                <ChartSkeleton height={200} />
              ) : (
                <Card className="h-full">
                  <CardHeader title="Reading these numbers" />
                  <dl className="divide-y divide-ink-700">
                    {[
                      ['Registered accounts', 'Total rows in the user table. Not the same as active users — it includes accounts that never completed onboarding.'],
                      ['Activity events', 'One row per logged action. Volume scales with usage, so compare it against account growth rather than on its own.'],
                      ['Connection type', 'Reported by the mobile client. "Not reported" covers sessions from builds that predate connection tracking.'],
                    ].map(([term, desc]) => (
                      <div key={term} className="px-5 py-4">
                        <dt className="text-sm font-medium text-ink-100">{term}</dt>
                        <dd className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-400">{desc}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
