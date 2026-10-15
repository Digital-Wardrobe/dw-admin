import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Play, Users } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { humanise } from '../../lib/names';
import { PageHeader, Card, Badge, InlineError, EmptyState, Skeleton, StatTileSkeleton } from '../../components/ui';
import { ChartCard, ExportButton, AsOf, ShareBar, fmtN, fmtPct, Grid, inputCls, btnCls, primaryBtnCls } from '../../components/dash';

/* Segments: everyone active in the last 60 days by how often they come. Clusters: people who
   agreed to personalisation, grouped nightly by what they do and the style of their closet
   (FashionSigLIP item vectors, never photos), named by hand here. */

function Members({ clusterId }: { clusterId: string }) {
  const [page, setPage] = useState(1);
  const { data, error } = useAdminApi<any>(`behaviour/clusters/${clusterId}/members`, { params: { page } });
  if (error) return <p className="text-xs text-bad">{error}</p>;
  if (!data) return <Skeleton className="h-20 w-full" />;
  const pages = Math.ceil(data.total / data.pageSize);
  return (
    <div className="mt-3 rounded-inner border border-ink-700 p-3">
      <p className="mb-2 text-label text-ink-400">{fmtN(data.total)} people still consented · pseudonymous IDs · opening a timeline is logged</p>
      <ul className="flex flex-wrap gap-1.5">
        {data.members.map((m: any) => (
          <li key={m.pid}><Link to={`/admin/behaviour/timeline?ref=${encodeURIComponent(m.ref)}&pid=${m.pid}`} className="rounded-[5px] border border-ink-600 px-1.5 py-0.5 font-mono text-label text-ink-300 hover:border-brand-line hover:text-brand">{m.pid}</Link></li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="mt-2 flex items-center gap-2 text-xs text-ink-400">
          <button className={btnCls} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          page {page} of {pages}
          <button className={btnCls} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

function ClusterCard({ c, total, canEdit, canSeeMembers, onSaved }: { c: any; total: number; canEdit: boolean; canSeeMembers: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(c.label || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const s = c.stats || {};
  const save = async (value: string | null) => {
    setBusy(true); setErr(null);
    try { await adminSend('PATCH', `behaviour/clusters/${c.id}`, { label: value }); setEditing(false); onSaved(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const style = s.styleStrength == null ? null : s.styleStrength >= 2 ? 'strong' : s.styleStrength >= 1 ? 'clear' : 'weak';
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {editing ? (
            <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); save(label.trim() || null); }}>
              <input autoFocus maxLength={60} aria-label="Cluster name" className={`${inputCls} w-56`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Weekend planners" />
              <button className={primaryBtnCls} disabled={busy}>Save</button>
              <button type="button" className="text-xs text-ink-400 hover:text-ink-100" onClick={() => { setEditing(false); setLabel(c.label || ''); }}>Cancel</button>
            </form>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium text-ink-50">
              {c.label || <span className="text-ink-300">Cluster {c.idx + 1} <span className="font-normal text-ink-400">(not named yet)</span></span>}
              {s.labelFrom && <span title="Name carried over from the matching cluster in the previous run"><Badge tone="neutral">carried over</Badge></span>}
              {canEdit && <button className="text-xs font-normal text-brand hover:underline" onClick={() => setEditing(true)}>{c.label ? 'Rename' : 'Name it'}</button>}
            </p>
          )}
          <p className="mt-0.5 text-xs text-ink-400"><span data-numeric className="text-ink-100">{fmtN(c.size)}</span> people · {fmtPct(total ? c.size / total : 0, 0)} of everyone clustered</p>
          {err && <p className="text-xs text-bad">{err}</p>}
        </div>
      </div>
      <ShareBar pct={total ? c.size / total : 0} label="share of people" />

      {c.traits?.length ? (
        <ul className="space-y-1 text-sm">
          {c.traits.map((t: any) => (
            <li key={t.key} className="flex items-start gap-1.5 text-ink-100">
              {t.direction === 'more' ? <ArrowUp size={14} className="mt-0.5 shrink-0 text-ok" aria-label="more than average" /> : <ArrowDown size={14} className="mt-0.5 shrink-0 text-warn" aria-label="less than average" />}
              {t.text}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-ink-400">Behaves like everyone else; what sets it apart is closet style (below).</p>}

      <dl className="grid grid-cols-2 gap-2 border-t border-ink-700 pt-3 text-xs sm:grid-cols-4">
        <div><dt className="text-label text-ink-400">Paying</dt><dd data-numeric className="text-ink-100">{fmtPct(s.payingShare, 0)}</dd></div>
        <div><dt className="text-label text-ink-400">Active this week</dt><dd data-numeric className="text-ink-100">{fmtPct(s.active7dShare, 0)}</dd></div>
        <div><dt className="text-label text-ink-400">Active days (of 30)</dt><dd data-numeric className="text-ink-100">{s.avgActiveDays?.toFixed(1) ?? '–'}</dd></div>
        <div><dt className="text-label text-ink-400">Closet items</dt><dd data-numeric className="text-ink-100">{fmtN(s.avgItems)}</dd></div>
      </dl>
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div>
          <p className="text-label text-ink-400">Style personas</p>
          <p className="text-ink-100">{(s.topPersonas || []).filter((p: any) => p.share >= 0.02).map((p: any) => `${p.key === 'not set' ? 'not set' : humanise(p.key)} ${fmtPct(p.share, 0)}`).join(' · ') || '–'}</p>
        </div>
        <div>
          <p className="text-label text-ink-400">Most-owned categories</p>
          <p className="text-ink-100">{(s.topCategories || []).map((x: any) => `${x.key} ${fmtPct(x.share, 0)}`).join(' · ') || '–'}</p>
        </div>
      </div>
      <p className="text-label text-ink-400">
        Closet style signal: {style ? <span className={style === 'weak' ? '' : 'text-ink-100'}>{style}</span> : 'no item vectors'} · {fmtPct(s.withStyleShare, 0)} have item vectors
      </p>
      {canSeeMembers && (
        <div>
          <button className={btnCls} onClick={() => setShowMembers(!showMembers)}><Users size={13} aria-hidden="true" /> {showMembers ? 'Hide people' : 'People'}</button>
          {showMembers && <Members clusterId={c.id} />}
        </div>
      )}
    </Card>
  );
}

export default function Segments() {
  const seg = useAdminApi<any>('behaviour/segments');
  const [run, setRun] = useState<string>('');
  const cl = useAdminApi<any>('behaviour/clusters', { params: run ? { run } : {} });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const d = cl.data;
  const meta = d?.clusters[0]?.stats?.run;
  const total = d?.clusters.reduce((a: number, c: any) => a + c.size, 0) || 0;
  const runNow = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await adminSend<any>('POST', 'behaviour/clusters/run');
      setMsg(r.skipped ? { ok: false, text: r.reason } : { ok: true, text: `${r.k} clusters from ${fmtN(r.people)} people.` });
      setRun(''); cl.reload();
    } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Segments" subtitle="Who comes how often, and groups of people who use Fluntr the same way." />
      {seg.error ? <InlineError message={seg.error} onRetry={seg.reload} /> : (
        <ChartCard title="Activity segments" caption={seg.data ? `${fmtN(seg.data.people)} people active in the last 60 days, counted from the daily activity rollup.` : 'Everyone active in the last 60 days.'} asOf={seg.data?.asOf}
          actions={<ExportButton path="behaviour/segments" params={{}} table="segments" />}>
          <Grid cols={3}>
            {!seg.data ? Array.from({ length: 6 }, (_, i) => <StatTileSkeleton key={i} />) : seg.data.segments.map((x: any) => (
              <div key={x.key} className="rounded-inner border border-ink-700 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink-100">{x.label}</p>
                  <p data-numeric className="text-lg font-semibold text-ink-50">{fmtN(x.people)} <span className="text-xs font-normal text-ink-400">{fmtPct(x.share, 0)}</span></p>
                </div>
                <p className="text-xs text-ink-400">{x.definition}</p>
                <p className="mt-2 text-label text-ink-400">{fmtPct(x.paidShare, 0)} on a paid plan · {fmtPct(x.consentedShare, 0)} consented to personalisation{x.avgActiveDays != null && ` · ${x.avgActiveDays.toFixed(1)} active days`}</p>
              </div>
            ))}
          </Grid>
        </ChartCard>
      )}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-label uppercase text-ink-400">Behaviour clusters</h2>
            <p className="mt-1 max-w-3xl text-xs text-ink-400">
              People who agreed to personalisation and used Fluntr in the last 30 days, grouped nightly by their activity, the features they use, closet size, wears, and the average FashionSigLIP vector of their closet items (never photos or faces). Groups under 20 people are folded into the nearest one. Name them by hand; a name carries over when next night’s cluster clearly matches.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {d?.runs?.length > 1 && (
              <select aria-label="Run" className={inputCls} value={run || d.runId || ''} onChange={(e) => setRun(e.target.value)}>
                {d.runs.map((r: any, i: number) => <option key={r.runId} value={r.runId}>{i === 0 ? 'Latest run' : 'Earlier run'} · {new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</option>)}
              </select>
            )}
            {d?.canEdit && <button className={primaryBtnCls} disabled={busy} onClick={runNow}><span className="inline-flex items-center gap-1.5"><Play size={12} aria-hidden="true" />{busy ? 'Running…' : 'Run now'}</span></button>}
          </div>
        </div>
        {msg && <p className={`mb-2 text-xs ${msg.ok ? 'text-ok' : 'text-warn'}`}>{msg.text}</p>}
        {cl.error ? <InlineError message={cl.error} onRetry={cl.reload} /> : !d ? <Skeleton className="h-72 w-full" /> : !d.clusters.length ? (
          <EmptyState title="No clusters yet" body={`They’re computed nightly once at least ${d.minPeople} people who agreed to personalisation have been active in the last 30 days.`} />
        ) : (
          <>
            {meta && <p className="mb-3 text-xs text-ink-400"><AsOf at={d.at} /> · {meta.k} clusters · {fmtN(meta.people)} people ({fmtN(meta.withStyle)} with item vectors) · separation {meta.silhouette.toFixed(2)} (silhouette; above 0.25 is clear-cut) · run by {meta.by}</p>}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {d.clusters.map((c: any) => <ClusterCard key={c.id} c={c} total={total} canEdit={d.canEdit && (!run || run === d.runs[0]?.runId)} canSeeMembers={d.canSeeMembers} onSaved={cl.reload} />)}
            </div>
          </>
        )}
      </section>
    </>
  );
}
