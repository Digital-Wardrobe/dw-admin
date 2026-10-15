import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, X, ImageIcon, MessageSquare, Lock, Smartphone } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { useMe } from '../../lib/me';
import { PageHeader, Card, Badge, InlineError, EmptyState, Skeleton } from '../../components/ui';
import { Segmented, Kpi, Grid, th, td, fmtN, btnCls, primaryBtnCls, inputCls } from '../../components/dash';

/* Support conversations from the app. The list is pseudonymous and shows no messages or
   photos: kind, subject, who it's waiting on, counts, the quality-check verdict and the
   device. Opening one shows the conversation and is logged; replies reach the person as a
   push ("Fluntr support replied") and are logged without their text. The internal note is
   for the team only. */

type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type Waiting = 'all' | 'us' | 'them';
const STATUS_LABEL: Record<Status, string> = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const KIND_LABEL: Record<string, string> = {
  account: 'Account', billing: 'Billing', scan: 'Scan', beautify: 'Studio shot', bug: 'Bug', feedback: 'Feedback', general: 'General',
};
const QC_METRIC: Record<string, string> = { similarity: 'Similarity to the source', bodyShare: 'Skin / face share', personProb: 'Person score', borderWhite: 'White border' };

/* Ready-made openings; edit before sending. Plain words, no promises we can't keep. */
const CANNED: { label: string; text: string }[] = [
  { label: 'Thanks, looking into it', text: 'Thanks for letting us know! We’re looking into it and will reply here as soon as we know more.' },
  { label: 'Use given back', text: 'Sorry about that. We’ve given the use back, so you can try again. Photos on a plain background with the whole piece in view work best.' },
  { label: 'Need a screenshot', text: 'Thanks! Could you send a screenshot of what you see? Tap the photo button next to the reply box.' },
  { label: 'Update the app', text: 'This is fixed in the latest version. Open Settings → App updates and tap “Check for updates”, then restart Fluntr.' },
  { label: 'Store subscriptions', text: 'Subscriptions bought in the app are managed by your Google Play or App Store account, under Subscriptions. You can cancel or change it there.' },
  { label: 'Feedback noted', text: 'Thank you, this is really helpful. We’ve shared it with the team.' },
];

const ago = (iso?: string | null) => {
  if (!iso) return '–';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};
const fmtMin = (m: number | null | undefined) => (m == null ? '–' : m < 60 ? `${m} min` : m < 1440 ? `${(m / 60).toFixed(m < 600 ? 1 : 0)} h` : `${(m / 1440).toFixed(1)} d`);
const stamp = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function Flags({ t }: { t: any }) {
  return (
    <span className="flex flex-wrap gap-1">
      {t.qcOk === false && <Badge tone="bad">failed quality check</Badge>}
      {t.qcOk === true && <Badge tone="warn">passed quality check</Badge>}
      {t.refunded && <Badge tone="ok">use given back</Badge>}
      {t.retryN ? <Badge tone="neutral">retry {t.retryN}</Badge> : null}
    </span>
  );
}

function WaitingBadge({ on, since }: { on: 'us' | 'them' | null; since?: string | null }) {
  if (on === 'us') return <Badge tone={since && Date.now() - new Date(since).getTime() > 86_400_000 ? 'bad' : 'warn'}>on us · {ago(since)}</Badge>;
  if (on === 'them') return <Badge tone="neutral">on them</Badge>;
  return <span className="text-ink-400">–</span>;
}

function Person({ u }: { u: any }) {
  if (!u) return <span className="text-ink-400">unknown</span>;
  return <span className="whitespace-nowrap"><span className="font-mono text-ink-100">{u.pid}</span> <span className="text-xs text-ink-400">{u.plan}{u.deleted ? ' · deleted' : ''}</span></span>;
}

function Device({ d }: { d: any }) {
  if (!d?.platform && !d?.version) return <span className="text-ink-400">–</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-ink-300"><Smartphone size={12} aria-hidden="true" />{[d.platform, d.version].filter(Boolean).join(' · ')}</span>;
}

/** One conversation, opened on purpose: messages and photos load only here (and that's logged). */
function TicketView({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data: t, error, reload } = useAdminApi<any>(`tickets/${id}`);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Support conversation" onClick={onClose}>
      <Card className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden" as="div">
        <div className="flex min-h-0 flex-1 flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 border-b border-ink-700 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-100">{t?.subject || 'Support conversation'}</p>
              <p className="text-label text-warn">Opening a conversation is logged. Use what's here only to help them; don't copy or share it.</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X size={16} /></button>
          </div>
          {error ? <div className="p-5"><InlineError message={error} onRetry={reload} /></div> : !t ? <div className="p-5"><Skeleton className="h-64 w-full" /></div> : (
            <TicketBody t={t} onChanged={() => { onChanged(); reload(); }} />
          )}
        </div>
      </Card>
    </div>
  );
}

function Thread({ t }: { t: any }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [t.messages?.length]);
  return (
    <div className="space-y-3">
      {(t.messages || []).map((m: any) => {
        const staff = m.author === 'staff';
        return (
          <div key={m.id} className={`flex ${staff ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${staff ? 'items-end text-right' : 'items-start'} flex flex-col`}>
              <span className="mb-0.5 text-label text-ink-400">{staff ? `Fluntr support${m.staffName ? ` · ${m.staffName}` : ''}` : 'Them'} · {stamp(m.createdAt)}</span>
              {m.text && <p className={`whitespace-pre-wrap rounded-card px-3 py-2 text-left text-sm ${staff ? 'bg-brand/15 text-ink-50' : 'bg-ink-850 text-ink-100'}`}>{m.text}</p>}
              {m.attachments?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {m.attachments.map((src: string, i: number) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer" title="Open full size">
                      <img src={src} loading="lazy" referrerPolicy="no-referrer" alt={t.kind === 'beautify' && i < 2 ? (i === 0 ? 'Their original photo' : 'The studio shot that went wrong') : `Screenshot ${i + 1}`}
                        className="h-36 w-28 rounded-inner border border-ink-700 bg-ink-850 object-contain" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

function TicketBody({ t, onChanged }: { t: any; onChanged: () => void }) {
  const { can } = useMe();
  const [reply, setReply] = useState('');
  const [note, setNote] = useState<string>(t.internalNote || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const open = t.status === 'OPEN' || t.status === 'IN_PROGRESS';
  const metrics = t.context?.qc?.metrics && typeof t.context.qc.metrics === 'object' ? Object.entries(t.context.qc.metrics).filter(([k, v]) => QC_METRIC[k] && typeof v === 'number') : [];
  const canReply = !t.user?.deleted;

  const run = async (key: string, fn: () => Promise<any>, done: string) => {
    setBusy(key); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: done }); onChanged(); return true; } catch (e: any) { setMsg({ ok: false, text: e.message }); return false; } finally { setBusy(null); }
  };
  const send = async (resolve: boolean) => {
    if (!reply.trim()) return;
    const ok = await run(resolve ? 'send-resolve' : 'send', () => adminSend('POST', `tickets/${t.id}/messages`, { text: reply, ...(resolve && { status: 'RESOLVED' }) }),
      resolve ? 'Sent and resolved. They’ll get a notification.' : 'Sent. They’ll get a notification.');
    if (ok) setReply('');
  };
  const setStatus = (status: Status, done: string) => run(status, () => adminSend('PATCH', `tickets/${t.id}`, { status }), done);
  const saveNote = () => run('note', () => adminSend('PATCH', `tickets/${t.id}`, { internalNote: note }), 'Note saved.');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
          <Badge tone={t.kind === 'beautify' ? 'brand' : 'neutral'}>{KIND_LABEL[t.kind] || t.kind}</Badge>
          <Badge tone="neutral">{STATUS_LABEL[t.status as Status]}</Badge>
          <WaitingBadge on={t.waitingOn} since={t.waitingOn === 'us' ? (t.lastUserMessageAt || t.createdAt) : null} />
          <Flags t={t} />
          <span>started {ago(t.createdAt)} ago</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Person u={t.user} />
          <Device d={t.device} />
          {t.otherTickets > 0 && <span className="text-xs text-ink-400">{fmtN(t.otherTickets)} other request{t.otherTickets === 1 ? '' : 's'}</span>}
          {t.user && can('users.read') && <Link to={`/admin/users?q=${encodeURIComponent(t.user.pid)}`} className="text-xs text-brand hover:underline">Look up in Users</Link>}
        </div>

        <Thread t={t} />

        {(t.qcReasons?.length > 0 || metrics.length > 0) && (
          <div className="rounded-inner border border-ink-700 p-3">
            <p className="mb-1.5 text-label uppercase text-ink-400">Quality check</p>
            {t.qcReasons?.length > 0 && <p className="mb-1.5 text-sm text-ink-200">{t.qcReasons.join(' · ')}</p>}
            {metrics.length > 0 && (
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {metrics.map(([k, v]) => <div key={k}><dt className="text-label text-ink-400">{QC_METRIC[k]}</dt><dd data-numeric className="text-ink-50">{(v as number).toFixed(2)}</dd></div>)}
              </dl>
            )}
            <p className="mt-1 text-label text-ink-400">Thresholds are on the GPU & plans page.</p>
          </div>
        )}

        <details className="rounded-inner border border-ink-700 p-3" open={!!t.internalNote}>
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-300"><Lock size={12} aria-hidden="true" /> Internal note (team only, never sent)</summary>
          <textarea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Checked the Play console: refund issued on 14 Oct."
            className="mt-2 w-full rounded-inner border border-ink-600 bg-ink-800 px-2 py-1.5 text-sm text-ink-100 transition hover:border-brand-line focus:border-brand" />
          <button className={`${btnCls} mt-1.5`} disabled={busy !== null || note === (t.internalNote || '')} onClick={saveNote}>Save note</button>
        </details>
      </div>

      <div className="space-y-2 border-t border-ink-700 px-5 py-3">
        {canReply ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-ink-400" htmlFor="canned">Start from</label>
              <select id="canned" className={inputCls} value="" onChange={(e) => { const c = CANNED[Number(e.target.value)]; if (c) setReply((r) => (r.trim() ? `${r.trim()}\n\n${c.text}` : c.text)); }}>
                <option value="">a ready reply…</option>
                {CANNED.map((c, i) => <option key={c.label} value={i}>{c.label}</option>)}
              </select>
            </div>
            <textarea rows={3} maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Reply"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(false); }}
              placeholder={open ? 'Write a reply. They see it as “Fluntr support” and get a notification.' : 'Replying reopens this conversation as in progress.'}
              className="w-full rounded-inner border border-ink-600 bg-ink-800 px-2 py-1.5 text-sm text-ink-100 transition hover:border-brand-line focus:border-brand" />
          </>
        ) : <p className="text-xs text-ink-400">This account has been deleted, so a reply can’t reach them.</p>}
        <div className="flex flex-wrap items-center gap-2">
          {canReply && <button className={primaryBtnCls} disabled={busy !== null || !reply.trim()} onClick={() => send(false)} title="Ctrl/⌘ + Enter">Send reply</button>}
          {canReply && open && <button className={btnCls} disabled={busy !== null || !reply.trim()} onClick={() => send(true)}>Send and resolve</button>}
          <span className="mx-1 h-4 w-px bg-ink-700" aria-hidden="true" />
          {t.status === 'OPEN' && <button className={btnCls} disabled={busy !== null} onClick={() => setStatus('IN_PROGRESS', 'Moved to in progress.')}>In progress</button>}
          {open && <button className={btnCls} disabled={busy !== null} onClick={() => setStatus('RESOLVED', 'Resolved. They were told it’s solved.')}>Resolve</button>}
          {open && <button className={btnCls} disabled={busy !== null} onClick={() => setStatus('CLOSED', 'Closed without a reply.')}>Close without reply</button>}
          {!open && <button className={btnCls} disabled={busy !== null} onClick={() => setStatus('OPEN', 'Reopened.')}>Reopen</button>}
          {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Support() {
  const [status, setStatus] = useState<Status>('OPEN');
  const [waiting, setWaiting] = useState<Waiting>('all');
  const done = status === 'RESOLVED' || status === 'CLOSED';
  const { data, error, reload } = useAdminApi<any>('tickets', { params: { status, ...(!done && waiting !== 'all' && { waiting }) } });
  const [viewing, setViewing] = useState<string | null>(null);
  const counts = data?.counts || {};
  const stats = data?.stats || {};
  const tickets: any[] = data?.tickets || [];

  return (
    <>
      <PageHeader title="Support" subtitle="Conversations from the app, longest waiting first. The list shows no messages or photos; opening one shows them and is logged." />
      {data && (
        <div className="mb-4">
          <Grid cols={4}>
            <Kpi label="Waiting on us" value={fmtN(stats.waitingOnUs)} hint="Open conversations where they wrote last" />
            <Kpi label="Waiting over 24 h" value={<span className={stats.waitingOver24h ? 'text-bad' : ''}>{fmtN(stats.waitingOver24h)}</span>} hint="Of those, waiting more than a day" />
            <Kpi label="First reply (median)" value={fmtMin(stats.firstResponseMedianMin)} hint={`Requests started in the last 30 days (${fmtN(stats.answered30d)} answered)`} />
            <Kpi label="Resolved in 7 days" value={fmtN(stats.resolved7d)} />
          </Grid>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented value={status} onChange={setStatus} label="Conversation status"
          options={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ id: s, label: `${STATUS_LABEL[s]}${counts[s] ? ` · ${fmtN(counts[s])}` : ''}` }))} />
        {!done && (
          <Segmented value={waiting} onChange={setWaiting} label="Waiting on"
            options={[{ id: 'all', label: 'All' }, { id: 'us', label: 'Waiting on us' }, { id: 'them', label: 'Waiting on them' }]} />
        )}
      </div>
      {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-64 w-full" /> : !tickets.length ? (
        <EmptyState icon={<LifeBuoy size={28} aria-hidden="true" />} title={`No ${STATUS_LABEL[status].toLowerCase()} conversations${!done && waiting !== 'all' ? ` waiting on ${waiting}` : ''}`}
          body="Requests people send from Help and support in the app (and “studio shot didn’t come out right” after the free retries) show up here." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead><tr><th className={th}>{done ? 'Closed' : 'Waiting'}</th><th className={th}>Kind</th><th className={th}>Subject</th><th className={th}>Checks</th><th className={th}>Person</th><th className={th} /></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-ink-700">
                  <td className={td} title={`Started ${new Date(t.createdAt).toLocaleString()}`}>{done ? <span className="text-ink-300">{ago(t.resolvedAt || t.lastMessageAt)} ago</span> : <WaitingBadge on={t.waitingOn} since={t.waitingSince} />}</td>
                  <td className={td}><Badge tone={t.kind === 'beautify' ? 'brand' : 'neutral'}>{KIND_LABEL[t.kind] || t.kind}</Badge></td>
                  <td className={`${td} max-w-[24rem]`} title={t.subject}>
                    <div className="flex items-center gap-2">
                      <span className="truncate">{t.subject}</span>
                      {t.messages > 1 && <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-400" title="Messages"><MessageSquare size={12} aria-hidden="true" />{fmtN(t.messages)}</span>}
                      {t.photos > 0 && <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-400" title="Photos"><ImageIcon size={12} aria-hidden="true" />{t.photos}</span>}
                      {t.hasNote && <span className="shrink-0 text-xs text-ink-400">note</span>}
                    </div>
                    {t.device && <div className="mt-0.5"><Device d={t.device} /></div>}
                  </td>
                  <td className={td}><Flags t={t} /></td>
                  <td className={td}><Person u={t.user} /></td>
                  <td className={`${td} text-right`}><button className={btnCls} onClick={() => setViewing(t.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {viewing && <TicketView id={viewing} onClose={() => setViewing(null)} onChanged={reload} />}
    </>
  );
}
