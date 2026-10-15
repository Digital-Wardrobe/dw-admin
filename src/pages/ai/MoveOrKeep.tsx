import { useState } from 'react';
import { useAdminApi } from '../../lib/useAdminApi';
import { PageHeader, Badge, InlineError, EmptyState, Skeleton } from '../../components/ui';
import { DashControls, useDashParams, ChartCard, ExportButton, th, td, fmtUsd, fmtN, fmtPct, useDebounced } from '../../components/dash';

/* Move or keep: for each feature, what it costs a month on every route it could run on at the
   volume we see now, where a fixed-cost route (an always-on GPU) starts to pay off, and how good
   each route is. The what-if asks the server again with a volume and cold-start rate you choose. */

const FEATURE_LABEL: Record<string, string> = {
  beautify: 'Beautify', tryon: 'Try-on', smart_scan: 'Smart scan (tags)', kween: 'Kween chat', fitcheck: 'Fit check',
};

function FeatureCard({ f, range, asOf }: { f: any; range: Record<string, string>; asOf?: string | null }) {
  const [vol, setVol] = useState<string>('');
  const [cold, setCold] = useState<string>('');
  const dv = useDebounced(vol), dc = useDebounced(cold);
  const whatIf = dv !== '' || dc !== '';
  const params: Record<string, string> = { ...range, feature: f.feature };
  if (dv !== '') params.volume = dv;
  if (dc !== '') params.coldRate = String(Number(dc) / 100);
  const live = useAdminApi<any>('ai/move-or-keep', { params, enabled: whatIf });
  const data = whatIf && live.data ? live.data.features[0] : f;
  const usesModal = f.routes.some((r: any) => /modal-gpu/.test(r.model || ''));
  const cur = data.routes.find((r: any) => r.current);
  const best = data.routes.find((r: any) => r.cheapest);

  return (
    <ChartCard
      title={FEATURE_LABEL[f.feature] || f.feature}
      caption={`${fmtN(f.measuredMonthlyVolume)} uses a month at the current pace${usesModal ? `, ${fmtPct(f.measuredColdRate, 0)} of them cold starts` : ''}.`}
      source="estimated" asOf={asOf}
      actions={<ExportButton path="ai/move-or-keep" params={params} table="routes" />}
    >
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-inner border border-ink-700 bg-ink-850 p-3">
        <label className="text-xs text-ink-300">
          <span className="mb-1 block text-label uppercase text-ink-400">What if: uses a month</span>
          <input type="number" min={0} step={100} inputMode="numeric" placeholder={String(Math.round(f.measuredMonthlyVolume))} value={vol} onChange={(e) => setVol(e.target.value)}
            className="h-8 w-36 rounded-inner border border-ink-600 bg-ink-800 px-2 text-sm text-ink-100" />
        </label>
        {usesModal && (
          <label className="text-xs text-ink-300">
            <span className="mb-1 block text-label uppercase text-ink-400">Cold starts (%)</span>
            <input type="number" min={0} max={100} step={1} placeholder={String(Math.round(f.measuredColdRate * 100))} value={cold} onChange={(e) => setCold(e.target.value)}
              className="h-8 w-24 rounded-inner border border-ink-600 bg-ink-800 px-2 text-sm text-ink-100" />
          </label>
        )}
        {whatIf && <button onClick={() => { setVol(''); setCold(''); }} className="h-8 rounded-inner px-2 text-xs text-ink-300 hover:text-brand">Back to measured</button>}
        {live.error && <span className="text-xs text-bad">{live.error}</span>}
        <p className="basis-full text-xs text-ink-400">
          {cur && best && cur.id !== best.id
            ? <>At {fmtN(data.monthlyVolume)} uses, <b className="text-ink-100">{best.label}</b> would save {fmtUsd(cur.monthly - best.monthly)} a month over {cur.label}.</>
            : cur ? <>At {fmtN(data.monthlyVolume)} uses, the current route ({cur.label}) is the cheapest.</> : <>No calls yet, so there is no current route.</>}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Route</th>
              <th className={`${th} text-right`}>Per use</th>
              <th className={`${th} text-right`}>Fixed / month</th>
              <th className={`${th} text-right`}>Monthly at this volume</th>
              <th className={`${th} text-right`} title="Uses a month at which this route costs the same as the current one">Break-even</th>
              <th className={`${th} text-right`}>Quality</th>
            </tr>
          </thead>
          <tbody>
            {data.routes.map((r: any) => (
              <tr key={r.id} className="border-t border-ink-700">
                <td className={td}>
                  <span className="text-ink-100">{r.label}</span>{' '}
                  {r.current && <Badge tone="brand">current</Badge>}{' '}
                  {r.cheapest && <Badge tone="ok">cheapest</Badge>}
                </td>
                <td className={`${td} text-right`} data-numeric>{fmtUsd(r.unit, r.unit < 0.01 ? 4 : 3)}</td>
                <td className={`${td} text-right`} data-numeric>{r.fixed ? fmtUsd(r.fixed, 0) : '–'}</td>
                <td className={`${td} text-right`} data-numeric>{fmtUsd(r.monthly)}</td>
                <td className={`${td} text-right`} data-numeric>{r.breakEvenVsCurrent ? `${fmtN(r.breakEvenVsCurrent)} uses` : '–'}</td>
                <td className={`${td} text-right`}>{r.quality ? <span title={r.quality.metric}>{fmtPct(r.quality.value)} <span className="text-label text-ink-400">{r.quality.metric}</span></span> : <span className="text-ink-400">no data</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {whatIf && live.loading && <p className="mt-2 text-label text-ink-400">Recalculating…</p>}
    </ChartCard>
  );
}

export default function MoveOrKeep() {
  const { query, ready } = useDashParams({ range: '30d' });
  const { data, loading, error, reload } = useAdminApi<any>('ai/move-or-keep', { params: query, enabled: ready });
  const range = { range: query.range, ...(query.from && { from: query.from, to: query.to }) };
  return (
    <>
      <PageHeader
        title="Move or keep"
        subtitle="What each AI feature would cost a month on every route it could run on, at the volume we see now, and the volume at which switching pays off. Routes and prices come from the price table; quality is tag corrections for tagging and retries for Beautify."
      />
      <DashControls compare={false} note="The range sets the volume (uses a month) and the measured cold-start rate. Change either in the what-if." />
      {error ? <InlineError message={error} onRetry={reload} /> : loading || !data ? (
        <div className="space-y-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56 w-full" />)}</div>
      ) : !data.features.length ? (
        <EmptyState title="No routes defined" body="Add routes for a feature in the price table (routes.<feature>) to compare them here." />
      ) : (
        <div className="space-y-4">{data.features.map((f: any) => <FeatureCard key={f.feature} f={f} range={range} asOf={data.asOf} />)}</div>
      )}
    </>
  );
}
