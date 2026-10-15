import { useAdminApi } from '../../lib/useAdminApi';
import { PageHeader, InlineError, EmptyState, Skeleton, StatTileSkeleton } from '../../components/ui';
import {
  DashControls, useDashParams, useHashScroll, Kpi, ChartCard, ExportButton, ShareBar, FunnelBars,
  th, td, fmtN, fmtInr, fmtPct, Grid,
} from '../../components/dash';

/* From hitting a plan limit to paying, where people drop out, which limits push them there,
   and, per plan, what a paying person brings in against what they cost us. */

const FEATURE: Record<string, string> = { beautify: 'Beautify', beautifyPro: 'Beautify Pro', fitcheck: 'Fit check', tryon: 'Try-on', kween: 'Ask Kween', scan: 'Scan outfit', items: 'Closet size', direct: 'Opened Plans directly' };
const nice = (k: string) => {
  if (k.startsWith('limit:')) return `After the ${(FEATURE[k.slice(6)] || k.slice(6)).toLowerCase()} limit`;
  return FEATURE[k] || k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
};

function CountList({ rows, empty }: { rows: { key: string; count: number }[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-ink-400">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm"><span className="truncate text-ink-100">{nice(r.key)}</span><span data-numeric className="text-ink-100">{fmtN(r.count)}</span></div>
          <ShareBar pct={max ? r.count / max : 0} label={r.key} />
        </li>
      ))}
    </ul>
  );
}

export default function Monetisation() {
  const { query, ready } = useDashParams();
  const m = useAdminApi<any>('business/monetisation', { params: query, enabled: ready });
  const ue = useAdminApi<any>('business/unit-economics', { params: query, enabled: ready });
  useHashScroll(!!m.data && !!ue.data);
  const d = m.data;
  const step = (t: string) => d?.steps.find((s: any) => s.type === t)?.people || 0;
  const first = d?.steps[0]?.people || 0;

  return (
    <>
      <PageHeader title="Monetisation" subtitle="From hitting a plan limit to paying, and what each plan earns against what it costs us." />
      <DashControls compare={false} note="People are counted once a day and summed over the range, so someone who hits a limit on three days counts three times." />
      {m.error ? <InlineError message={m.error} onRetry={m.reload} /> : (
        <>
          <Grid cols={4}>
            {!d ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
              <Kpi label="Hit a plan limit" value={fmtN(step('limit_hit'))} hint="people-days on which a limit said no" />
              <Kpi label="Tapped Upgrade on the prompt" value={fmtPct(d.promptUpgradeRate)} hint="of people who answered the upgrade prompt (the rest chose Later)" />
              <Kpi label="Plans page → paid" value={fmtPct(step('paywall_view') ? step('purchase_success') / step('paywall_view') : null)} hint={`${fmtN(step('purchase_success'))} paid of ${fmtN(step('paywall_view'))} who opened Plans`} />
              <Kpi label="Payments completed" value={fmtPct(step('purchase_start') ? step('purchase_success') / step('purchase_start') : null)} hint={`of ${fmtN(step('purchase_start'))} started; below 70% means checkout is failing`} />
            </>}
          </Grid>

          <div className="mt-4">
            <ChartCard title="Upgrade flow" caption="Each step as a share of the first, with the share that went on from the step before." asOf={d?.asOf}
              actions={<ExportButton path="business/monetisation" params={query} table="flow" />}>
              {!d ? <Skeleton className="h-64 w-full" /> : !first && !step('paywall_view') ? <EmptyState title="Nothing yet" body="The flow fills in when people hit a limit or open the Plans page." /> : (
                <FunnelBars steps={d.steps.map((s: any) => ({ key: s.type, label: s.label, people: s.people, fromPrevious: s.fromPrevious }))} />
              )}
            </ChartCard>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard title="Limits people hit" caption="Which plan limit said no (people-days)." actions={<ExportButton path="business/monetisation" params={query} table="limits" />}>
              {!d ? <Skeleton className="h-40 w-full" /> : <CountList rows={d.limitsByFeature} empty="No one hit a limit in this range." />}
            </ChartCard>
            <ChartCard title="How people reach Plans" caption="What opened the Plans page (people-days)." actions={<ExportButton path="business/monetisation" params={query} table="paywall_sources" />}>
              {!d ? <Skeleton className="h-40 w-full" /> : <CountList rows={d.paywallBySource} empty="No one opened Plans in this range." />}
            </ChartCard>
            <ChartCard title="Failed payments" caption="Why a started purchase didn’t finish (store reason codes)." actions={<ExportButton path="business/monetisation" params={query} table="failures" />}>
              {!d ? <Skeleton className="h-40 w-full" /> : <CountList rows={d.purchaseFailures} empty="No failed payments in this range." />}
            </ChartCard>
          </div>

          <div id="unit-economics" className="mt-4 scroll-mt-32 lg:scroll-mt-8">
            <ChartCard title="Unit economics" source="estimated" asOf={ue.data?.asOf}
              caption="Per plan, a month: net revenue per paying person against AI and infrastructure cost per active person. AI cost is our usage × the price table."
              actions={<ExportButton path="business/unit-economics" params={query} table="plans" />}>
              {ue.error ? <InlineError message={ue.error} onRetry={ue.reload} /> : !ue.data ? <Skeleton className="h-40 w-full" /> : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className={th}>Plan</th><th className={`${th} text-right`}>List price</th><th className={`${th} text-right`} title="After 18% GST and the store fee">Net of list</th>
                          <th className={`${th} text-right`}>Paying (avg)</th><th className={`${th} text-right`}>Active</th><th className={`${th} text-right`}>Net revenue / payer</th>
                          <th className={`${th} text-right`}>AI / person</th><th className={`${th} text-right`}>Infra / person</th><th className={`${th} text-right`}>Margin / payer</th><th className={`${th} text-right`}>Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ue.data.plans.map((p: any) => (
                          <tr key={p.plan} className="border-t border-ink-700">
                            <td className={`${td} font-medium`}>{p.plan}</td>
                            <td className={`${td} text-right`} data-numeric>{p.plan === 'FREE' ? '–' : fmtInr(p.listPriceMonthlyInr)}</td>
                            <td className={`${td} text-right text-ink-300`} data-numeric>{p.plan === 'FREE' ? '–' : fmtInr(p.netOfListInr)}</td>
                            <td className={`${td} text-right`} data-numeric>{p.plan === 'FREE' ? '–' : fmtN(p.avgPayers, 1)}</td>
                            <td className={`${td} text-right`} data-numeric>{fmtN(p.activeUsers)}</td>
                            <td className={`${td} text-right`} data-numeric>{p.plan === 'FREE' ? '–' : fmtInr(p.netRevenuePerPayerInr)}</td>
                            <td className={`${td} text-right`} data-numeric>{fmtInr(p.aiCostPerUserInr)}</td>
                            <td className={`${td} text-right`} data-numeric>{p.infraPerUserInr != null ? fmtInr(p.infraPerUserInr) : <span className="text-ink-400">–</span>}</td>
                            <td className={`${td} text-right ${p.marginPerPayerInr != null && p.marginPerPayerInr < 0 && p.plan !== 'FREE' ? 'text-bad' : ''}`} data-numeric>{p.plan === 'FREE' ? <span className="text-ink-400" title="Free people cost this each a month">−{fmtInr(p.costPerUserInr)}</span> : fmtInr(p.marginPerPayerInr)}</td>
                            <td className={`${td} text-right`} data-numeric>{fmtPct(p.marginPct, 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-label text-ink-400">
                    {ue.data.infraNote || `Includes ${fmtInr(ue.data.infraInr)} of infrastructure entered for these months, spread over every active person.`} Revenue is from store and gateway payments only.
                  </p>
                </>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}
