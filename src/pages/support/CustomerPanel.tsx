import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, Lock } from 'lucide-react';
import { adminSend } from '../../lib/api';
import { useMe } from '../../lib/me';
import { Badge, InlineError, Skeleton } from '../../components/ui';
import { btnCls, inputCls, fmtN } from '../../components/dash';
import { day, money, ago, getJson } from './shared';

/* Everything this agent's access profile lets them see about the person on the chat, next to it.
   Each section has its own permission; actions sit where they're needed (give back uses next to the
   limits, retry next to a failed job). Every action is logged and the customer is told in the chat. */

const SECTION_LABEL: Record<string, string> = { account: 'Account and security', billing: 'Plans and payments', ai: 'AI usage', wardrobe: 'Wardrobe', social: 'Social and safety', privacy: 'Privacy and notifications' };
const REPORT_REASONS = ['HARASSMENT', 'SPAM', 'SCAM', 'HATE', 'NUDITY', 'VIOLENCE', 'FALSE_INFO', 'IP_VIOLATION', 'SELF_HARM', 'OTHER'];
const btnSm = `${btnCls} !px-2 !py-1`;

function Section({ id, open, toggle, children, hidden }: { id: string; open: boolean; toggle: () => void; children?: React.ReactNode; hidden?: boolean }) {
  return (
    <div className="border-b border-ink-700 last:border-0">
      <button onClick={toggle} disabled={hidden} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink-100 disabled:text-ink-500">
        {hidden ? <Lock size={13} aria-hidden="true" /> : open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        <span className="flex-1">{SECTION_LABEL[id] || id}</span>
        {hidden && <span className="text-label text-ink-500">not in your profile</span>}
      </button>
      {open && !hidden && <div className="space-y-2 px-4 pb-3 text-sm">{children}</div>}
    </div>
  );
}
const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3"><span className="text-xs text-ink-400">{k}</span><span className="text-right text-ink-100">{children}</span></div>
);
const yes = (b: boolean) => (b ? <Badge tone="ok">yes</Badge> : <Badge>no</Badge>);

export default function CustomerPanel({ ticketId, onAction }: { ticketId: string; onAction: () => void }) {
  const { can } = useMe();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ account: true, billing: true, ai: true });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [who, setWho] = useState<any>(null);
  const [form, setForm] = useState({ plan: 'PRO', days: '7', username: '', reason: 'HARASSMENT', details: '' });

  const load = useCallback(async () => {
    try { setD(await getJson(`tickets/${ticketId}/customer`)); setError(null); } catch (e: any) { setError(e.message); }
  }, [ticketId]);
  useEffect(() => { setD(null); setWho(null); setMsg(null); load(); }, [ticketId, load]);

  const act = async (action: string, body: Record<string, any> = {}, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(action); setMsg(null);
    try {
      const r = await adminSend<any>('POST', `tickets/${ticketId}/actions/${action}`, body);
      setMsg({ ok: true, text: `${r?.data?.done || 'Done'}. They’ve been told in the chat.` });
      await load(); onAction();
    } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(null); }
  };
  const allowed = (key: string) => !!d?.actions?.some((a: any) => a.key === key);
  const reveal = async () => {
    const reason = window.prompt('Why do you need to see who this is? (goes in the audit log)', `Support chat ${ticketId.slice(0, 8)}`);
    if (!reason || reason.trim().length < 5) return;
    try { setWho(await adminSend('POST', `users/${encodeURIComponent(d.person.ref)}/reveal`, { reason })); } catch (e: any) { setMsg({ ok: false, text: e.message }); }
  };

  if (error) return <div className="p-4"><InlineError message={error} onRetry={load} /></div>;
  if (!d) return <div className="p-4"><Skeleton className="h-80 w-full" /></div>;
  if (!d.person) return <p className="p-4 text-sm text-ink-400">This account no longer exists.</p>;
  const s = d.sections;
  const tog = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="text-sm">
      <div className="space-y-2 border-b border-ink-700 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span><span className="font-mono text-ink-50">{d.person.pid}</span> <span className="text-xs text-ink-400">{d.person.firstName ? `· ${d.person.firstName}` : ''}</span></span>
          <Badge tone="brand">{d.person.plan}</Badge>
        </div>
        {can('users.reveal') && !who && <button onClick={reveal} className={`${btnSm} inline-flex items-center gap-1`}><Eye size={12} aria-hidden="true" /> See who this is (logged)</button>}
        {who && <div className="rounded-inner bg-ink-850 p-2 text-xs"><p>{who.name} · @{who.username}</p><p className="text-ink-300">{who.email || 'no email'}{who.phone ? ` · ${who.phone}` : ''}</p></div>}
        {msg && <p role="status" className={`text-xs ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}
      </div>

      <Section id="account" open={!!open.account} toggle={() => tog('account')} hidden={d.hidden.includes('account')}>
        {s.account && <>
          <Row k="Status"><Badge tone={s.account.status === 'active' ? 'ok' : 'bad'}>{s.account.status}</Badge></Row>
          <Row k="Joined · last seen">{day(s.account.joinedAt)} · {s.account.lastSeenAt ? `${ago(s.account.lastSeenAt)} ago` : 'not yet'}</Row>
          <Row k="App">{[s.account.platform, s.account.appVersion].filter(Boolean).join(' ') || '–'}</Row>
          <Row k="Email verified">{yes(s.account.emailVerified)}</Row>
          <Row k="Two-step sign-in">{yes(s.account.twoFactor)}</Row>
          <Row k="Private account">{yes(s.account.private)}</Row>
          <div><p className="mb-1 text-xs text-ink-400">Signed in on {s.account.sessions.length} device{s.account.sessions.length === 1 ? '' : 's'}</p>
            {s.account.sessions.slice(0, 4).map((x: any, i: number) => <p key={i} className="text-xs text-ink-300">{x.device || x.platform || 'device'} · last used {ago(x.lastUsed)} ago</p>)}</div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {allowed('password-code') && <button className={btnSm} disabled={!!busy} onClick={() => act('password-code', {}, 'Email them a code to reset their password?')}>Email reset code</button>}
            {allowed('resend-verification') && !s.account.emailVerified && <button className={btnSm} disabled={!!busy} onClick={() => act('resend-verification')}>Resend verification</button>}
            {allowed('sign-out-everywhere') && <button className={btnSm} disabled={!!busy} onClick={() => act('sign-out-everywhere', {}, 'Sign them out on every device? This also ends their session in the app; use it when someone else may have their password.')}>Sign out everywhere</button>}
          </div>
        </>}
      </Section>

      <Section id="billing" open={!!open.billing} toggle={() => tog('billing')} hidden={d.hidden.includes('billing')}>
        {s.billing && <>
          <Row k="Plan">{s.billing.plan}{s.billing.expiresAt ? ` until ${day(s.billing.expiresAt)}` : ''}</Row>
          <Row k="Paid through">{s.billing.source || '–'}{s.billing.autoRenew === false ? ' · won’t renew' : ''}</Row>
          <Row k="Paid in total">{Object.entries(s.billing.lifetimePaid).map(([c, a]) => money({ amount: a as number, currency: c })).join(', ') || '–'}</Row>
          <Row k="Refunds">{fmtN(s.billing.refunds)}</Row>
          <div className="space-y-1.5">
            {s.billing.payments.length === 0 && <p className="text-xs text-ink-400">No payments or grants.</p>}
            {s.billing.payments.slice(0, 8).map((p: any) => (
              <div key={p.id} className="rounded-inner border border-ink-700 px-2 py-1.5 text-xs">
                <div className="flex items-center justify-between gap-2"><span className="text-ink-100">{p.plan}{p.period ? ` · ${p.period.toLowerCase()}` : ''} · {money(p.price)}</span><Badge tone={p.status === 'ACTIVE' ? 'ok' : p.status === 'REFUNDED' ? 'bad' : 'neutral'}>{p.status.toLowerCase()}</Badge></div>
                <p className="text-ink-400">{p.source} · {day(p.createdAt)}{p.orderRef ? ` · order ${p.orderRef}` : ''}{p.note ? ` · ${p.note}` : ''}</p>
                {allowed('refund') && p.status !== 'REFUNDED' && p.price && <button className={`${btnSm} mt-1`} disabled={!!busy} onClick={() => act('refund', { paymentId: p.id }, `Record this ${money(p.price)} payment as refunded? Refund it in the ${p.source === 'PLAY' ? 'Play Console' : p.source === 'APP_STORE' ? 'App Store (Apple handles refunds)' : 'Razorpay dashboard'} first.`)}>Record refund</button>}
              </div>
            ))}
          </div>
          {allowed('goodwill') && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-ink-400">Goodwill</span>
              <select aria-label="Plan" className={inputCls} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}><option>PRO</option></select>
              <input aria-label="Days" type="number" min={1} max={30} className={`${inputCls} w-16`} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
              <button className={btnSm} disabled={!!busy} onClick={() => act('goodwill', { plan: form.plan, days: Number(form.days) }, `Give ${form.days} days of ${form.plan}?`)}>Give days</button>
            </div>
          )}
        </>}
      </Section>

      <Section id="ai" open={!!open.ai} toggle={() => tog('ai')} hidden={d.hidden.includes('ai')}>
        {s.ai && <>
          <div className="space-y-1">
            {s.ai.limits.filter((l: any) => l.window !== 'total').map((l: any) => (
              <div key={l.feature} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-ink-300">{l.label}</span>
                <span className="flex items-center gap-2"><span className={l.limit != null && l.remaining === 0 ? 'text-bad' : 'text-ink-100'}>{l.used}/{l.limit ?? '∞'}</span>
                  {allowed('give-uses') && l.used > 0 && <button className={btnSm} disabled={!!busy} onClick={() => act('give-uses', { feature: l.feature }, `Give back their ${l.label}?`)}>Give back</button>}</span>
              </div>
            ))}
          </div>
          {Object.keys(s.ai.limitHits30d).length > 0 && <p className="text-xs text-ink-400">Hit limits (30 days): {Object.entries(s.ai.limitHits30d).map(([f, n]) => `${f} ×${n}`).join(', ')}</p>}
          <p className="pt-1 text-xs text-ink-400">Recent AI jobs</p>
          {s.ai.jobs.length === 0 && <p className="text-xs text-ink-500">None.</p>}
          {s.ai.jobs.slice(0, 8).map((j: any) => (
            <div key={j.id} className="flex items-start justify-between gap-2 text-xs">
              <span className="min-w-0"><span className="text-ink-100">{j.label}</span> <span className="text-ink-400">· {ago(j.createdAt)} ago</span>{j.error && <span className="block truncate text-bad" title={j.error}>{j.error}</span>}</span>
              <span className="flex shrink-0 items-center gap-1.5"><Badge tone={j.status === 'DONE' ? 'ok' : j.status === 'FAILED' || j.stuck ? 'bad' : 'neutral'}>{j.stuck ? 'stuck' : j.status.toLowerCase()}</Badge>
                {allowed('retry-job') && j.retryable && <button className={btnSm} disabled={!!busy} onClick={() => act('retry-job', { jobId: j.id })}>Retry</button>}</span>
            </div>
          ))}
        </>}
      </Section>

      <Section id="wardrobe" open={!!open.wardrobe} toggle={() => tog('wardrobe')} hidden={d.hidden.includes('wardrobe')}>
        {s.wardrobe && <>
          <Row k="Items · archived">{fmtN(s.wardrobe.items)} · {fmtN(s.wardrobe.archived)}</Row>
          <Row k="Scans">{Object.entries(s.wardrobe.looks).map(([k, n]) => `${k} ${n}`).join(' · ') || '–'}</Row>
          <Row k="Outfit plans">{fmtN(s.wardrobe.outfitPlans)}</Row>
          {s.wardrobe.stuckLooks.map((l: any) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-xs"><span className="text-bad">Scan {l.status} · {ago(l.createdAt)} ago · {l.photos} photo{l.photos === 1 ? '' : 's'}</span>
              {allowed('requeue-look') && <button className={btnSm} disabled={!!busy} onClick={() => act('requeue-look', { lookId: l.id })}>Re-queue</button>}</div>
          ))}
          {s.wardrobe.recentlyDeleted.length > 0 && (
            <div>
              <div className="flex items-center justify-between"><p className="text-xs text-ink-400">Deleted in the last 30 days ({s.wardrobe.recentlyDeleted.length})</p>
                {allowed('restore-items') && <button className={btnSm} disabled={!!busy} onClick={() => act('restore-items', {}, `Restore all ${s.wardrobe.recentlyDeleted.length} deleted items?`)}>Restore all</button>}</div>
              {s.wardrobe.recentlyDeleted.slice(0, 6).map((i: any) => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-xs"><span className="text-ink-300">{i.name}{i.brand ? ` · ${i.brand}` : ''} · {ago(i.deletedAt)} ago</span>
                  {allowed('restore-items') && <button className={btnSm} disabled={!!busy} onClick={() => act('restore-items', { itemIds: [i.id] })}>Restore</button>}</div>
              ))}
            </div>
          )}
        </>}
      </Section>

      <Section id="social" open={!!open.social} toggle={() => tog('social')} hidden={d.hidden.includes('social')}>
        {s.social && <>
          <Row k="Followers · following · posts">{fmtN(s.social.followers)} · {fmtN(s.social.following)} · {fmtN(s.social.posts)}</Row>
          <Row k="Reports about them">{s.social.reportsAgainst.open} open / {s.social.reportsAgainst.total}</Row>
          <Row k="Blocked by">{fmtN(s.social.blockedByCount)} people</Row>
          {s.social.reportsMade.length > 0 && <div><p className="text-xs text-ink-400">Reports they made</p>{s.social.reportsMade.slice(0, 5).map((r: any) => <p key={r.id} className="text-xs text-ink-300">{r.reason.toLowerCase()} · {r.against || r.contentType} · {r.status.toLowerCase()}{r.action ? ` (${r.action.replace(/_/g, ' ')})` : ''}</p>)}</div>}
          {s.social.reportsAgainst.latest.length > 0 && <div><p className="text-xs text-ink-400">Latest reports about them</p>{s.social.reportsAgainst.latest.slice(0, 5).map((r: any) => <p key={r.id} className="text-xs text-ink-300">{r.reason.toLowerCase()} · {r.status.toLowerCase()}{r.action ? ` (${r.action.replace(/_/g, ' ')})` : ''} · {day(r.createdAt)}</p>)}</div>}
          {s.social.blocked.length > 0 && (
            <div><p className="text-xs text-ink-400">They blocked ({s.social.blocked.length})</p>
              {s.social.blocked.slice(0, 6).map((b: any) => (
                <div key={b.pid} className="flex items-center justify-between text-xs"><span className="text-ink-300">@{b.username}</span>
                  {allowed('unblock') && <button className={btnSm} disabled={!!busy} onClick={() => act('unblock', { username: b.username }, `Unblock @${b.username} for them?`)}>Unblock</button>}</div>
              ))}
            </div>
          )}
          {(allowed('block') || allowed('report')) && (
            <div className="space-y-1.5 rounded-inner border border-ink-700 p-2">
              <input aria-label="Their @username" placeholder="@username of the other account" className={`${inputCls} w-full`} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <div className="flex flex-wrap gap-1.5">
                {allowed('block') && <button className={btnSm} disabled={!!busy || !form.username.trim()} onClick={() => act('block', { username: form.username }, `Block ${form.username} for them?`)}>Block for them</button>}
                {allowed('report') && <>
                  <select aria-label="Report reason" className={inputCls} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>{REPORT_REASONS.map((r) => <option key={r} value={r}>{r.toLowerCase().replace('_', ' ')}</option>)}</select>
                  <button className={btnSm} disabled={!!busy || !form.username.trim()} onClick={() => act('report', { username: form.username, reason: form.reason, details: form.details })}>Pass to moderation</button>
                </>}
              </div>
              {allowed('report') && <input aria-label="Details for moderators" placeholder="What happened (for the moderators)" className={`${inputCls} w-full`} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />}
            </div>
          )}
        </>}
      </Section>

      <Section id="privacy" open={!!open.privacy} toggle={() => tog('privacy')} hidden={d.hidden.includes('privacy')}>
        {s.privacy && <>
          <Row k="Personalisation">{yes(s.privacy.consents.personalisation)}</Row>
          <Row k="Find me (face match)">{yes(s.privacy.consents.findMe)}</Row>
          <Row k="Shopping">{yes(s.privacy.consents.shopping)}</Row>
          <Row k="Push notifications">{yes(s.privacy.notifications.push)}</Row>
          {Object.keys(s.privacy.notifications.prefs).length > 0 && <p className="text-xs text-ink-400">Off: {Object.entries(s.privacy.notifications.prefs).filter(([, v]) => v === false).map(([k]) => k).join(', ') || 'none'}</p>}
          {s.privacy.deletion && <p className="text-xs text-bad">Asked to delete their account on {day(s.privacy.deletion.requestedAt)}</p>}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {allowed('send-data-copy') && <button className={btnSm} disabled={!!busy} onClick={() => act('send-data-copy', {}, 'Email them a copy of their data (to their own address)?')}>Email data copy</button>}
            {allowed('cancel-deletion') && s.privacy.deletion && <button className={btnSm} disabled={!!busy} onClick={() => act('cancel-deletion', {}, 'Cancel their account deletion?')}>Cancel deletion</button>}
          </div>
        </>}
      </Section>

      {d.history.length > 0 && (
        <div className="px-4 py-3">
          <p className="mb-1 text-xs text-ink-400">Their other chats</p>
          {d.history.map((h: any) => <p key={h.id} className="truncate text-xs text-ink-300">{day(h.createdAt)} · {h.topicTrail || h.subject} · {h.status.toLowerCase()}{h.rating ? ` · ${'★'.repeat(h.rating)}` : ''}</p>)}
        </div>
      )}
    </div>
  );
}
