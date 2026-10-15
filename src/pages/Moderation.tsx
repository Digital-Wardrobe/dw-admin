import { useState } from 'react';
import { Clock, X } from 'lucide-react';
import { useAdminApi } from '../lib/useAdminApi';
import { adminSend } from '../lib/api';
import { useMe } from '../lib/me';
import { PageHeader, Card, Badge, InlineError, EmptyState, Skeleton } from '../components/ui';
import { Segmented, Kpi, ChartCard, ExportButton, DashControls, useDashParams, th, td, fmtN, fmtPct, Grid } from '../components/dash';

/* Reports: a queue ordered by deadline (the most harmful reasons get the shortest), the reported
   content only when a moderator opens it (logged), decisions that record who and what, appeals
   decided by someone else, and the numbers: time to handle, on time, per moderator, repeat offenders. */

const REASON: Record<string, string> = { SPAM: 'Spam', NUDITY: 'Nudity', HATE: 'Hate', VIOLENCE: 'Violence', HARASSMENT: 'Harassment', SCAM: 'Scam', FALSE_INFO: 'False info', IP_VIOLATION: 'IP', SELF_HARM: 'Self-harm', OTHER: 'Other' };
const btn = 'rounded-inner border border-ink-600 px-2.5 py-1.5 text-xs font-medium text-ink-100 transition hover:border-brand-line hover:text-brand disabled:opacity-50';

function Due({ minutes }: { minutes: number | null }) {
  if (minutes == null) return <span className="text-ink-400">–</span>;
  const late = minutes < 0, m = Math.abs(minutes);
  const text = m >= 1440 ? `${Math.round(m / 1440)} d` : m >= 60 ? `${Math.round(m / 60)} h` : `${m} min`;
  return <span className={`inline-flex items-center gap-1 ${late ? 'text-bad' : minutes < 60 ? 'text-warn' : 'text-ink-300'}`}><Clock size={12} aria-hidden="true" />{late ? `${text} late` : `${text} left`}</span>;
}

function ContentView({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, loading } = useAdminApi<any>(`reports/${id}/content`);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Reported content" onClick={onClose}>
      <Card className="max-h-[85dvh] w-full max-w-lg overflow-y-auto p-5" as="div">
        <div onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-ink-100">Reported content</p><button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X size={16} /></button></div>
          <p className="mb-3 text-label text-warn">Opening reported content is logged. Don't copy or share it.</p>
          {error ? <InlineError message={error} /> : loading || !data ? <Skeleton className="h-48 w-full" /> : !data.exists ? <p className="text-sm text-ink-400">This content no longer exists.</p> : (
            <div className="space-y-3">
              {data.removed && <Badge tone="warn">already removed</Badge>}
              {data.label && <p className="text-sm text-ink-100">{data.label}</p>}
              {data.text && <p className="whitespace-pre-wrap rounded-inner bg-ink-850 p-3 text-sm text-ink-100">{data.text}</p>}
              <div className="grid grid-cols-2 gap-2">{data.images.map((src: string) => <img key={src} src={src} alt="Reported content" className="w-full rounded-inner object-cover" loading="lazy" referrerPolicy="no-referrer" />)}</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Queue() {
  const { can } = useMe();
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED' | 'DISMISSED'>('OPEN');
  const [page, setPage] = useState(1);
  const { data, error, reload } = useAdminApi<any>('reports', { params: { status, page } });
  const [viewing, setViewing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const decide = async (id: string, body: any, label: string) => {
    setMsg(null);
    try { const r = await adminSend('PATCH', `reports/${id}`, body); setMsg(`${label}: closed ${r.closed} report${r.closed === 1 ? '' : 's'}.`); reload(); } catch (e: any) { setMsg(e.message); }
  };
  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <Segmented value={status} onChange={(v) => { setStatus(v); setPage(1); }} label="Report status" options={[{ id: 'OPEN', label: 'Open' }, { id: 'RESOLVED', label: 'Actioned' }, { id: 'DISMISSED', label: 'Dismissed' }]} />
        {msg && <span className="text-xs text-ink-300" role="status">{msg}</span>}
      </div>
      <Card>
        {error ? <div className="p-4"><InlineError message={error} onRetry={reload} /></div> : !data ? <Skeleton className="m-4 h-48" /> : !data.rows.length ? <div className="p-4"><EmptyState title={status === 'OPEN' ? 'Queue is clear' : 'Nothing here'} body={status === 'OPEN' ? 'No reports waiting.' : 'No reports with this status.'} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>{status === 'OPEN' ? 'Deadline' : 'Handled'}</th><th className={th}>What</th><th className={th}>Reason</th><th className={th}>Reported</th><th className={th}>Details</th><th className={th} /></tr></thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={r.id} className="border-t border-ink-700 align-top">
                    <td className={td}>{status === 'OPEN' ? <Due minutes={r.minutesLeft} /> : <span className="text-ink-300">{new Date(r.resolvedAt).toLocaleDateString('en-IN')} · {r.resolvedBy || '–'}<br /><span className="text-label">{r.action}</span></span>}</td>
                    <td className={td}>{r.contentType.toLowerCase().replace('_', ' ')}</td>
                    <td className={td}><Badge tone={['SELF_HARM', 'VIOLENCE'].includes(r.reason) ? 'bad' : 'neutral'}>{REASON[r.reason] || r.reason}</Badge></td>
                    <td className={`${td} font-mono text-xs`}>{r.reported?.pid || '–'}{r.reported?.reports > 1 && <span className="ml-1 text-warn">×{r.reported.reports}</span>}</td>
                    <td className={`${td} max-w-xs whitespace-normal text-xs text-ink-300`}>{r.details || <span className="text-ink-400">–</span>}</td>
                    <td className={`${td} text-right`}>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button className={btn} onClick={() => setViewing(r.id)}>Open</button>
                        {status === 'OPEN' && <>
                          <button className={btn} onClick={() => decide(r.id, { status: 'DISMISSED' }, 'Dismissed')}>Dismiss</button>
                          <button className={btn} onClick={() => decide(r.id, { status: 'RESOLVED', warn: true }, 'Warned')}>Warn</button>
                          <button className={btn} onClick={() => decide(r.id, { status: 'RESOLVED', removeContent: true }, 'Removed')}>Remove</button>
                          {can('users.act') && <button className={`${btn} text-bad`} onClick={() => { if (confirm('Remove the content and suspend the account?')) decide(r.id, { status: 'RESOLVED', removeContent: true, suspendUser: true }, 'Removed and suspended'); }}>Remove + suspend</button>}
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.pages > 1 && (
          <div className="flex justify-end gap-2 border-t border-ink-700 px-4 py-2 text-xs text-ink-300">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={btn}>Previous</button><span className="self-center">{page} / {data.pages}</span><button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className={btn}>Next</button>
          </div>
        )}
      </Card>
      {viewing && <ContentView id={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function Appeals() {
  const [status, setStatus] = useState<'OPEN' | 'UPHELD' | 'REVERSED'>('OPEN');
  const { data, error, reload } = useAdminApi<any>('appeals', { params: { status } });
  const [msg, setMsg] = useState<string | null>(null);
  const decide = async (id: string, decision: 'uphold' | 'reverse') => {
    setMsg(null);
    try { await adminSend('POST', `appeals/${id}`, { decision }); setMsg(decision === 'reverse' ? 'Reversed: content restored where it can be.' : 'Upheld.'); reload(); } catch (e: any) { setMsg(e.message); }
  };
  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <Segmented value={status} onChange={setStatus} label="Appeal status" options={[{ id: 'OPEN', label: 'Waiting' }, { id: 'UPHELD', label: 'Upheld' }, { id: 'REVERSED', label: 'Reversed' }]} />
        {msg && <span className="text-xs text-ink-300" role="status">{msg}</span>}
      </div>
      <Card>
        {error ? <div className="p-4"><InlineError message={error} onRetry={reload} /></div> : !data ? <Skeleton className="m-4 h-32" /> : !data.rows.length ? <div className="p-4"><EmptyState title="No appeals" body="People can appeal a removal or warning within 30 days, from Settings → Account status." /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>Sent</th><th className={th}>Decision appealed</th><th className={th}>Their reason</th><th className={th}>Person</th><th className={th} /></tr></thead>
              <tbody>
                {data.rows.map((a: any) => (
                  <tr key={a.id} className="border-t border-ink-700 align-top">
                    <td className={td}>{new Date(a.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className={`${td} text-xs text-ink-300`}>{a.report.contentType.toLowerCase()} · {REASON[a.report.reason]} · {a.report.action} by {a.report.resolvedBy || '–'}</td>
                    <td className={`${td} max-w-md whitespace-normal text-sm`}>{a.reason}</td>
                    <td className={`${td} font-mono text-xs`}>{a.user}</td>
                    <td className={`${td} text-right`}>{a.status === 'OPEN' ? <div className="flex justify-end gap-1.5"><button className={btn} onClick={() => decide(a.id, 'uphold')}>Uphold</button><button className={btn} onClick={() => decide(a.id, 'reverse')}>Reverse</button></div> : <span className="text-xs text-ink-400">{a.decidedBy}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Stats() {
  const { query, ready } = useDashParams({ range: '30d' });
  const { data, error, reload } = useAdminApi<any>('moderation/stats', { params: query, enabled: ready });
  return (
    <>
      <DashControls compare={false} />
      {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-64 w-full" /> : (
        <>
          <Grid cols={4}>
            <Kpi label="Open now" value={fmtN(data.open)} hint={`${fmtN(data.overdue)} past their deadline`} />
            <Kpi label="Handled in range" value={fmtN(data.resolved)} />
            <Kpi label="Median time to handle" value={data.medianHoursToResolve == null ? '–' : `${data.medianHoursToResolve.toFixed(1)} h`} />
            <Kpi label="On time" value={fmtPct(data.onTimeRate, 0)} hint="handled before the deadline for its reason" />
          </Grid>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="By moderator" caption="Decisions in the range, by who made them and what they did." actions={<ExportButton path="moderation/stats" params={query} table="moderators" />}>
              {!data.moderators.length ? <EmptyState title="No decisions yet" body="Counts appear once reports are handled." /> : (
                <table className="w-full"><thead><tr><th className={th}>Moderator</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Removed</th><th className={`${th} text-right`}>Warned</th><th className={`${th} text-right`}>Suspended</th><th className={`${th} text-right`}>Dismissed</th></tr></thead>
                  <tbody>{data.moderators.map((m: any) => <tr key={m.moderator} className="border-t border-ink-700"><td className={td}>{m.moderator}</td><td className={`${td} text-right`}>{fmtN(m.total)}</td><td className={`${td} text-right`}>{fmtN(m.content_removed || 0)}</td><td className={`${td} text-right`}>{fmtN(m.user_warned || 0)}</td><td className={`${td} text-right`}>{fmtN(m.user_suspended || 0)}</td><td className={`${td} text-right`}>{fmtN(m.none || 0)}</td></tr>)}</tbody></table>
              )}
            </ChartCard>
            <ChartCard title="Repeat offenders" caption="People reported 3 or more times in the last 90 days (pseudonymised)." actions={<ExportButton path="moderation/stats" params={query} table="offenders" />}>
              {!data.repeatOffenders.length ? <EmptyState title="None" body="Nobody has three or more reports in the last 90 days." /> : (
                <table className="w-full"><thead><tr><th className={th}>Person</th><th className={`${th} text-right`}>Reports</th><th className={`${th} text-right`}>Reporters</th><th className={`${th} text-right`}>Actioned</th><th className={th}>Status</th></tr></thead>
                  <tbody>{data.repeatOffenders.map((o: any) => <tr key={o.pid} className="border-t border-ink-700"><td className={`${td} font-mono text-xs`}>{o.pid}</td><td className={`${td} text-right`}>{fmtN(o.reports)}</td><td className={`${td} text-right`}>{fmtN(o.reporters)}</td><td className={`${td} text-right`}>{fmtN(o.actioned)}</td><td className={td}>{o.suspended ? <Badge tone="bad">suspended</Badge> : <Badge>active</Badge>}</td></tr>)}</tbody></table>
              )}
            </ChartCard>
            <ChartCard title="Reports by reason" caption="Reports made in the range, and how long each reason has to be handled in." actions={<ExportButton path="moderation/stats" params={query} table="reasons" />}>
              <table className="w-full"><thead><tr><th className={th}>Reason</th><th className={`${th} text-right`}>Reports</th><th className={`${th} text-right`}>Deadline</th></tr></thead>
                <tbody>{Object.keys(data.slaHours).map((k) => <tr key={k} className="border-t border-ink-700"><td className={td}>{REASON[k] || k}</td><td className={`${td} text-right`}>{fmtN(data.byReason.find((r: any) => r.reason === k)?.reports || 0)}</td><td className={`${td} text-right text-ink-300`}>{data.slaHours[k]} h</td></tr>)}</tbody></table>
            </ChartCard>
            <ChartCard title="Appeals" caption="Waiting now, and decided in the range.">
              <p className="text-sm text-ink-300"><span className="text-2xl font-semibold text-ink-50">{fmtN(data.appeals.open)}</span> waiting · {fmtN(data.appeals.decided.UPHELD || 0)} upheld · {fmtN(data.appeals.decided.REVERSED || 0)} reversed</p>
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}

export default function Moderation() {
  const [tab, setTab] = useState<'queue' | 'appeals' | 'stats'>('queue');
  return (
    <>
      <PageHeader title="Reports" subtitle="The moderation queue, ordered by deadline. Open the content only when you need to judge it (that's logged). Appeals are decided by someone other than the moderator who made the call." actions={<Segmented value={tab} onChange={setTab} label="Section" options={[{ id: 'queue', label: 'Queue' }, { id: 'appeals', label: 'Appeals' }, { id: 'stats', label: 'Numbers' }]} />} />
      {tab === 'queue' ? <Queue /> : tab === 'appeals' ? <Appeals /> : <Stats />}
    </>
  );
}
