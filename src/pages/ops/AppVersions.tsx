import { useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { PageHeader, InlineError, Skeleton, EmptyState } from '../../components/ui';
import { ChartCard, ChartTip, axis, th, td, fmtN, fmtPct, fmtDay } from '../../components/dash';
import { CHART, colourFor } from '../../chartColors';

/* Which app versions people use, and the update rules: below the minimum the app shows a
   full-screen "update to continue"; below the latest it can suggest an update. */

/** -1 / 0 / 1 for dotted versions ("1.0.10" is after "1.0.9") */
const cmpV = (a: string, b: string) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 4; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; } return 0; };
const input = 'h-8 w-28 rounded-inner border border-ink-600 bg-ink-800 px-2 text-sm text-ink-100';

export default function AppVersions() {
  const { data, error, reload } = useAdminApi<any>('app/versions');
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (data && !form) setForm({ minVersion: {}, latestVersion: {}, storeUrl: {}, message: '', ...data.settings }); }, [data, form]);
  const versions: string[] = data?.versions || [];

  return (
    <>
      <PageHeader title="App versions" subtitle="Who is on which version (people active each day), and the update rules the app gets from GET /api/app/config." />
      {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-80 w-full" /> : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard className="xl:col-span-2" title="Version adoption" caption="People active each day, by the app version they used (last 30 days)." asOf={data.asOf} source="measured">
            {!versions.length ? <EmptyState title="No version data yet" body="Versions are recorded from session_start as people open the updated app." /> : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data.days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" {...axis} tickFormatter={fmtDay} minTickGap={24} />
                  <YAxis {...axis} width={40} />
                  <Tooltip content={<ChartTip labelFormat={fmtDay} />} />
                  {versions.map((v) => <Area key={v} type="monotone" dataKey={v} name={v} stackId="1" stroke={colourFor(v, versions)} fill={colourFor(v, versions)} fillOpacity={0.35} />)}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
          <ChartCard title="Today" caption="Share of people active today, by version.">
            <table className="w-full"><thead><tr><th className={th}>Version</th><th className={`${th} text-right`}>People</th><th className={`${th} text-right`}>Share</th></tr></thead>
              <tbody>{data.today.map((v: any) => <tr key={v.version} className="border-t border-ink-700"><td className={td}>{v.version}{data.settings?.minVersion?.android && v.version !== 'unknown' && cmpV(v.version, data.settings.minVersion.android) < 0 ? <span className="ml-1 text-label text-warn">below min</span> : null}</td><td className={`${td} text-right`}>{fmtN(v.users)}</td><td className={`${td} text-right`}>{fmtPct(v.share, 0)}</td></tr>)}</tbody></table>
          </ChartCard>
          {form && (
            <ChartCard className="xl:col-span-3" title="Update rules" caption="Below the minimum: the app blocks with “update to continue”. Below the latest: it can offer an update. Leave empty for no rule." >
              <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setMsg(null); try { await adminSend('PUT', 'app/versions', form); setMsg('Saved. The app picks it up within a minute.'); reload(); } catch (x: any) { setMsg(x.message); } }}>
                <table className="w-full max-w-3xl">
                  <thead><tr><th className={th} /><th className={th}>Minimum (forced)</th><th className={th}>Latest</th><th className={th}>Store link</th></tr></thead>
                  <tbody>{['android', 'ios'].map((pf) => (
                    <tr key={pf} className="border-t border-ink-700">
                      <td className={td}>{pf === 'ios' ? 'iOS' : 'Android'}</td>
                      <td className={td}><input disabled={!data.canEdit} className={input} placeholder="1.0.3" value={form.minVersion?.[pf] || ''} onChange={(e) => setForm({ ...form, minVersion: { ...form.minVersion, [pf]: e.target.value } })} /></td>
                      <td className={td}><input disabled={!data.canEdit} className={input} placeholder="1.0.4" value={form.latestVersion?.[pf] || ''} onChange={(e) => setForm({ ...form, latestVersion: { ...form.latestVersion, [pf]: e.target.value } })} /></td>
                      <td className={td}><input disabled={!data.canEdit} className={`${input} w-80`} placeholder={pf === 'ios' ? 'https://apps.apple.com/…' : 'https://play.google.com/store/apps/details?id=…'} value={form.storeUrl?.[pf] || ''} onChange={(e) => setForm({ ...form, storeUrl: { ...form.storeUrl, [pf]: e.target.value } })} /></td>
                    </tr>
                  ))}</tbody>
                </table>
                <label className="block max-w-3xl text-xs text-ink-300">Message on the update screen (optional)<input disabled={!data.canEdit} maxLength={200} className={`${input} mt-1 w-full`} value={form.message || ''} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
                {data.canEdit && <button className="h-8 rounded-inner bg-brand px-3 text-xs font-medium text-ink-950">Save rules</button>}
                {msg && <span className="ml-3 text-xs text-ink-300" role="status">{msg}</span>}
              </form>
            </ChartCard>
          )}
        </div>
      )}
    </>
  );
}
