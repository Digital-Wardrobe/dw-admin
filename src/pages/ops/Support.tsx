import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, X, ImageIcon } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { useMe } from '../../lib/me';
import { PageHeader, Card, Badge, InlineError, EmptyState, Skeleton } from '../../components/ui';
import { Segmented, th, td, fmtN, btnCls, primaryBtnCls } from '../../components/dash';

/* Support tickets raised from the app. The list is pseudonymous and shows no messages or
   photos: kind, subject, the quality-check verdict, retries and whether the use was given
   back. Opening a ticket shows the person's message and the photos they attached as proof,
   and is logged. A note written on Resolve is sent to the person. */

type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
const STATUS_LABEL: Record<Status, string> = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const KIND_LABEL: Record<string, string> = { beautify: 'Studio shot', scan: 'Scan', billing: 'Billing', general: 'General' };
const QC_METRIC: Record<string, string> = { similarity: 'Similarity to the source', bodyShare: 'Skin / face share', personProb: 'Person score', borderWhite: 'White border' };

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

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

function Person({ u }: { u: any }) {
  if (!u) return <span className="text-ink-400">unknown</span>;
  return <span className="whitespace-nowrap"><span className="font-mono text-ink-100">{u.pid}</span> <span className="text-xs text-ink-400">{u.plan}{u.deleted ? ' · deleted' : ''}</span></span>;
}

/** One ticket, opened on purpose: the message and photos load only here (and that's logged). */
function TicketView({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data: t, error, reload } = useAdminApi<any>(`tickets/${id}`);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Support ticket" onClick={onClose}>
      <Card className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto p-5" as="div">
        <div onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-ink-100">{t?.subject || 'Support ticket'}</p>
            <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X size={16} /></button>
          </div>
          <p className="mb-3 text-label text-warn">Opening a ticket is logged. Use the photos only to resolve it; don't copy or share them.</p>
          {error ? <InlineError message={error} onRetry={reload} /> : !t ? <Skeleton className="h-64 w-full" /> : (
            <TicketBody key={t.updatedAt} t={t} msg={msg} setMsg={setMsg} onChanged={() => { onChanged(); reload(); }} />
          )}
        </div>
      </Card>
    </div>
  );
}

/** The opened ticket (keyed on updatedAt, so the note box starts from what was saved). */
function TicketBody({ t, msg, setMsg, onChanged }: { t: any; msg: { ok: boolean; text: string } | null; setMsg: (m: { ok: boolean; text: string } | null) => void; onChanged: () => void }) {
  const { can } = useMe();
  const [note, setNote] = useState<string>(t.adminNote || '');
  const [busy, setBusy] = useState(false);
  const set = async (status: Status) => {
    setBusy(true); setMsg(null);
    try {
      await adminSend('PATCH', `tickets/${t.id}`, { status, adminNote: note });
      setMsg({ ok: true, text: status === 'RESOLVED' ? `Resolved.${note.trim() ? ' Your note was sent to them.' : ''}` : `Moved to ${STATUS_LABEL[status].toLowerCase()}.` });
      onChanged();
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };
  const metrics = t.context?.qc?.metrics && typeof t.context.qc.metrics === 'object' ? Object.entries(t.context.qc.metrics).filter(([k, v]) => QC_METRIC[k] && typeof v === 'number') : [];
  const open = t.status === 'OPEN' || t.status === 'IN_PROGRESS';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
        <Badge tone={t.kind === 'beautify' ? 'brand' : 'neutral'}>{KIND_LABEL[t.kind] || t.kind}</Badge>
        <Badge tone="neutral">{STATUS_LABEL[t.status as Status]}</Badge>
        <Flags t={t} />
        <span>raised {ago(t.createdAt)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Person u={t.user} />
        {t.user && can('users.read') && <Link to={`/admin/users?q=${encodeURIComponent(t.user.pid)}`} className="text-xs text-brand hover:underline">Look up in Users</Link>}
      </div>

      {t.message ? <p className="whitespace-pre-wrap rounded-inner bg-ink-850 p-3 text-sm text-ink-100">{t.message}</p> : <p className="text-sm text-ink-400">No message, just the subject.</p>}

      {t.attachments?.length > 0 && (
        <div>
          <p className="mb-1.5 text-label uppercase text-ink-400">Photos they attached</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {t.attachments.map((src: string, i: number) => (
              <a key={src} href={src} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer" className="shrink-0" title="Open full size">
                <img src={src} alt={t.kind === 'beautify' ? (i === 0 ? 'Their original photo' : 'The studio shot that went wrong') : `Attachment ${i + 1}`} loading="lazy" referrerPolicy="no-referrer"
                  className="h-40 w-32 rounded-inner border border-ink-700 bg-ink-850 object-contain" />
                {t.kind === 'beautify' && <span className="mt-1 block text-center text-label text-ink-400">{i === 0 ? 'original' : 'studio shot'}</span>}
              </a>
            ))}
          </div>
        </div>
      )}

      {(t.qcReasons?.length > 0 || metrics.length > 0) && (
        <div>
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

      <div className="space-y-2 border-t border-ink-700 pt-3">
        <label className="block text-xs text-ink-300">
          Note {open ? '(sent to them when you resolve)' : ''}
          <textarea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="We’ve given the use back. Try again with the item on a plain background."
            className="mt-1 w-full rounded-inner border border-ink-600 bg-ink-800 px-2 py-1.5 text-sm text-ink-100 transition hover:border-brand-line focus:border-brand" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {t.status === 'OPEN' && <button className={btnCls} disabled={busy} onClick={() => set('IN_PROGRESS')}>In progress</button>}
          {open && <button className={primaryBtnCls} disabled={busy} onClick={() => set('RESOLVED')}>Resolve</button>}
          {open && <button className={btnCls} disabled={busy} onClick={() => set('CLOSED')}>Close without reply</button>}
          {!open && <button className={btnCls} disabled={busy} onClick={() => set('OPEN')}>Reopen</button>}
          {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Support() {
  const [status, setStatus] = useState<Status>('OPEN');
  const { data, error, reload } = useAdminApi<any>('tickets', { params: { status } });
  const [viewing, setViewing] = useState<string | null>(null);
  const counts = data?.counts || {};
  const tickets: any[] = data?.tickets || [];

  return (
    <>
      <PageHeader title="Support" subtitle="Tickets raised from the app, oldest open first. The list shows no messages or photos; opening a ticket shows them and is logged." />
      <div className="mb-3">
        <Segmented value={status} onChange={setStatus} label="Ticket status"
          options={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ id: s, label: `${STATUS_LABEL[s]}${counts[s] ? ` · ${fmtN(counts[s])}` : ''}` }))} />
      </div>
      {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-64 w-full" /> : !tickets.length ? (
        <EmptyState icon={<LifeBuoy size={28} aria-hidden="true" />} title={`No ${STATUS_LABEL[status].toLowerCase()} tickets`} body="Tickets people raise from the app (including “studio shot didn’t come out right” after the free retries) show up here." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr><th className={th}>Raised</th><th className={th}>Kind</th><th className={th}>Subject</th><th className={th}>Checks</th><th className={th}>Person</th><th className={th} /></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-ink-700">
                  <td className={`${td} text-ink-300`} title={new Date(t.createdAt).toLocaleString()}>{ago(t.createdAt)}</td>
                  <td className={td}><Badge tone={t.kind === 'beautify' ? 'brand' : 'neutral'}>{KIND_LABEL[t.kind] || t.kind}</Badge></td>
                  <td className={`${td} max-w-[22rem] truncate`} title={t.subject}>
                    {t.subject}
                    {t.photos > 0 && <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink-400"><ImageIcon size={12} aria-hidden="true" />{t.photos}</span>}
                    {t.hasNote && <span className="ml-2 text-xs text-ink-400">note</span>}
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
