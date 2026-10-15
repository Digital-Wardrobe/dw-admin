import { useAdminApi } from '../lib/useAdminApi';
import { PageHeader, Card, Badge, InlineError, Skeleton } from '../components/ui';
import { ChartCard, th, td, fmtN, fmtMs, Grid, Kpi } from '../components/dash';

/* Is everything running? The API instance answering this page, the database, file storage,
   the GPU, the background workers and the job queue. Live numbers, refreshed on reload. */

const mb = (b: number | null | undefined) => (b == null ? '–' : b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(0)} MB`);
const ago = (m: number | null) => (m == null ? 'never' : m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`);
const uptime = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`);
const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'neutral'> = { ok: 'ok', stale: 'bad', failing: 'warn', never: 'neutral' };

export default function Infrastructure() {
  const { data, error, loading, reload } = useAdminApi<any>('infra/health');
  return (
    <>
      <PageHeader title="Infrastructure" subtitle="The API instance answering this page, the database, storage, the GPU, background workers and the job queue." actions={<button onClick={reload} className="rounded-inner border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-100 hover:border-brand-line hover:text-brand">Refresh</button>} />
      {error ? <InlineError message={error} onRetry={reload} /> : loading || !data ? <Skeleton className="h-96 w-full" /> : (
        <>
          <Grid cols={4}>
            <Kpi label="API instances" value={fmtN(Math.max(1, data.api.instancesSeen.length))} hint={`this one: ${data.api.instance} · up ${uptime(data.api.uptimeSec)}`} />
            <Kpi label="Database" value={mb(data.database.sizeBytes)} hint={`${fmtN(Object.values(data.database.connections).reduce((a: number, b: any) => a + b, 0))} of ${fmtN(data.database.maxConnections)} connections · cache hit ${data.database.cacheHitPct ?? '–'}%`} />
            <Kpi label="Storage" value={mb(data.storage.bytes)} hint={data.storage.objects != null ? `${fmtN(data.storage.objects)} files on ${data.storage.provider} (${data.storage.bucket}), counted nightly` : `${data.storage.provider} (${data.storage.bucket}); counted nightly`} />
            <Kpi label="Jobs waiting" value={fmtN(data.queue.last24h.QUEUED || 0)} hint={data.queue.oldestQueuedMinutes != null ? `oldest ${data.queue.oldestQueuedMinutes} min` : 'none waiting'} />
          </Grid>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Background workers" caption="Last time each loop ran. Stale = it should have run by now.">
              <table className="w-full">
                <thead><tr><th className={th}>Worker</th><th className={th}>State</th><th className={th}>Last ran</th><th className={th}>Instance</th></tr></thead>
                <tbody>
                  {data.workers.map((w: any) => (
                    <tr key={w.name} className="border-t border-ink-700 align-top">
                      <td className={td}>{w.name}</td>
                      <td className={td}><Badge tone={TONE[w.status]}>{w.status}</Badge></td>
                      <td className={`${td} text-ink-300`}>{ago(w.minutesAgo)}{w.lastError && <span className="block max-w-xs truncate text-label text-bad" title={w.lastError}>{w.lastError}</span>}</td>
                      <td className={`${td} text-xs text-ink-400`}>{String(w.instance || '–').split(':')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ChartCard>
            <ChartCard title="This API instance" caption="Node process and machine.">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-label uppercase text-ink-400">Environment</dt><dd className="text-ink-100">{data.api.environment}</dd></div>
                <div><dt className="text-label uppercase text-ink-400">Node</dt><dd className="text-ink-100">{data.api.node}</dd></div>
                <div><dt className="text-label uppercase text-ink-400">Memory (process)</dt><dd className="text-ink-100">{data.api.memoryMb.rss} MB · heap {data.api.memoryMb.heapUsed}/{data.api.memoryMb.heapTotal} MB</dd></div>
                <div><dt className="text-label uppercase text-ink-400">Machine</dt><dd className="text-ink-100">{data.api.cpus} CPU · {fmtN(data.api.freeMemMb)} of {fmtN(data.api.totalMemMb)} MB free</dd></div>
                <div><dt className="text-label uppercase text-ink-400">Load (1/5/15 min)</dt><dd className={data.api.load[0] > data.api.cpus ? 'text-warn' : 'text-ink-100'}>{data.api.load.join(' / ')}</dd></div>
                <div><dt className="text-label uppercase text-ink-400">Shared rate limits</dt><dd className="text-ink-100">{data.api.redis ? 'Redis' : 'per instance (no Redis)'}</dd></div>
              </dl>
            </ChartCard>
            <ChartCard title="GPU (Modal)" caption="Beautify and try-on calls in the last 24 hours.">
              {!data.modal.configured ? <p className="text-sm text-ink-400">Not set up on this server.</p> : (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-label uppercase text-ink-400">Calls</dt><dd className="text-ink-100">{fmtN(data.modal.calls24h)}</dd></div>
                  <div><dt className="text-label uppercase text-ink-400">Failed</dt><dd className={data.modal.errors24h ? 'text-warn' : 'text-ink-100'}>{fmtN(data.modal.errors24h)}</dd></div>
                  <div><dt className="text-label uppercase text-ink-400">Cold starts</dt><dd className="text-ink-100">{fmtN(data.modal.coldStarts24h)}</dd></div>
                  <div><dt className="text-label uppercase text-ink-400">p95</dt><dd className="text-ink-100">{fmtMs(data.modal.p95Ms)}</dd></div>
                </dl>
              )}
            </ChartCard>
            <ChartCard title="Largest tables" caption="Database size including indexes.">
              <table className="w-full">
                <thead><tr><th className={th}>Table</th><th className={`${th} text-right`}>Rows</th><th className={`${th} text-right`}>Size</th></tr></thead>
                <tbody>{data.database.tables.map((t: any) => <tr key={t.table} className="border-t border-ink-700"><td className={td}>{t.table}</td><td className={`${td} text-right`} data-numeric>{fmtN(t.rows)}</td><td className={`${td} text-right`} data-numeric>{mb(t.bytes)}</td></tr>)}</tbody>
              </table>
              <p className="mt-2 text-label text-ink-400">{data.database.version}</p>
            </ChartCard>
          </div>
          <Card className="mt-4 p-4 text-xs text-ink-400">Elastic Beanstalk environment health and RDS metrics are in the AWS console; this page shows what the app itself can see.</Card>
        </>
      )}
    </>
  );
}
