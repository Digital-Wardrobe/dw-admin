import { useEffect, useState } from 'react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { PageHeader, InlineError, EmptyState, Skeleton, StatTileSkeleton } from '../../components/ui';
import {
  DashControls, useDashParams, Kpi, ChartCard, ExportButton,
  th, td, fmtN, fmtInr, Grid, inputCls, primaryBtnCls, btnCls,
} from '../../components/dash';

/* Shopping clicks out to stores, and what they might earn. Clicks are measured; orders and
   commission are estimates from the rates below until store affiliate reports are connected. */

type Rates = { commissionPct?: number | string; conversionPct?: number | string; avgOrderInr?: number | string };
const FIELDS: { key: keyof Rates; label: string; suffix: string }[] = [
  { key: 'commissionPct', label: 'Commission', suffix: '%' },
  { key: 'conversionPct', label: 'Clicks that buy', suffix: '%' },
  { key: 'avgOrderInr', label: 'Average order', suffix: '₹' },
];

export default function Affiliate() {
  const { query, ready } = useDashParams();
  const { data: d, error, reload } = useAdminApi<any>('business/affiliate', { params: query, enabled: ready });
  const [draft, setDraft] = useState<{ default: Rates; stores: Record<string, Rates> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fromSettings = (x: any) => ({ default: { ...x.default }, stores: { ...(x.stores || {}) } });
  useEffect(() => { if (d && !draft) setDraft(fromSettings(d.settings)); }, [d, draft]);
  const t = d?.totals;
  // Every store we've seen clicks for, plus any with saved rates
  const storeNames = d ? [...new Set([...d.stores.map((s: any) => s.store), ...Object.keys(d.settings.stores || {})])] : [];

  const setRate = (store: string | null, key: keyof Rates, v: string) => setDraft((x) => {
    if (!x) return x;
    if (store == null) return { ...x, default: { ...x.default, [key]: v } };
    return { ...x, stores: { ...x.stores, [store]: { ...(x.stores[store] || {}), [key]: v } } };
  });
  const save = async () => {
    if (!draft) return;
    setBusy(true); setMsg(null);
    // Blank store fields mean "use the default"; drop them so the server stores only overrides
    const stores = Object.fromEntries(Object.entries(draft.stores).map(([s, r]) => [s, Object.fromEntries(Object.entries(r).filter(([, v]) => v !== '' && v != null))]).filter(([, r]) => Object.keys(r).length));
    try { const r = await adminSend<any>('PUT', 'business/affiliate', { default: draft.default, stores }); setDraft(fromSettings(r.settings)); setMsg({ ok: true, text: 'Saved. Estimates use the new rates.' }); reload(); } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Affiliate" subtitle="Shopping clicks out to stores, and what they could earn us." />
      <DashControls compare={false} />
      {error ? <InlineError message={error} onRetry={reload} /> : (
        <>
          <Grid cols={4}>
            {!t ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />) : <>
              <Kpi label="Shopping searches" value={fmtN(t.searches)} hint="gap fills, similar items and searches" />
              <Kpi label="Clicks to a store" source="measured" value={fmtN(t.storeClicks)} hint={`${fmtN(t.clickers)} people-days`} />
              <Kpi label="Complete-the-look clicks" value={fmtN(t.completeLookClicks)} hint="from the suggestion under an outfit" />
              <Kpi label="Estimated commission" source="estimated" value={fmtInr(t.estCommissionInr)} hint="clicks × rates below, until store reports are connected" />
            </>}
          </Grid>

          <div className="mt-4">
            <ChartCard title="Stores" source="estimated" asOf={d?.asOf} caption={d?.note || 'Clicks are measured; orders and commission are estimated.'}
              actions={<ExportButton path="business/affiliate" params={query} table="stores" />}>
              {!d ? <Skeleton className="h-48 w-full" /> : !d.stores.length ? <EmptyState title="No store clicks in this range" body="Clicks appear when people open a product from shopping, complete the look or a gap fill." /> : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><th className={th}>Store</th><th className={`${th} text-right`}>Clicks</th><th className={`${th} text-right`}>Est. orders</th><th className={`${th} text-right`}>Est. sales</th><th className={`${th} text-right`}>Est. commission</th><th className={`${th} text-right`}>Rates used</th></tr></thead>
                    <tbody>
                      {d.stores.map((s: any) => (
                        <tr key={s.store} className="border-t border-ink-700">
                          <td className={`${td} font-medium`}>{s.store}</td>
                          <td className={`${td} text-right`} data-numeric>{fmtN(s.clicks)}</td>
                          <td className={`${td} text-right text-ink-300`} data-numeric>{fmtN(s.estOrders, 1)}</td>
                          <td className={`${td} text-right text-ink-300`} data-numeric>{fmtInr(s.estGmvInr)}</td>
                          <td className={`${td} text-right`} data-numeric>{fmtInr(s.estCommissionInr)}</td>
                          <td className={`${td} text-right text-xs text-ink-400`} data-numeric>{s.rates.commissionPct}% · {s.rates.conversionPct}% · {fmtInr(s.rates.avgOrderInr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </div>

          <div className="mt-4">
            <ChartCard title="Estimate rates" caption="Commission each store pays, how many clicks turn into an order, and the average order. A blank store field uses the default."
              actions={d?.canEdit && draft ? <span className="flex items-center gap-2">{msg && <span className={`text-label ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</span>}<button className={btnCls} disabled={busy} onClick={() => { setDraft(fromSettings(d.settings)); setMsg(null); }}>Reset</button><button className={primaryBtnCls} disabled={busy} onClick={save}>Save rates</button></span> : undefined}>
              {!d || !draft ? <Skeleton className="h-32 w-full" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><th className={th}>Applies to</th>{FIELDS.map((f) => <th key={f.key} className={`${th} text-right`}>{f.label} ({f.suffix})</th>)}</tr></thead>
                    <tbody>
                      {[null, ...storeNames].map((store) => {
                        const r = store == null ? draft.default : draft.stores[store] || {};
                        return (
                          <tr key={store ?? '_default'} className="border-t border-ink-700">
                            <td className={`${td} ${store == null ? 'font-medium' : ''}`}>{store ?? 'Default (every store)'}</td>
                            {FIELDS.map((f) => (
                              <td key={f.key} className={`${td} text-right`}>
                                {d.canEdit ? (
                                  <input type="number" min={0} step="any" aria-label={`${store ?? 'Default'} ${f.label}`} className={`${inputCls} w-24 text-right`}
                                    placeholder={store == null ? '' : String(draft.default[f.key] ?? '')} value={r[f.key] ?? ''} onChange={(e) => setRate(store, f.key, e.target.value)} />
                                ) : <span data-numeric className={r[f.key] == null ? 'text-ink-400' : ''}>{r[f.key] ?? (store == null ? '–' : 'default')}</span>}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!d.canEdit && <p className="mt-2 text-label text-ink-400">Your role can view the rates; a SUPERADMIN or ADMIN changes them.</p>}
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}
