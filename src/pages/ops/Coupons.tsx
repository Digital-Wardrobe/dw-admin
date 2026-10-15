import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { PageHeader, Badge, InlineError, EmptyState, Skeleton } from '../../components/ui';
import { ChartCard, th, td, fmtN, inputCls, btnCls, primaryBtnCls } from '../../components/dash';

/* Coupons: codes that unlock Pro or Studio for a set time, once per person. Pick the plan, how
   long it lasts after someone redeems it (hours or days), how many people can use it, and the
   window it can be redeemed in. People type the code in the app (Plans → Have a code?, or at
   checkout). Uses are shown as pseudonyms; every change is in the audit log. */

type Code = {
  id: string; code: string; plan: string; hours: number; maxUses: number | null; startsAt: string | null; endsAt: string | null;
  active: boolean; note?: string | null; createdBy?: string | null; createdAt?: string; source: 'admin' | 'env';
  uses: number; inForce: number; status: 'live' | 'scheduled' | 'ended' | 'paused' | 'used_up';
};
type Use = { id: string; pid: string; plan: string; redeemedAt: string; expiresAt: string | null; inForce: boolean };

const STATUS: Record<Code['status'], { label: string; tone: 'ok' | 'brand' | 'neutral' | 'warn' }> = {
  live: { label: 'Live', tone: 'ok' }, scheduled: { label: 'Scheduled', tone: 'brand' }, paused: { label: 'Paused', tone: 'warn' },
  used_up: { label: 'Used up', tone: 'neutral' }, ended: { label: 'Ended', tone: 'neutral' },
};
const PRESETS = [{ label: '1 hour', n: 1, unit: 'hours' }, { label: '1 day', n: 1, unit: 'days' }, { label: '7 days', n: 7, unit: 'days' }, { label: '30 days', n: 30, unit: 'days' }] as const;

const lasts = (h: number) => (h % 24 === 0 ? `${h / 24} day${h === 24 ? '' : 's'}` : `${h} hour${h === 1 ? '' : 's'}`);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null);
// datetime-local is the browser's local time: send it as an instant
const iso = (v: string) => (v ? new Date(v).toISOString() : null);

function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(code).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {}); }}
      className="ml-1.5 inline-flex items-center text-ink-400 hover:text-brand" aria-label={`Copy ${code}`} title="Copy">
      {done ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
    </button>
  );
}

function NewCoupon({ plans, onMade }: { plans: { plan: string; name: string }[]; onMade: (c: Code) => void }) {
  const [f, setF] = useState({ plan: plans.find((p) => p.plan === 'STUDIO') ? 'STUDIO' : plans[0]?.plan || 'PRO', n: '7', unit: 'days' as 'hours' | 'days', maxUses: '', startsAt: '', endsAt: '', code: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const hours = Math.round(Number(f.n || 0) * (f.unit === 'days' ? 24 : 1));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const r = await adminSend<{ code: Code }>('POST', 'promo-codes', {
        code: f.code.trim() || undefined, plan: f.plan, hours,
        maxUses: f.maxUses ? Number(f.maxUses) : null, startsAt: iso(f.startsAt), endsAt: iso(f.endsAt), note: f.note.trim() || undefined,
      });
      onMade(r.code);
      setF((x) => ({ ...x, code: '', note: '' }));
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <fieldset className="text-xs text-ink-300">
          <legend>Plan it unlocks</legend>
          <span className="mt-2 flex gap-3">
            {plans.map((p) => (
              <label key={p.plan} className="inline-flex items-center gap-1.5 text-sm text-ink-100">
                <input type="radio" name="coupon-plan" checked={f.plan === p.plan} onChange={() => set('plan', p.plan)} />{p.name}
              </label>
            ))}
          </span>
        </fieldset>
        <div className="text-xs text-ink-300">
          <label htmlFor="coupon-length">How long the plan lasts</label>
          <span className="mt-1 flex gap-2">
            <input id="coupon-length" type="number" min={1} max={f.unit === 'days' ? 366 : 8784} required className={`${inputCls} w-20`} value={f.n} onChange={(e) => set('n', e.target.value)} />
            <select aria-label="Unit" className={inputCls} value={f.unit} onChange={(e) => set('unit', e.target.value)}>
              <option value="hours">hours</option><option value="days">days</option>
            </select>
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => setF((x) => ({ ...x, n: String(p.n), unit: p.unit }))}
                className={`rounded-full border px-2 py-0.5 text-label ${f.n === String(p.n) && f.unit === p.unit ? 'border-brand-line text-brand' : 'border-ink-600 text-ink-300 hover:text-ink-100'}`}>{p.label}</button>
            ))}
          </span>
        </div>
        <label className="text-xs text-ink-300">How many people (empty = no cap)
          <input type="number" min={1} max={100000} className={`${inputCls} mt-1 w-full`} placeholder="No cap" value={f.maxUses} onChange={(e) => set('maxUses', e.target.value)} />
        </label>
        <label className="text-xs text-ink-300">Code (empty = make one)
          <input maxLength={32} className={`${inputCls} mt-1 w-full font-mono uppercase`} placeholder={`${f.plan}-XXXXXX`} value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} />
        </label>
        <label className="text-xs text-ink-300">Can be redeemed from (empty = now)
          <input type="datetime-local" className={`${inputCls} mt-1 w-full`} value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
        </label>
        <label className="text-xs text-ink-300">Can be redeemed until (empty = no end)
          <input type="datetime-local" className={`${inputCls} mt-1 w-full`} value={f.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
        </label>
        <label className="text-xs text-ink-300 md:col-span-2">Note for the team (optional)
          <input maxLength={200} className={`${inputCls} mt-1 w-full`} placeholder="e.g. QA testers, Studio flows" value={f.note} onChange={(e) => set('note', e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className={primaryBtnCls} disabled={busy || !hours}>{busy ? 'Creating…' : 'Create coupon'}</button>
        <span className="text-xs text-ink-400">
          {plans.find((p) => p.plan === f.plan)?.name} for {hours ? lasts(hours) : '–'} after redeeming{f.maxUses ? `, first ${fmtN(Number(f.maxUses))} people` : ''}. Each person can use it once.
        </span>
        {err && <span role="alert" className="text-xs text-bad">{err}</span>}
      </div>
    </form>
  );
}

function Uses({ c, onChanged }: { c: Code; onChanged: () => void }) {
  const { data, error, reload } = useAdminApi<{ uses: Use[] }>(`promo-codes/${c.id}/uses`);
  const [err, setErr] = useState<string | null>(null);
  const end = async (u: Use) => {
    if (!confirm(`End ${u.pid}’s ${c.plan === 'STUDIO' ? 'Studio' : 'Pro'} from this code now? They go back to their own plan.`)) return;
    setErr(null);
    try { await adminSend('POST', `promo-codes/${c.id}/uses/${u.id}/end`); reload(); onChanged(); } catch (x) { setErr((x as Error).message); }
  };
  if (error) return <InlineError message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-16 w-full" />;
  if (!data.uses.length) return <p className="text-xs text-ink-400">Nobody has used this code yet.</p>;
  return (
    <div className="overflow-x-auto">
      {err && <p role="alert" className="mb-2 text-xs text-bad">{err}</p>}
      <table className="w-full">
        <thead><tr><th className={th}>Person</th><th className={th}>Redeemed</th><th className={th}>Plan ends</th><th className={th}>Now</th><th className={th} /></tr></thead>
        <tbody>
          {data.uses.map((u) => (
            <tr key={u.id} className="border-t border-ink-700">
              <td className={`${td} font-mono text-xs`}>{u.pid}</td>
              <td className={`${td} text-xs text-ink-300`}>{when(u.redeemedAt)}</td>
              <td className={`${td} text-xs text-ink-300`}>{when(u.expiresAt) || 'no end'}</td>
              <td className={td}>{u.inForce ? <Badge tone="ok">In force</Badge> : <Badge>Ended</Badge>}</td>
              <td className={`${td} text-right`}>{u.inForce && <button onClick={() => end(u)} className="text-xs text-ink-300 hover:text-bad">End now</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-label text-ink-400">People are shown as pseudonyms. Look one up in Users to see more.</p>
    </div>
  );
}

export default function Coupons() {
  const { data, error, reload } = useAdminApi<{ codes: Code[]; plans: { plan: string; name: string }[] }>('promo-codes');
  const [made, setMade] = useState<Code | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const planName = (p: string) => data?.plans.find((x) => x.plan === p)?.name || p;

  const act = async (method: 'PATCH' | 'POST' | 'DELETE', path: string, body: unknown, done: string) => {
    setMsg(null);
    try { await adminSend(method, path, body); setMsg({ ok: true, text: done }); reload(); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  };
  const end = (c: Code) => {
    if (!confirm(`Stop ${c.code} now? Nobody new can redeem it.`)) return;
    const everyone = c.inForce > 0 && confirm(`Also end ${planName(c.plan)} now for the ${c.inForce} ${c.inForce === 1 ? 'person' : 'people'} who still have it from this code?\n\nOK = end it for them too · Cancel = let it run out by itself`);
    act('POST', `promo-codes/${c.id}/end`, { endAccess: everyone }, everyone ? `${c.code} stopped and ended for everyone.` : `${c.code} stopped. Anyone who has it keeps it until it runs out.`);
  };

  return (
    <>
      <PageHeader title="Coupons" subtitle="Codes that unlock Pro or Studio for a set time, once per person. People enter them in the app under Plans → Have a code?, or at checkout. Every change is in the audit log." />
      <ChartCard title="New coupon" caption="For testing or for people you invite. The plan starts when someone redeems the code and ends by itself; nothing is charged.">
        {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-40 w-full" /> : (
          <>
            <NewCoupon plans={data.plans} onMade={(c) => { setMade(c); setMsg(null); reload(); }} />
            {made && (
              <div role="status" className="mt-4 flex flex-wrap items-center gap-2 rounded-inner border border-ok/30 px-3 py-2 text-sm text-ink-100">
                Created <span className="font-mono font-semibold text-ok">{made.code}</span><CopyCode code={made.code} />
                <span className="text-xs text-ink-300">· {planName(made.plan)} for {lasts(made.hours)}{made.maxUses ? `, up to ${fmtN(made.maxUses)} people` : ''}</span>
              </div>
            )}
          </>
        )}
      </ChartCard>

      <div className="mt-6">
        <ChartCard title="All coupons" caption="Newest first. Used = people who redeemed it; in force = people who still have the plan from it right now." actions={<button className={btnCls} onClick={reload}>Refresh</button>}>
          {msg && <p role="status" className={`mb-3 text-xs ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}
          {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-32 w-full" /> : !data.codes.length ? <EmptyState title="No coupons yet" body="Create one above." /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Code</th><th className={th}>Plan</th><th className={th}>Lasts</th><th className={`${th} text-right`}>Used</th>
                    <th className={`${th} text-right`}>In force</th><th className={th}>Can be redeemed</th><th className={th}>Status</th><th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {data.codes.map((c) => {
                    const st = STATUS[c.status];
                    const env = c.source === 'env';
                    return [
                      <tr key={c.id} className="border-t border-ink-700 align-top">
                        <td className={`${td} whitespace-normal`}>
                          <span className="font-mono font-medium">{c.code}</span><CopyCode code={c.code} />
                          {(c.note || c.createdBy || env) && <span className="block max-w-xs text-xs text-ink-400">{env ? 'From the PROMO_CODES server setting' : [c.note, c.createdBy && `by ${c.createdBy}`].filter(Boolean).join(' · ')}</span>}
                        </td>
                        <td className={td}>{planName(c.plan)}</td>
                        <td className={td}>{lasts(c.hours)}</td>
                        <td className={`${td} text-right`} data-numeric>{fmtN(c.uses)}{c.maxUses ? <span className="text-ink-400"> / {fmtN(c.maxUses)}</span> : ''}</td>
                        <td className={`${td} text-right`} data-numeric>{fmtN(c.inForce)}</td>
                        <td className={`${td} text-xs text-ink-300`}>
                          {c.startsAt || c.endsAt ? <>{c.startsAt ? `from ${when(c.startsAt)}` : 'now'}{c.endsAt ? ` until ${when(c.endsAt)}` : ', no end'}</> : 'any time'}
                        </td>
                        <td className={td}><Badge tone={st.tone}>{st.label}</Badge></td>
                        <td className={`${td} text-right`}>
                          <span className="inline-flex flex-wrap justify-end gap-x-3 gap-y-1">
                            <button onClick={() => setOpen(open === c.id ? null : c.id)} className="text-xs text-ink-300 hover:text-brand" aria-expanded={open === c.id}>Who used it</button>
                            {!env && c.status !== 'ended' && (c.active
                              ? <button onClick={() => act('PATCH', `promo-codes/${c.id}`, { active: false }, `${c.code} paused.`)} className="text-xs text-ink-300 hover:text-warn">Pause</button>
                              : <button onClick={() => act('PATCH', `promo-codes/${c.id}`, { active: true }, `${c.code} live again.`)} className="text-xs text-ink-300 hover:text-ok">Resume</button>)}
                            {!env && c.status !== 'ended' && <button onClick={() => end(c)} className="text-xs text-ink-300 hover:text-bad">End</button>}
                            {!env && c.uses === 0 && <button onClick={() => { if (confirm(`Delete ${c.code}?`)) act('DELETE', `promo-codes/${c.id}`, undefined, `${c.code} deleted.`); }} className="text-xs text-ink-300 hover:text-bad">Delete</button>}
                          </span>
                        </td>
                      </tr>,
                      open === c.id && (
                        <tr key={`${c.id}-uses`} className="bg-ink-850">
                          <td colSpan={8} className="px-3 py-3"><Uses c={c} onChanged={reload} /></td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>
    </>
  );
}
