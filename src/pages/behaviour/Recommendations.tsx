import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useAdminApi } from '../../lib/useAdminApi';
import { humanise } from '../../lib/names';
import { PageHeader, InlineError, EmptyState, Skeleton, StatTileSkeleton } from '../../components/ui';
import { DashControls, useDashParams, Kpi, ChartCard, ExportButton, ChartTip, ShareBar, axis, th, td, fmtN, fmtPct, fmtDay, Grid } from '../../components/dash';
import { CHART } from '../../chartColors';

/* How Fluntr's outfit suggestions land: accepted, worn, swapped, skipped or dismissed, overall,
   by plan and by style persona (persona only for people who agreed to personalisation). */

const OUTCOMES: { key: string; label: string; colour: string }[] = [
  { key: 'worn', label: 'Worn', colour: 'rgb(var(--ok))' },
  { key: 'accepted', label: 'Accepted', colour: CHART.brand },
  { key: 'swapped', label: 'Swapped a piece', colour: 'rgb(var(--c3))' },
  { key: 'skipped', label: 'Skipped', colour: 'rgb(var(--c5))' },
  { key: 'dismissed', label: 'Dismissed', colour: 'rgb(var(--bad))' },
  { key: 'none', label: 'No response', colour: 'rgb(var(--ink-600))' },
];

function Breakdown({ rows, labelOf }: { rows: any[]; labelOf: (k: string) => string }) {
  if (!rows.length) return <p className="text-sm text-ink-400">No suggestions in this range.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead><tr><th className={th}>Group</th><th className={`${th} text-right`}>Shown</th><th className={`${th} min-w-[8rem]`}>Accepted or worn</th><th className={`${th} text-right`}>Worn</th><th className={`${th} text-right`}>Responded</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-ink-700">
              <td className={td}>{labelOf(r.key)}</td>
              <td className={`${td} text-right`} data-numeric>{fmtN(r.shown)}</td>
              <td className={td}><span className="flex items-center gap-2"><ShareBar pct={r.acceptance} label={r.key} /><span data-numeric className="w-9 text-right text-xs text-ink-300">{fmtPct(r.acceptance, 0)}</span></span></td>
              <td className={`${td} text-right text-ink-300`} data-numeric>{fmtPct(r.wornRate, 0)}</td>
              <td className={`${td} text-right text-ink-300`} data-numeric>{fmtPct(r.responseRate, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Recommendations() {
  const { query, ready } = useDashParams();
  const { data: d, error, reload } = useAdminApi<any>('behaviour/recommendations', { params: query, enabled: ready });
  return (
    <>
      <PageHeader title="Recommendations" subtitle="How outfit suggestions land, by plan and by style persona." />
      <DashControls compare={false} note={d?.note} />
      {error ? <InlineError message={error} onRetry={reload} /> : (
        <>
          <Grid cols={4}>
            {!d ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
              <Kpi label="Suggestions shown" value={fmtN(d.shown)} spark={d.daily.map((x: any) => OUTCOMES.reduce((a, o) => a + (x[o.key] || 0), 0))} hint="outfits Fluntr suggested in the range" />
              <Kpi label="Accepted or worn" value={fmtPct(d.acceptance)} spark={d.daily.map((x: any) => x.acceptance || 0)} hint="the main quality number" />
              <Kpi label="Worn" value={fmtPct(d.wornRate)} hint="people actually wore the suggestion" />
              <Kpi label="Responded" value={fmtPct(d.responseRate)} hint="did anything with it (the rest went unseen or ignored)" />
            </>}
          </Grid>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard className="xl:col-span-2" title="Outcomes each day" caption="Suggestions made that day by what happened to them, with the accepted-or-worn rate." asOf={d?.asOf}
              actions={<ExportButton path="behaviour/recommendations" params={query} table="daily" />}>
              {!d ? <Skeleton className="h-64 w-full" /> : !d.shown ? <EmptyState title="No suggestions yet" body="Suggestions appear once people use Today." /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={d.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" {...axis} tickFormatter={fmtDay} minTickGap={32} />
                    <YAxis yAxisId="l" {...axis} width={44} />
                    <YAxis yAxisId="r" orientation="right" {...axis} width={40} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                    <Tooltip content={<ChartTip labelFormat={fmtDay} format={(v: number) => (v <= 1 && v > 0 && !Number.isInteger(v) ? fmtPct(v) : fmtN(v))} />} cursor={{ fill: 'rgb(var(--ink-700) / 0.4)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span style={{ color: CHART.text }}>{v}</span>} />
                    {OUTCOMES.map((o) => <Bar key={o.key} yAxisId="l" dataKey={o.key} name={o.label} stackId="o" fill={o.colour} maxBarSize={22} />)}
                    <Line yAxisId="r" type="monotone" dataKey="acceptance" name="Accepted or worn" stroke="rgb(var(--ink-100))" dot={false} strokeWidth={1.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Outcome mix" caption="All suggestions in the range.">
              {!d ? <Skeleton className="h-48 w-full" /> : (
                <ul className="space-y-3">
                  {OUTCOMES.map((o) => (
                    <li key={o.key}>
                      <div className="mb-1 flex justify-between text-sm"><span className="flex items-center gap-2 text-ink-100"><span className="h-2 w-2 rounded-full" style={{ background: o.colour }} aria-hidden="true" />{o.label}</span><span data-numeric className="text-ink-100">{fmtN(d.outcomes[o.key] || 0)} <span className="text-xs text-ink-400">{fmtPct(d.shown ? (d.outcomes[o.key] || 0) / d.shown : 0, 0)}</span></span></div>
                      <ShareBar pct={d.shown ? (d.outcomes[o.key] || 0) / d.shown : 0} colour={o.colour} label={o.label} />
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="By style persona" caption="Persona from the style profile, only for people who agreed to personalisation." actions={<ExportButton path="behaviour/recommendations" params={query} table="by_persona" />}>
              {!d ? <Skeleton className="h-48 w-full" /> : <Breakdown rows={d.byPersona} labelOf={(k) => (k === 'not_shared' ? 'Not shared (no consent)' : k === 'none' ? 'Not set' : humanise(k))} />}
            </ChartCard>
            <ChartCard title="By plan" caption="The plan people had on the day of the suggestion." actions={<ExportButton path="behaviour/recommendations" params={query} table="by_plan" />}>
              {!d ? <Skeleton className="h-48 w-full" /> : <Breakdown rows={d.byPlan} labelOf={(k) => k} />}
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}
