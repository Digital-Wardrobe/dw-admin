import { ResponsiveContainer, ComposedChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useAdminApi } from '../../lib/useAdminApi';
import { humanise } from '../../lib/names';
import { PageHeader, InlineError, Skeleton, StatTileSkeleton } from '../../components/ui';
import { DashControls, useDashParams, Kpi, ChartCard, ExportButton, ChartTip, ShareBar, axis, fmtN, fmtPct, fmtDay, deltaOf, Grid } from '../../components/dash';
import { CHART } from '../../chartColors';

/* Posting and social activity, and what closets look like in aggregate: categories, colours,
   closet sizes and how much of what people own gets worn. Counts only; no photos, nobody singled out. */

const SWATCH: Record<string, string> = {
  black: '#111', white: '#f5f5f5', navy: '#1f2a52', blue: '#2f6fd6', beige: '#d9c7a3', grey: '#8a8a8a', gray: '#8a8a8a', red: '#c62f2f', green: '#2f8f4e',
  pink: '#e48aa8', maroon: '#6d1f2a', mustard: '#d4a017', olive: '#6b7032', brown: '#7a5134', yellow: '#e9cc35', orange: '#e47b2b', purple: '#7b4fb0', cream: '#efe6cf', gold: '#c9a227', silver: '#b8bcc2', 'light blue': '#8ec5ea', 'dark blue': '#1b3b8a', khaki: '#b9a77a', tan: '#c8a27a', peach: '#f4b896', lavender: '#b9a6dc', teal: '#2a8c8c', rust: '#a84a2a', wine: '#5c1a2b', multicolour: 'conic-gradient(#e33,#ec3,#3c6,#36e,#e33)',
};

function CountList({ rows, total, swatch = false, labelOf = humanise }: { rows: { key: string; count: number }[]; total: number; swatch?: boolean; labelOf?: (k: string) => string }) {
  if (!rows.length) return <p className="text-sm text-ink-400">Nothing yet.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 truncate text-ink-100">
              {swatch && <span className="h-3 w-3 shrink-0 rounded-full border border-ink-600" style={{ background: SWATCH[r.key] || 'transparent' }} aria-hidden="true" />}
              {labelOf(r.key)}
            </span>
            <span data-numeric className="shrink-0 text-ink-100">{fmtN(r.count)} <span className="text-xs text-ink-400">{fmtPct(total ? r.count / total : 0, 0)}</span></span>
          </div>
          <ShareBar pct={total ? r.count / total : 0} colour={swatch && SWATCH[r.key] ? SWATCH[r.key] : undefined} label={r.key} />
        </li>
      ))}
    </ul>
  );
}

export default function ContentWardrobe() {
  const { query, compare, ready } = useDashParams();
  const c = useAdminApi<any>('behaviour/content', { params: query, enabled: ready });
  const w = useAdminApi<any>('behaviour/wardrobe', { params: { range: query.range, ...(query.from && { from: query.from, to: query.to }) }, enabled: ready });
  const t = c.data?.totals;
  const prevHint = (x: any) => (compare && x?.prev != null ? `${fmtN(x.prev)} the period before` : undefined);
  const catTotal = w.data?.categories.reduce((a: number, r: any) => a + r.count, 0) || 0;
  const colTotal = w.data?.colours.reduce((a: number, r: any) => a + r.count, 0) || 0;
  const sizeTotal = w.data?.closetSizes.reduce((a: number, r: any) => a + r.users, 0) || 0;

  return (
    <>
      <PageHeader title="Content & wardrobe" subtitle="Posting and social activity, and what closets look like across everyone." />
      <DashControls />
      <h2 className="mb-2 text-label uppercase text-ink-400">Content and social</h2>
      {c.error ? <InlineError message={c.error} onRetry={c.reload} /> : (
        <>
          <Grid cols={4}>
            {!t ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
              <Kpi label="Posts" value={fmtN(t.posts.now)} delta={deltaOf(t.posts.now, t.posts.prev)} spark={c.data.daily.map((x: any) => x.posts)} hint={prevHint(t.posts) || `${c.data.perHundredActive.posts?.toFixed(1) ?? '–'} per 100 active people a day`} />
              <Kpi label="Likes" value={fmtN(t.likes.now)} delta={deltaOf(t.likes.now, t.likes.prev)} spark={c.data.daily.map((x: any) => x.likes)} hint={`${fmtPct(c.data.engagedShare.like)} of active people like something on a day`} />
              <Kpi label="Comments" value={fmtN(t.comments.now)} delta={deltaOf(t.comments.now, t.comments.prev)} spark={c.data.daily.map((x: any) => x.comments)} hint={`${fmtN(t.saves.now)} saves · ${fmtN(t.sharesOut.now)} shared outside Fluntr`} />
              <Kpi label="Follows" value={fmtN(t.follows.now)} delta={deltaOf(t.follows.now, t.follows.prev)} spark={c.data.daily.map((x: any) => x.follows)} hint={prevHint(t.follows) || 'new follows in the range'} />
            </>}
          </Grid>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard className="xl:col-span-2" title="Social activity each day" caption="Posts (bars, left axis); follows, likes, comments and saves (lines, right axis)." asOf={c.data?.asOf}
              actions={<ExportButton path="behaviour/content" params={query} table="daily" />}>
              {!c.data ? <Skeleton className="h-64 w-full" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={c.data.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" {...axis} tickFormatter={fmtDay} minTickGap={32} />
                    <YAxis yAxisId="l" {...axis} width={36} />
                    <YAxis yAxisId="r" orientation="right" {...axis} width={44} />
                    <Tooltip content={<ChartTip labelFormat={fmtDay} />} cursor={{ fill: 'rgb(var(--ink-700) / 0.4)' }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: CHART.text }} />
                    <Bar yAxisId="l" dataKey="posts" name="Posts" fill={CHART.brand} maxBarSize={14} />
                    <Line yAxisId="r" type="monotone" dataKey="follows" name="Follows" stroke="rgb(var(--c6))" dot={false} strokeWidth={1.5} />
                    <Line yAxisId="r" type="monotone" dataKey="likes" name="Likes" stroke="rgb(var(--c3))" dot={false} strokeWidth={1.5} />
                    <Line yAxisId="r" type="monotone" dataKey="comments" name="Comments" stroke="rgb(var(--c2))" dot={false} strokeWidth={1.5} />
                    <Line yAxisId="r" type="monotone" dataKey="saves" name="Saves" stroke="rgb(var(--c5))" dot={false} strokeWidth={1.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Shared outside Fluntr" caption="What people shared through the share sheet." actions={<ExportButton path="behaviour/content" params={query} table="shares" />}>
              {!c.data ? <Skeleton className="h-40 w-full" /> : <CountList rows={c.data.sharesByWhat} total={t.sharesOut.now} labelOf={(k) => ({ closetItem: 'Closet item', post: 'Post', profile: 'Profile', collection: 'Collection', vibe: 'Vibe' } as Record<string, string>)[k] || humanise(k)} />}
            </ChartCard>
          </div>
        </>
      )}

      <h2 className="mb-2 mt-8 text-label uppercase text-ink-400">Wardrobe patterns</h2>
      {w.error ? <InlineError message={w.error} onRetry={w.reload} /> : (
        <>
          <Grid cols={4}>
            {!w.data ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
              <Kpi label="Items in closets" value={fmtN(w.data.liveItems)} spark={w.data.daily.map((x: any) => x.liveItems || 0)} hint={w.data.snapshotDay ? `counted ${fmtDay(w.data.snapshotDay)}` : 'counted nightly'} />
              <Kpi label="Worn in the last 30 days" value={fmtPct(w.data.utilisation)} spark={w.data.daily.map((x: any) => x.utilisation || 0)} hint={`${fmtN(w.data.worn30d)} items in a logged outfit`} />
              <Kpi label="Items added" value={fmtN(w.data.added.items)} spark={w.data.daily.map((x: any) => x.added)} hint={`${fmtN(w.data.added.scans)} outfit scans in the range`} />
              <Kpi label="Closet exports" value={fmtN(w.data.added.exports)} hint="people downloading their closet" />
            </>}
          </Grid>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard title="Categories" caption="Top 15 across every closet." asOf={w.data?.asOf} actions={<ExportButton path="behaviour/wardrobe" params={{ range: query.range, from: query.from, to: query.to }} table="categories" />}>
              {!w.data ? <Skeleton className="h-64 w-full" /> : <CountList rows={w.data.categories} total={catTotal} labelOf={(k) => (k === 'none' ? 'No category' : k)} />}
            </ChartCard>
            <ChartCard title="Colours" caption="Top 20 colours across every closet." actions={<ExportButton path="behaviour/wardrobe" params={{ range: query.range, from: query.from, to: query.to }} table="colours" />}>
              {!w.data ? <Skeleton className="h-64 w-full" /> : <CountList rows={w.data.colours} total={colTotal} swatch />}
            </ChartCard>
            <div className="flex flex-col gap-4">
              <ChartCard title="Closet sizes" caption="People by how many items they have." actions={<ExportButton path="behaviour/wardrobe" params={{ range: query.range, from: query.from, to: query.to }} table="closet_sizes" />}>
                {!w.data ? <Skeleton className="h-32 w-full" /> : <CountList rows={w.data.closetSizes.map((s: any) => ({ key: s.key, count: s.users }))} total={sizeTotal} labelOf={(k) => `${k} items`} />}
              </ChartCard>
              <ChartCard title="Share of items worn" caption="Items in a logged outfit in the 30 days to each day.">
                {!w.data ? <Skeleton className="h-32 w-full" /> : (
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={w.data.daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <XAxis dataKey="date" {...axis} tickFormatter={fmtDay} minTickGap={40} />
                      <YAxis {...axis} width={36} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                      <Tooltip content={<ChartTip labelFormat={fmtDay} format={(v: number) => fmtPct(v)} />} />
                      <Line type="monotone" dataKey="utilisation" name="Worn" stroke={CHART.brand} dot={false} strokeWidth={1.5} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </div>
          {w.data && <p className="mt-3 text-label text-ink-400">{w.data.note}</p>}
        </>
      )}
    </>
  );
}
