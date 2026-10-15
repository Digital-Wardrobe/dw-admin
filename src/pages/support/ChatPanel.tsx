import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Lock, Eye, Sparkles, CheckCircle2, ArrowLeft, Send } from 'lucide-react';
import { adminSend } from '../../lib/api';
import { useMe } from '../../lib/me';
import { Badge, InlineError, Skeleton } from '../../components/ui';
import { btnCls, primaryBtnCls, inputCls } from '../../components/dash';
import { useDeskEvent } from '../../lib/deskSocket';
import { STATUS_LABEL, PRIORITY_LABEL, KIND_LABEL, Device, Initial, WaitingBadge, stamp, getJson, type Priority, type Status } from './shared';

/* One chat, opened on purpose (logged). The customer's messages, Kween's guided start, the team's
   replies and internal notes (yellow, never sent), system lines and action confirmations. Reply or
   write a note; "/" opens ready replies ({name} and {agent} are filled in when it's sent). */


type Desk = { me: { id: string; displayName: string | null }; agents: { id: string; name: string; displayName: string | null; status: string; open?: number }[]; macros: { id: string; title: string; body: string; topics: string[] }[]; priorities: Priority[] };

export default function ChatPanel({ id, desk, socket, connected, onChanged, onBack }: {
  id: string; desk: Desk | null; socket: Socket | null; connected: boolean; onChanged: () => void; onBack?: () => void;
}) {
  const { can } = useMe();
  const [t, setT] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [viewers, setViewers] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTyping = useRef(0);

  const load = useCallback(async () => {
    try { setT(await getJson(`tickets/${id}`)); setError(null); } catch (e: any) { setError(e.message); }
  }, [id]);
  useEffect(() => { setT(null); setText(''); setMsg(null); setMode('reply'); load(); }, [id, load]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [t?.messages?.length, typing]);

  // Live: join this chat's room
  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit('desk:watch', { ticketId: id });
    return () => { socket.emit('desk:unwatch', { ticketId: id }); };
  }, [id, connected, socket]);
  useDeskEvent(socket, 'desk:message', (p: any) => {
    if (p?.ticketId !== id || !p.message) return;
    setT((c: any) => (c && !c.messages.some((m: any) => m.id === p.message.id) ? { ...c, messages: [...c.messages, p.message] } : c));
    if (p.message.author === 'user') setTyping(null);
  });
  useDeskEvent(socket, 'desk:typing', (p: any) => {
    if (p?.ticketId !== id) return;
    const who = p.who === 'customer' ? 'Customer' : p.who;
    setTyping(p.isTyping ? `${who}${p.internal ? ' (note)' : ''}` : null);
  });
  useDeskEvent(socket, 'desk:viewers', (p: any) => { if (p?.ticketId === id) setViewers((p.viewers || []).filter((n: string) => n !== desk?.me.displayName)); });
  useDeskEvent(socket, 'desk:ticket', (p: any) => { if (p?.id === id && ['status', 'assigned', 'rated'].includes(p.change)) load(); });

  const emitTyping = (on: boolean) => {
    const s = socket;
    if (!s) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (!on) { s.emit('desk:typing', { ticketId: id, isTyping: false, internal: mode === 'note' }); return; }
    if (Date.now() - lastTyping.current > 2500) { lastTyping.current = Date.now(); s.emit('desk:typing', { ticketId: id, isTyping: true, internal: mode === 'note' }); }
    typingTimer.current = setTimeout(() => s.emit('desk:typing', { ticketId: id, isTyping: false, internal: mode === 'note' }), 3500);
  };

  const run = async (key: string, fn: () => Promise<any>, done: string) => {
    setBusy(key); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: done }); await load(); onChanged(); return true; } catch (e: any) { setMsg({ ok: false, text: e.message }); return false; } finally { setBusy(null); }
  };
  const send = async (resolve = false) => {
    if (!text.trim()) return;
    const ok = await run(resolve ? 'send-resolve' : 'send', () => adminSend('POST', `tickets/${id}/messages`, { text, internal: mode === 'note', ...(resolve && { status: 'RESOLVED' }) }),
      mode === 'note' ? 'Note added (only the team sees it).' : resolve ? 'Sent and resolved. They’ll be asked to rate the chat.' : 'Sent.');
    if (ok) { setText(''); emitTyping(false); }
  };
  const setStatus = (status: Status, done: string) => run(status, () => adminSend('PATCH', `tickets/${id}`, { status }), done);
  const setPriority = (priority: Priority) => run('priority', () => adminSend('PATCH', `tickets/${id}`, { priority }), `Priority: ${PRIORITY_LABEL[priority]}.`);
  const assign = (to: string | null) => run('assign', () => adminSend('POST', `tickets/${id}/assign`, { to }), to === 'me' ? 'It’s yours. They see you join.' : to ? 'Reassigned.' : 'Unassigned.');

  // Ready replies: "/" at the start of the box filters them
  const slash = text.startsWith('/') ? text.slice(1).toLowerCase() : null;
  const macros = useMemo(() => {
    const all = desk?.macros || [];
    const topic = t?.topic || '';
    const ranked = [...all].sort((a, b) => Number(b.topics.some((x) => topic.startsWith(x))) - Number(a.topics.some((x) => topic.startsWith(x))));
    return slash == null ? ranked : ranked.filter((m) => `${m.title} ${m.body}`.toLowerCase().includes(slash));
  }, [desk?.macros, slash, t?.topic]);
  const applyMacro = (m: { id: string; body: string }) => {
    setText((cur) => (cur.startsWith('/') || !cur.trim() ? m.body : `${cur.trim()}\n\n${m.body}`));
    adminSend('POST', `support/macros/${m.id}/used`).catch(() => {});
  };

  if (error) return <div className="p-5"><InlineError message={error} onRetry={load} /></div>;
  if (!t) return <div className="p-5"><Skeleton className="h-96 w-full" /></div>;
  const open = t.status === 'OPEN' || t.status === 'IN_PROGRESS';
  const canAssign = can('support.assign');
  const preview = (s: string) => s.replace(/\{name\}/g, t.user?.firstName || 'there').replace(/\{agent\}/g, desk?.me.displayName || 'Fluntr support');

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="space-y-2 border-b border-ink-700 px-4 py-3">
        <div className="flex items-start gap-2">
          {onBack && <button onClick={onBack} className="mt-0.5 text-ink-400 hover:text-ink-100 lg:hidden" aria-label="Back to the queue"><ArrowLeft size={16} /></button>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-50">{t.subject}</p>
            <p className="truncate text-xs text-ink-400">{t.topicTrail || KIND_LABEL[t.kind] || t.kind}</p>
          </div>
          <Badge tone={open ? 'warn' : 'ok'}>{STATUS_LABEL[t.status as Status]}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="sr-only" htmlFor="prio">Priority</label>
          <select id="prio" className={inputCls} value={t.priority} onChange={(e) => setPriority(e.target.value as Priority)} disabled={busy !== null}>
            {(desk?.priorities || ['urgent', 'high', 'normal', 'low']).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p as Priority]} priority</option>)}
          </select>
          {canAssign ? (
            <select aria-label="Assigned to" className={inputCls} value={t.assigneeId || ''} onChange={(e) => assign(e.target.value || null)} disabled={busy !== null}>
              <option value="">Unassigned</option>
              {(desk?.agents || []).map((a) => <option key={a.id} value={a.id}>{a.displayName || a.name}{a.id === desk?.me.id ? ' (you)' : ''} · {a.status}</option>)}
              {t.assigneeId && !(desk?.agents || []).some((a) => a.id === t.assigneeId) && <option value={t.assigneeId}>{t.assigneeName}</option>}
            </select>
          ) : t.assigneeId ? <span className="inline-flex items-center gap-1.5 text-ink-300"><Initial name={t.assigneeName} size="h-5 w-5 text-[10px]" />{t.mine ? 'Yours' : t.assigneeName}</span>
            : <button className={btnCls} onClick={() => assign('me')} disabled={busy !== null}>Take this chat</button>}
          <WaitingBadge on={t.waitingOn} since={t.waitingOn === 'us' ? (t.lastUserMessageAt || t.createdAt) : null} />
          <Device d={t.device} />
          <span className="ml-auto flex gap-1.5">
            {open && <button className={btnCls} disabled={busy !== null} onClick={() => setStatus('RESOLVED', 'Resolved. They’ll be asked to rate the chat.')}>Resolve</button>}
            {open && <button className={btnCls} disabled={busy !== null} onClick={() => { if (confirm('Close without replying? Use this for spam or duplicates; they aren’t told.')) setStatus('CLOSED', 'Closed without a reply.'); }}>Close</button>}
            {!open && <button className={btnCls} disabled={busy !== null} onClick={() => setStatus('OPEN', 'Reopened.')}>Reopen</button>}
          </span>
        </div>
        {viewers.length > 0 && <p className="flex items-center gap-1.5 text-label text-warn"><Eye size={12} aria-hidden="true" />{viewers.join(', ')} {viewers.length === 1 ? 'is' : 'are'} also looking at this chat</p>}
        <p className="text-label text-ink-500">Opening a chat is logged. Use what’s here only to help them.</p>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {t.ref && (
          <div className="flex items-center gap-3 rounded-inner border border-ink-700 bg-ink-850 px-3 py-2 text-sm">
            <span className="text-label uppercase text-ink-400">{t.ref.type === 'payment' ? 'Payment' : t.ref.type === 'look' ? 'Scan' : 'Studio shot'}</span>
            <span className="min-w-0 flex-1 truncate text-ink-100">{t.ref.title}{t.ref.subtitle ? ` · ${t.ref.subtitle}` : ''}</span>
            {t.ref.status && <Badge>{String(t.ref.status).toLowerCase()}</Badge>}
          </div>
        )}
        {t.messages.map((m: any) => {
          if (m.author === 'system') {
            const action = m.payload?.event === 'action';
            return (
              <div key={m.id} className={`mx-auto flex max-w-[90%] items-start justify-center gap-1.5 text-center text-xs ${m.internal ? 'text-warn' : action ? 'text-ok' : 'text-ink-400'}`}>
                {action && <CheckCircle2 size={13} className="mt-0.5 shrink-0" aria-hidden="true" />}
                <span>{action ? <><b className="font-medium">{m.payload.label}</b> by {m.payload.by}: </> : null}{m.text}<span className="ml-1.5 text-ink-500">{stamp(m.createdAt)}</span></span>
              </div>
            );
          }
          const staff = m.author === 'staff';
          const bot = m.author === 'bot';
          return (
            <div key={m.id} className={`flex ${staff ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[82%] flex-col ${staff ? 'items-end' : 'items-start'}`}>
                <span className="mb-0.5 flex items-center gap-1 text-label text-ink-400">
                  {m.internal && <Lock size={11} aria-hidden="true" />}
                  {bot && <Sparkles size={11} aria-hidden="true" />}
                  {staff ? `${m.internal ? 'Internal note · ' : ''}${m.agentName || 'Fluntr support'}${m.staffName ? ` (${m.staffName})` : ''}` : bot ? 'Kween (guided start)' : t.user?.firstName || 'Customer'} · {stamp(m.createdAt)}
                </span>
                {m.text && <p className={`whitespace-pre-wrap rounded-card px-3 py-2 text-sm ${m.internal ? 'border border-warn/40 bg-warn/10 text-ink-50' : staff ? 'bg-brand/15 text-ink-50' : bot ? 'bg-ink-850 text-ink-300' : 'bg-ink-800 text-ink-50 ring-1 ring-ink-700'}`}>{m.text}</p>}
                {m.attachments?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {m.attachments.map((src: string, i: number) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer" title="Open full size">
                        <img src={src} loading="lazy" referrerPolicy="no-referrer" alt={`Attachment ${i + 1}`} className="h-32 w-24 rounded-inner border border-ink-700 bg-ink-850 object-contain" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {typing && <p className="text-xs italic text-ink-400">{typing} is typing…</p>}
        {t.rating && (
          <div className="mx-auto max-w-[90%] rounded-inner border border-ink-700 px-3 py-2 text-center text-xs text-ink-300">
            Rated <span className="text-warn">{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</span>{t.ratingTags?.length ? ` · ${t.ratingTags.join(', ').replace(/_/g, ' ')}` : ''}
            {t.ratingComment && <p className="mt-1 whitespace-pre-wrap text-ink-200">“{t.ratingComment}”</p>}
          </div>
        )}
        <div ref={end} />
      </div>

      {/* Composer */}
      <div className="space-y-2 border-t border-ink-700 px-4 py-3">
        {t.user?.deleted ? <p className="text-xs text-ink-400">This account has been deleted, so a reply can’t reach them. You can still add internal notes.</p> : null}
        <div className="flex items-center gap-1 text-xs" role="tablist" aria-label="Reply or note">
          <button role="tab" aria-selected={mode === 'reply'} onClick={() => setMode('reply')} className={`rounded-inner px-2.5 py-1 ${mode === 'reply' ? 'bg-ink-700 text-ink-50' : 'text-ink-400 hover:text-ink-100'}`}>Reply</button>
          <button role="tab" aria-selected={mode === 'note'} onClick={() => setMode('note')} className={`inline-flex items-center gap-1 rounded-inner px-2.5 py-1 ${mode === 'note' ? 'bg-warn/15 text-warn' : 'text-ink-400 hover:text-ink-100'}`}><Lock size={11} aria-hidden="true" /> Internal note</button>
          <select aria-label="Ready replies" className={`${inputCls} ml-auto max-w-[45%]`} value="" onChange={(e) => { const m = (desk?.macros || []).find((x) => x.id === e.target.value); if (m) applyMacro(m); }}>
            <option value="">Ready replies… (or type /)</option>
            {macros.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </div>
        {slash != null && macros.length > 0 && (
          <ul className="max-h-40 overflow-y-auto rounded-inner border border-ink-700 bg-ink-850 text-sm" role="listbox" aria-label="Matching ready replies">
            {macros.slice(0, 6).map((m) => (
              <li key={m.id}><button type="button" onClick={() => applyMacro(m)} className="block w-full px-3 py-1.5 text-left hover:bg-ink-800"><span className="text-ink-100">{m.title}</span><span className="block truncate text-xs text-ink-400">{preview(m.body)}</span></button></li>
            ))}
          </ul>
        )}
        <textarea rows={3} maxLength={4000} value={text} aria-label={mode === 'note' ? 'Internal note' : 'Reply'}
          onChange={(e) => { setText(e.target.value); emitTyping(!!e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(false); }}
          placeholder={mode === 'note' ? 'Only the team sees this.' : open ? `Reply as ${desk?.me.displayName || 'Fluntr support'}. They get it live and as a notification.` : 'Replying reopens this chat.'}
          className={`w-full rounded-inner border px-3 py-2 text-sm text-ink-100 transition focus:border-brand ${mode === 'note' ? 'border-warn/50 bg-warn/5' : 'border-ink-600 bg-ink-800 hover:border-brand-line'}`} />
        <div className="flex flex-wrap items-center gap-2">
          <button className={`${primaryBtnCls} inline-flex items-center gap-1.5`} disabled={busy !== null || !text.trim() || (mode === 'reply' && t.user?.deleted)} onClick={() => send(false)} title="Ctrl/⌘ + Enter">
            <Send size={13} aria-hidden="true" />{mode === 'note' ? 'Add note' : 'Send'}
          </button>
          {mode === 'reply' && open && <button className={btnCls} disabled={busy !== null || !text.trim() || t.user?.deleted} onClick={() => send(true)}>Send and resolve</button>}
          {!desk?.me.displayName && <span className="text-label text-ink-400">Set your display name (top of the page) so customers see who they’re talking to.</span>}
          {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</span>}
        </div>
      </div>
    </div>
  );
}

