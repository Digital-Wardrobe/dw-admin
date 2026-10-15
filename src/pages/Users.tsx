import { useState } from 'react';
import { Search, Eye, X } from 'lucide-react';
import { useAdminApi } from '../lib/useAdminApi';
import { adminSend, API_ROOT } from '../lib/api';
import { useMe } from '../lib/me';
import { PageHeader, Card, Badge, InlineError, EmptyState, Skeleton } from '../components/ui';
import { ExportButton, th, td, fmtN, fmtUsd } from '../components/dash';

/* People, as pseudonyms (u_…). Search by pid, email, phone or username; the result is still a
   pseudonym unless your role can reveal identity (SUPERADMIN, SUPPORT), which asks why and is
   logged. Actions need a reason and are logged too. No photos, captions or messages here. */

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'neutral'> = { active: 'ok', suspended: 'bad', deactivated: 'warn', deleted: 'neutral' };
const btn = 'rounded-inner border border-ink-600 px-2.5 py-1.5 text-xs font-medium text-ink-100 transition hover:border-brand-line hover:text-brand disabled:opacity-50';

function Profile({ refId, onClose, onChanged }: { refId: string; onClose: () => void; onChanged: () => void }) {
  const { can } = useMe();
  const { data: p, error, loading, reload } = useAdminApi<any>(`users/${encodeURIComponent(refId)}`);
  const [who, setWho] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [plan, setPlan] = useState('PRO');
  const [days, setDays] = useState('30');

  const ask = (q: string) => { const r = window.prompt(q); return r && r.trim().length >= 5 ? r.trim() : (r != null && alert('Please give a short reason (5+ characters).'), null); };
  const run = async (label: string, fn: () => Promise<any>) => {
    setMsg(null);
    try { const r = await fn(); setMsg(`${label}: done${r?.emailed === false ? ' (no email on file)' : ''}.`); reload(); onChanged(); } catch (e: any) { setMsg(`${label}: ${e.message}`); }
  };
  const act = (action: string, label: string, extra: Record<string, any> = {}) => {
    const reason = ask(`${label} for ${p.pid}. Reason (goes in the audit log):`);
    if (!reason) return;
    let typed: string | null = null;
    if (action === 'delete') { typed = window.prompt(`This erases the account and everything in it. Type ${p.pid} to confirm.`); if (typed !== p.pid) return; }
    run(label, () => adminSend('POST', `users/${encodeURIComponent(refId)}/actions/${action}`, { reason, confirm: typed ?? undefined, ...extra }));
  };

  return (
    <Card className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm text-ink-50">{p?.pid || '…'}</p>
          {p && <p className="text-label text-ink-400">joined {when(p.joinedAt)} · last seen {when(p.lastSeenAt)}</p>}
        </div>
        <button onClick={onClose} className="text-ink-400 hover:text-ink-100" aria-label="Close"><X size={16} /></button>
      </div>
      {error ? <InlineError message={error} onRetry={reload} /> : loading || !p ? <Skeleton className="h-64 w-full" /> : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge><Badge tone="brand">{p.plan}</Badge>
            {p.staff && <Badge tone="warn">staff: {p.staff}</Badge>}
            <Badge>{p.platform || 'platform ?'} {p.appVersion || ''}</Badge><Badge>{p.cityTier}{p.state !== 'unknown' ? ` · ${p.state}` : ''}</Badge>
            <Badge>source: {p.source}{p.invited ? ' (invited)' : ''}</Badge>
            <Badge tone={p.settings.personalizationConsent ? 'ok' : 'neutral'}>{p.settings.personalizationConsent ? 'personalisation on' : 'personalisation off'}</Badge>
          </div>

          {who ? (
            <dl className="grid grid-cols-2 gap-2 rounded-inner border border-warn/30 bg-ink-850 p-3 text-xs">
              <div><dt className="text-ink-400">Username</dt><dd className="text-ink-100">@{who.username}</dd></div>
              <div><dt className="text-ink-400">Name</dt><dd className="text-ink-100">{who.name || '–'}</dd></div>
              <div><dt className="text-ink-400">Email</dt><dd className="break-all text-ink-100">{who.email || '–'}</dd></div>
              <div><dt className="text-ink-400">Phone</dt><dd className="text-ink-100">{who.phone || '–'}</dd></div>
              <p className="col-span-2 text-label text-warn">Shown to you because you asked; this reveal is in the audit log.</p>
            </dl>
          ) : can('users.reveal') ? (
            <button className={`${btn} inline-flex items-center gap-1`} onClick={async () => {
              const reason = ask(`Why do you need to see who ${p.pid} is? (ticket number or a sentence; logged)`);
              if (!reason) return;
              try { setWho(await adminSend('POST', `users/${encodeURIComponent(refId)}/reveal`, { reason })); } catch (e: any) { setMsg(e.message); }
            }}><Eye size={13} aria-hidden="true" /> Show who this is</button>
          ) : <p className="text-xs text-ink-400">Identity hidden: your role sees pseudonyms only.</p>}

          <dl className="grid grid-cols-3 gap-3 text-xs">
            {Object.entries(p.counts).map(([k, v]: any) => <div key={k}><dt className="text-label uppercase text-ink-400">{k}</dt><dd data-numeric className="text-ink-100">{fmtN(v)}</dd></div>)}
            <div><dt className="text-label uppercase text-ink-400">Active days (30)</dt><dd data-numeric className="text-ink-100">{fmtN(p.last30.activeDays)}</dd></div>
            <div><dt className="text-label uppercase text-ink-400">AI calls (30)</dt><dd data-numeric className="text-ink-100">{fmtN(p.last30.aiCalls)} · {fmtUsd(p.last30.aiCostUsd)}</dd></div>
            <div><dt className="text-label uppercase text-ink-400">Reports</dt><dd data-numeric className={p.reports.openAgainst ? 'text-bad' : 'text-ink-100'}>{fmtN(p.reports.against)} against · {fmtN(p.reports.made)} made</dd></div>
          </dl>

          {p.usage && (
            <div>
              <p className="mb-1 text-label uppercase text-ink-400">This period's usage ({p.usage.plan})</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                {Object.entries(p.usage.limits).map(([f, l]: any) => <li key={f} className="flex justify-between"><span className="text-ink-300">{f}</span><span data-numeric className="text-ink-100">{fmtN(l.used)}{l.limit != null ? ` / ${fmtN(l.limit)}` : ''}</span></li>)}
              </ul>
            </div>
          )}

          {!!p.entitlements.length && (
            <div>
              <p className="mb-1 text-label uppercase text-ink-400">Plans</p>
              <ul className="space-y-0.5 text-xs">{p.entitlements.map((e: any) => <li key={e.id} className="text-ink-300">{e.plan} · {e.source}{e.period ? ` · ${e.period.toLowerCase()}` : ''} · {e.status.toLowerCase()} · {when(e.startsAt)} → {e.expiresAt ? when(e.expiresAt) : 'no end'}</li>)}</ul>
            </div>
          )}

          {p.milestones && (
            <div>
              <p className="mb-1 text-label uppercase text-ink-400">Milestones</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                {[['firstItemAt', 'First item'], ['tenItemsAt', '10 items'], ['firstPlanAt', 'First outfit planned'], ['firstWearAt', 'First worn'], ['activatedAt', 'Activated'], ['firstPaywallAt', 'Saw plans'], ['firstPurchaseAt', 'First purchase']].map(([k, label]) => (
                  <li key={k} className="flex justify-between"><span className="text-ink-300">{label}</span><span className="text-ink-100">{when(p.milestones[k])}</span></li>
                ))}
              </ul>
            </div>
          )}

          {can('users.act') && p.status !== 'deleted' && (
            <div className="space-y-2 border-t border-ink-700 pt-4">
              <p className="text-label uppercase text-ink-400">Actions (each needs a reason and is logged)</p>
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)} className="h-7 rounded-inner border border-ink-600 bg-ink-800 px-1 text-xs text-ink-100">{['PLUS', 'PRO', 'STUDIO'].map((x) => <option key={x}>{x}</option>)}</select>
                <input aria-label="Days" type="number" min={1} max={366} value={days} onChange={(e) => setDays(e.target.value)} className="h-7 w-16 rounded-inner border border-ink-600 bg-ink-800 px-1 text-xs text-ink-100" />
                <span className="text-xs text-ink-400">days</span>
                <button className={btn} onClick={() => { const reason = ask(`Grant ${plan} for ${days} days to ${p.pid}. Reason:`); if (reason) run('Grant', () => adminSend('POST', `${API_ROOT}billing/admin/grant`, { ref: refId, plan, days: Number(days), note: reason })); }}>Grant</button>
                <button className={btn} onClick={() => { if (confirm(`End admin and promo grants for ${p.pid}?`)) run('Revoke', () => adminSend('POST', `${API_ROOT}billing/admin/revoke`, { ref: refId })); }}>Revoke grants</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={btn} onClick={() => act('reset-usage', 'Reset usage')}>Reset usage</button>
                {p.status === 'suspended' ? <button className={btn} onClick={() => act('unsuspend', 'Unsuspend')}>Unsuspend</button> : <button className={btn} onClick={() => act('suspend', 'Suspend')}>Suspend</button>}
                <button className={btn} onClick={() => act('force-password-reset', 'Force password reset')}>Force password reset</button>
                <button className={btn} onClick={() => act('dpdp-export', 'Email them their data (DPDP)')}>Email their data</button>
                <button className={`${btn} border-bad/40 text-bad hover:border-bad hover:text-bad`} onClick={() => act('delete', 'Delete account')}>Delete account</button>
              </div>
            </div>
          )}
          {msg && <p className="text-xs text-ink-300" role="status">{msg}</p>}
        </div>
      )}
    </Card>
  );
}

export default function Users() {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const params = { q, page, ...(status && { status }) };
  const { data, error, loading, reload } = useAdminApi<any>('users', { params });

  return (
    <>
      <PageHeader title="Users" subtitle="People appear as pseudonyms. Search by pid, email, phone or username (3+ letters). Looking someone up by email, phone or username is logged; so is every reveal and action." />
      <form className="mb-4 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(input.trim()); }}>
        <label className="relative flex-1 sm:max-w-md">
          <Search size={14} className="absolute left-2.5 top-2.5 text-ink-400" aria-hidden="true" />
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="u_… · email · phone · username" aria-label="Search people"
            className="h-9 w-full rounded-inner border border-ink-600 bg-ink-800 pl-8 pr-3 text-sm text-ink-100" />
        </label>
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 rounded-inner border border-ink-600 bg-ink-800 px-2 text-xs text-ink-100">
          <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="deleted">Deleted</option>
        </select>
        <button className="h-9 rounded-inner bg-brand px-3 text-xs font-medium text-ink-950">Search</button>
        {q && <button type="button" onClick={() => { setInput(''); setQ(''); }} className="h-9 px-2 text-xs text-ink-300 hover:text-ink-100">Clear</button>}
        <span className="ml-auto"><ExportButton path="users" params={params} table="users" /></span>
      </form>
      <div className={`grid grid-cols-1 gap-4 ${open ? 'xl:grid-cols-[1fr_440px]' : ''}`}>
        <Card className="min-w-0">
          {error ? <div className="p-4"><InlineError message={error} onRetry={reload} /></div> : loading && !data ? <Skeleton className="m-4 h-64" /> : !data?.rows.length ? (
            <div className="p-4"><EmptyState title="No one found" body={q ? 'Check the spelling, or search by pid or email.' : 'No accounts yet.'} /></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr><th className={th}>Person</th><th className={th}>Status</th><th className={th}>Plan</th><th className={th}>Joined</th><th className={th}>Last seen</th><th className={th}>Device</th><th className={`${th} text-right`}>Items</th></tr></thead>
                  <tbody>
                    {data.rows.map((r: any) => (
                      <tr key={r.pid} onClick={() => setOpen(r.ref)} className={`cursor-pointer border-t border-ink-700 hover:bg-ink-850 ${open === r.ref ? 'bg-brand-wash' : ''}`}>
                        <td className={`${td} font-mono`}><button className="hover:text-brand" onClick={(e) => { e.stopPropagation(); setOpen(r.ref); }}>{r.pid}</button>{r.staff && <Badge tone="warn">{r.staff}</Badge>}</td>
                        <td className={td}><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></td>
                        <td className={td}>{r.plan}</td>
                        <td className={`${td} text-ink-300`}>{when(r.joinedAt)}</td>
                        <td className={`${td} text-ink-300`}>{when(r.lastSeenAt)}</td>
                        <td className={`${td} text-ink-300`}>{r.platform || '–'} {r.appVersion || ''}</td>
                        <td className={`${td} text-right`} data-numeric>{fmtN(r.items)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-ink-700 px-4 py-2 text-xs text-ink-300">
                <span>{fmtN(data.total)} {q ? `matching (${data.by})` : 'people, newest first'}</span>
                {data.pages > 1 && <span className="flex items-center gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={btn}>Previous</button>
                  <span>{page} / {data.pages}</span>
                  <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className={btn}>Next</button>
                </span>}
              </div>
            </>
          )}
        </Card>
        {open && <Profile key={open} refId={open} onClose={() => setOpen(null)} onChanged={reload} />}
      </div>
    </>
  );
}
