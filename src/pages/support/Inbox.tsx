import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LifeBuoy, ImageIcon, MessageSquare, Wifi, WifiOff, UserRound } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { useMe } from '../../lib/me';
import { Card, Badge, InlineError, EmptyState, Skeleton } from '../../components/ui';
import { Segmented, fmtN, inputCls } from '../../components/dash';
import { useDeskSocket, useDeskEvent } from '../../lib/deskSocket';
import ChatPanel from './ChatPanel';
import CustomerPanel from './CustomerPanel';
import { PRIORITY_DOT, PRIORITY_LABEL, ago, fmtMin, Initial, StatusDot, type Priority } from './shared';

/* The support inbox: queues on the left (no message text or photos), the chat in the middle,
   the customer on the right. My status decides whether new chats are handed to me. */

type View = 'unassigned' | 'mine' | 'open' | 'resolved' | 'closed';
const VIEWS: { id: View; label: string }[] = [
  { id: 'mine', label: 'Mine' }, { id: 'unassigned', label: 'Unassigned' }, { id: 'open', label: 'All open' }, { id: 'resolved', label: 'Resolved' }, { id: 'closed', label: 'Closed' },
];

export default function Inbox() {
  const { can } = useMe();
  const [sp, setSp] = useSearchParams();
  const view = (VIEWS.find((v) => v.id === sp.get('view'))?.id || 'mine') as View;
  const chat = sp.get('chat');
  const [priority, setPriority] = useState('');
  const [topic, setTopic] = useState('');
  const { data: desk, reload: reloadDesk } = useAdminApi<any>('support/desk');
  const { data, error, reload } = useAdminApi<any>('tickets', { params: { view, ...(priority && { priority }), ...(topic && { topic }) } });
  const { socket, connected } = useDeskSocket();
  const [me, setMe] = useState<{ supportStatus: string; displayName: string | null } | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (desk?.me && !me) { setMe(desk.me); setNameDraft(desk.me.displayName || ''); } }, [desk, me]);
  // Live queue + fallback poll + heartbeat (keeps "online" honest)
  useDeskEvent(socket, 'desk:ticket', () => reload());
  useEffect(() => {
    const poll = setInterval(reload, connected ? 60_000 : 15_000);
    const beat = setInterval(() => adminSend('PUT', 'support/me', {}).catch(() => {}), 120_000);
    return () => { clearInterval(poll); clearInterval(beat); };
  }, [connected, reload]);

  const setStatus = async (supportStatus: string) => {
    try {
      const r = await adminSend<any>('PUT', 'support/me', { supportStatus });
      setMe((m) => ({ ...(m as any), supportStatus }));
      setMsg(supportStatus === 'online' ? `You’re online.${r?.data?.assignedNow ? ` ${r.data.assignedNow} waiting chat${r.data.assignedNow === 1 ? ' was' : 's were'} given to you.` : ' New chats come to you.'}` : supportStatus === 'away' ? 'Away: no new chats.' : 'Offline.');
      reload(); reloadDesk();
    } catch (e: any) { setMsg(e.message); }
  };
  const saveName = async () => {
    try { await adminSend('PUT', 'support/me', { displayName: nameDraft }); setMe((m) => ({ ...(m as any), displayName: nameDraft || null })); setMsg('Display name saved. New replies show it.'); reloadDesk(); } catch (e: any) { setMsg(e.message); }
  };
  const open = (id: string | null) => { const n = new URLSearchParams(sp); if (id) n.set('chat', id); else n.delete('chat'); setSp(n, { replace: true }); };
  const setView = (v: View) => { const n = new URLSearchParams(sp); n.set('view', v); n.delete('chat'); setSp(n, { replace: true }); };

  const tickets: any[] = data?.tickets || [];
  const counts = data?.counts || {};
  const stats = data?.stats || {};
  const d = desk || null;

  return (
    <div className="space-y-3">
      {/* Me + numbers */}
      <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm text-ink-200"><UserRound size={15} aria-hidden="true" /> You appear as</span>
        <input aria-label="Your display name" className={`${inputCls} w-36`} placeholder="e.g. Priya" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={() => { if ((me?.displayName || '') !== nameDraft.trim()) saveName(); }} maxLength={24} />
        <Segmented value={(me?.supportStatus || 'offline') as any} onChange={(v: string) => setStatus(v)} label="Your status"
          options={[{ id: 'online', label: 'Online' }, { id: 'away', label: 'Away' }, { id: 'offline', label: 'Offline' }]} />
        <span className={`inline-flex items-center gap-1 text-label ${connected ? 'text-ok' : 'text-ink-500'}`} title={connected ? 'Live updates on' : 'Live updates off: refreshing every 15 s'}>{connected ? <Wifi size={12} /> : <WifiOff size={12} />}{connected ? 'live' : 'polling'}</span>
        <span className="ml-auto flex flex-wrap gap-4 text-xs text-ink-400">
          <span>Waiting on us <b className="text-ink-100">{fmtN(stats.waitingOnUs)}</b></span>
          <span>Past first-reply target <b className={stats.slaBreached ? 'text-bad' : 'text-ink-100'}>{fmtN(stats.slaBreached)}</b></span>
          <span>First reply <b className="text-ink-100">{fmtMin(stats.firstResponseMedianMin)}</b></span>
          <span>Resolved 7 d <b className="text-ink-100">{fmtN(stats.resolved7d)}</b></span>
        </span>
        {msg && <p role="status" className="w-full text-xs text-ink-300">{msg}</p>}
      </Card>

      <div className="grid min-h-[70dvh] grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_330px]">
        {/* Queue */}
        <Card className={`flex min-h-0 flex-col overflow-hidden ${chat ? 'hidden lg:flex' : 'flex'}`}>
          <div className="space-y-2 border-b border-ink-700 p-3">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Queues">
              {VIEWS.map((v) => (
                <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}
                  className={`rounded-inner px-2 py-1 text-xs ${view === v.id ? 'bg-ink-700 text-ink-50' : 'text-ink-400 hover:text-ink-100'}`}>
                  {v.label}{counts[v.id] ? ` · ${fmtN(counts[v.id])}` : ''}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <select aria-label="Priority" className={`${inputCls} flex-1`} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">Any priority</option>{(['urgent', 'high', 'normal', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
              <select aria-label="Topic" className={`${inputCls} flex-1`} value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">Any topic</option>{(d?.topics || []).filter((x: any) => x.group).map((x: any) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {error ? <div className="p-3"><InlineError message={error} onRetry={reload} /></div> : !data ? <div className="p-3"><Skeleton className="h-64 w-full" /></div> : !tickets.length ? (
              <div className="p-3"><EmptyState icon={<LifeBuoy size={24} aria-hidden="true" />} title={view === 'mine' ? 'Nothing assigned to you' : 'No chats here'} body={view === 'mine' ? 'Go online to get new chats, or take one from Unassigned.' : 'Chats people start from Help and support in the app show up here.'} /></div>
            ) : tickets.map((t) => (
              <button key={t.id} onClick={() => open(t.id)} aria-current={chat === t.id}
                className={`block w-full border-b border-ink-700 px-3 py-2.5 text-left transition hover:bg-ink-850 ${chat === t.id ? 'bg-ink-850' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority as Priority] || 'bg-ink-500'}`} title={`${t.priority} priority`} />
                  <span className={`min-w-0 flex-1 truncate text-sm ${t.unread ? 'font-semibold text-ink-50' : 'text-ink-100'}`}>{t.subject}</span>
                  {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="New message" />}
                </div>
                <p className="mt-0.5 truncate pl-4 text-xs text-ink-400">{t.topicTrail || t.kind}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-4 text-xs">
                  {t.waitingOn === 'us' ? <Badge tone={t.slaBreached ? 'bad' : 'warn'}>waiting {ago(t.waitingSince)}</Badge> : t.waitingOn === 'them' ? <Badge>on them</Badge> : t.rating ? <span className="text-warn">{'★'.repeat(t.rating)}</span> : null}
                  {t.messages > 1 && <span className="inline-flex items-center gap-0.5 text-ink-400"><MessageSquare size={11} aria-hidden="true" />{t.messages}</span>}
                  {t.photos > 0 && <span className="inline-flex items-center gap-0.5 text-ink-400"><ImageIcon size={11} aria-hidden="true" />{t.photos}</span>}
                  {t.user?.plan && t.user.plan !== 'FREE' && <Badge tone="brand">{t.user.plan}</Badge>}
                  <span className="ml-auto inline-flex items-center gap-1 text-ink-400">{t.assignee ? <><Initial name={t.assignee.name} size="h-4 w-4 text-[9px]" />{t.assignee.me ? 'you' : t.assignee.name}</> : 'unassigned'}</span>
                </div>
              </button>
            ))}
          </div>
          {can('support.assign') && d?.agents?.length > 0 && (
            <div className="border-t border-ink-700 px-3 py-2 text-xs text-ink-400">
              {d.agents.slice(0, 6).map((a: any) => <span key={a.id} className="mr-3 inline-flex items-center gap-1"><StatusDot status={a.status} />{a.displayName || a.name}{a.open != null ? ` ${a.open}/${a.maxChats}` : ''}</span>)}
            </div>
          )}
        </Card>

        {/* Chat */}
        <Card className={`min-h-[60dvh] overflow-hidden ${chat ? '' : 'hidden lg:block'}`}>
          {chat ? <ChatPanel id={chat} desk={d} socket={socket} connected={connected} onChanged={reload} onBack={() => open(null)} /> : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-ink-400">Pick a chat from the queue.</div>
          )}
        </Card>

        {/* Customer */}
        {chat && (
          <Card className="max-h-[calc(100dvh-8rem)] overflow-y-auto lg:col-span-2 xl:col-span-1 xl:sticky xl:top-4">
            <CustomerPanel ticketId={chat} onAction={reload} />
          </Card>
        )}
      </div>
      {!can('support.assign') && view === 'unassigned' && tickets.length > 0 && <p className="text-xs text-ink-400">Open a chat and press “Take this chat”, or just reply: replying takes it.</p>}
    </div>
  );
}
