import { useState } from 'react';
import { Copy, Check, AlertTriangle } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { PageHeader, Badge, InlineError, EmptyState, Skeleton } from '../../components/ui';
import { ChartCard, th, td, fmtN, inputCls, btnCls, primaryBtnCls } from '../../components/dash';

/* Coupons, two kinds:
   - Free access: Pro or Studio free for a set time after someone redeems it. Nothing is charged.
   - Discount: percent off the first billing period of a subscription bought in Google Play. Play
     charges the offer price ("coupon-20" offer on each subscription); our server reserves the
     coupon before the Play sheet opens and matches the purchase to it, so the offer can't be used
     without a coupon. A purchase that used the offer without one is flagged below.
   Every use is in a ledger (who as a pseudonym, what was paid). Each person once, one per phone.
   Every change is in the audit log. */

type Kind = 'FREE_ACCESS' | 'DISCOUNT';
type Code = {
  id: string; code: string; kind: Kind; plan: string | null; hours: number | null; percentOff: number | null; periods: string[];
  newCustomersOnly: boolean; maxUses: number | null; startsAt: string | null; endsAt: string | null;
  active: boolean; note?: string | null; createdBy?: string | null; createdAt?: string; source: 'admin' | 'env';
  uses: number; redeemed: number; refunded: number; reserved: number; revenueMinor: number; discountMinor: number; testUses: number;
  inForce: number; status: 'live' | 'scheduled' | 'ended' | 'paused' | 'used_up';
};
type Use = {
  id: string; pid: string | null; status: string; kind: Kind; plan: string; period: string | null; platform: string | null; offerId: string | null;
  percentOff: number | null; hours: number | null; listMinor: number | null; discountMinor: number | null; paidMinor: number | null; currency: string | null;
  test: boolean; reservedUntil: string | null; redeemedAt: string | null; createdAt: string; endedAt: string | null; reviewedBy: string | null;
  expiresAt: string | null; inForce: boolean; reason?: string;
};
type Data = { codes: Code[]; plans: { plan: string; name: string }[]; periods: string[]; tiers: number[]; flagged: number };

const STATUS: Record<Code['status'], { label: string; tone: 'ok' | 'brand' | 'neutral' | 'warn' }> = {
  live: { label: 'Live', tone: 'ok' }, scheduled: { label: 'Scheduled', tone: 'brand' }, paused: { label: 'Paused', tone: 'warn' },
  used_up: { label: 'Used up', tone: 'neutral' }, ended: { label: 'Ended', tone: 'neutral' },
};
const USE_STATUS: Record<string, { label: string; tone: 'ok' | 'brand' | 'neutral' | 'warn' | 'bad' }> = {
  REDEEMED: { label: 'Used', tone: 'ok' }, RESERVED: { label: 'At checkout', tone: 'brand' }, LAPSED: { label: 'Didn’t buy', tone: 'neutral' },
  RELEASED: { label: 'Backed out', tone: 'neutral' }, REFUNDED: { label: 'Refunded', tone: 'warn' }, REVOKED: { label: 'Refunded by us', tone: 'warn' },
  FLAGGED: { label: 'Flagged', tone: 'bad' }, ALLOWED: { label: 'Allowed', tone: 'neutral' },
};
const PERIOD: Record<string, string> = { MONTHLY: 'monthly', QUARTERLY: '3 months', HALF_YEARLY: '6 months', ANNUAL: 'yearly' };
const PRESETS = [{ label: '1 hour', n: 1, unit: 'hours' }, { label: '1 day', n: 1, unit: 'days' }, { label: '7 days', n: 7, unit: 'days' }, { label: '30 days', n: 30, unit: 'days' }] as const;

const lasts = (h: number) => (h % 24 === 0 ? `${h / 24} day${h === 24 ? '' : 's'}` : `${h} hour${h === 1 ? '' : 's'}`);
const when = (v: string | null) => (v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null);
// datetime-local is the browser's local time: send it as an instant
const iso = (v: string) => (v ? new Date(v).toISOString() : null);
const money = (minor: number | null | undefined, currency = 'INR') => {
  if (minor == null) return '–';
  const n = (minor / 100).toLocaleString('en-IN', { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 });
  return currency === 'INR' ? `₹${n}` : `${currency} ${n}`;
};

function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(code).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {}); }}
      className="ml-1.5 inline-flex items-center text-ink-400 hover:text-brand" aria-label={`Copy ${code}`} title="Copy">
      {done ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
    </button>
  );
}

/** "Studio · 3 days" / "20% off · Pro yearly" */
function gives(c: Pick<Code, 'kind' | 'plan' | 'hours' | 'percentOff' | 'periods'>, planName: (p: string) => string) {
  if (c.kind === 'FREE_ACCESS') return `${planName(c.plan || '')} free · ${lasts(c.hours || 0)}`;
  const on = c.plan ? planName(c.plan) : 'any plan';
  const per = c.periods?.length ? ` ${c.periods.map((p) => PERIOD[p]).join(', ')}` : '';
  return `${c.percentOff}% off · ${on}${per}`;
}

function NewCoupon({ data, onMade }: { data: Data; onMade: (c: Code) => void }) {
  const { plans, periods, tiers } = data;
  const [kind, setKind] = useState<Kind>('DISCOUNT');
  const [f, setF] = useState({
    plan: plans.find((p) => p.plan === 'PRO') ? 'PRO' : plans[0]?.plan || 'PRO', anyPlan: true, pct: String(tiers[1] ?? tiers[0] ?? 20),
    periods: [] as string[], n: '7', unit: 'days' as 'hours' | 'days', maxUses: '', newOnly: false, startsAt: '', endsAt: '', code: '', note: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const hours = Math.round(Number(f.n || 0) * (f.unit === 'days' ? 24 : 1));
  const planName = (p: string) => plans.find((x) => x.plan === p)?.name || p;
  const discountPlan = f.anyPlan ? null : f.plan;
  const togglePeriod = (p: string) => set('periods', f.periods.includes(p) ? f.periods.filter((x) => x !== p) : [...f.periods, p]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const common = { code: f.code.trim() || undefined, maxUses: f.maxUses ? Number(f.maxUses) : null, newCustomersOnly: f.newOnly, startsAt: iso(f.startsAt), endsAt: iso(f.endsAt), note: f.note.trim() || undefined };
      const body = kind === 'FREE_ACCESS'
        ? { kind, plan: f.plan, hours, ...common }
        : { kind, plan: discountPlan, percentOff: Number(f.pct), periods: f.periods, ...common };
      const r = await adminSend<{ code: Code }>('POST', 'promo-codes', body);
      onMade({ ...r.code, kind });
      setF((x) => ({ ...x, code: '', note: '' }));
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  const summary = kind === 'FREE_ACCESS'
    ? `${planName(f.plan)} free for ${hours ? lasts(hours) : '–'} after redeeming. Nothing is charged.`
    : `${f.pct}% off the first billing period of ${discountPlan ? planName(discountPlan) : 'Pro or Studio'}${f.periods.length ? ` (${f.periods.map((p) => PERIOD[p]).join(', ')})` : ''}, charged by Google Play.`;

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="text-xs text-ink-300">Kind</legend>
        <span className="mt-2 inline-flex rounded-inner border border-ink-700 p-0.5">
          {([['DISCOUNT', 'Discount on a plan'], ['FREE_ACCESS', 'Free access']] as [Kind, string][]).map(([k, label]) => (
            <label key={k} className={`cursor-pointer rounded-[6px] px-3 py-1.5 text-sm ${kind === k ? 'bg-brand-wash font-medium text-brand' : 'text-ink-300 hover:text-ink-100'}`}>
              <input type="radio" name="coupon-kind" className="sr-only" checked={kind === k} onChange={() => setKind(k)} />{label}
            </label>
          ))}
        </span>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kind === 'DISCOUNT' ? (
          <>
            <fieldset className="text-xs text-ink-300">
              <legend>Discount on the first billing period</legend>
              <span className="mt-2 flex flex-wrap gap-3">
                {tiers.map((pct) => (
                  <label key={pct} className="inline-flex items-center gap-1.5 text-sm text-ink-100">
                    <input type="radio" name="coupon-pct" checked={f.pct === String(pct)} onChange={() => set('pct', String(pct))} />{pct}%
                  </label>
                ))}
              </span>
              <span className="mt-1.5 block text-label text-ink-400">Each is a Play offer “coupon-{f.pct}” on the subscriptions.</span>
            </fieldset>
            <fieldset className="text-xs text-ink-300">
              <legend>Plan</legend>
              <span className="mt-2 flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1.5 text-sm text-ink-100">
                  <input type="radio" name="coupon-dplan" checked={f.anyPlan} onChange={() => set('anyPlan', true)} />Any
                </label>
                {plans.map((p) => (
                  <label key={p.plan} className="inline-flex items-center gap-1.5 text-sm text-ink-100">
                    <input type="radio" name="coupon-dplan" checked={!f.anyPlan && f.plan === p.plan} onChange={() => { set('anyPlan', false); set('plan', p.plan); }} />{p.name}
                  </label>
                ))}
              </span>
            </fieldset>
            <fieldset className="text-xs text-ink-300 md:col-span-2">
              <legend>Billing (none ticked = all)</legend>
              <span className="mt-2 flex flex-wrap gap-3">
                {periods.map((p) => (
                  <label key={p} className="inline-flex items-center gap-1.5 text-sm text-ink-100">
                    <input type="checkbox" checked={f.periods.includes(p)} onChange={() => togglePeriod(p)} />{PERIOD[p] || p}
                  </label>
                ))}
              </span>
            </fieldset>
          </>
        ) : (
          <>
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
                <select aria-label="Unit" className={inputCls} value={f.unit} onChange={(e) => set('unit', e.target.value as 'hours' | 'days')}>
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
          </>
        )}
        <label className="text-xs text-ink-300">How many people (empty = no cap)
          <input type="number" min={1} max={100000} className={`${inputCls} mt-1 w-full`} placeholder="No cap" value={f.maxUses} onChange={(e) => set('maxUses', e.target.value)} />
        </label>
        <label className="text-xs text-ink-300">Code (empty = make a hard-to-guess one)
          <input maxLength={32} className={`${inputCls} mt-1 w-full font-mono uppercase`} placeholder={kind === 'DISCOUNT' ? `OFF${f.pct}-XXXXXXXX` : `${f.plan}-XXXXXXXX`} value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} />
        </label>
        <label className="text-xs text-ink-300">Can be redeemed from (empty = now)
          <input type="datetime-local" className={`${inputCls} mt-1 w-full`} value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
        </label>
        <label className="text-xs text-ink-300">Can be redeemed until (empty = no end)
          <input type="datetime-local" className={`${inputCls} mt-1 w-full`} value={f.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
        </label>
        <label className="flex items-start gap-2 text-sm text-ink-100 md:col-span-2">
          <input type="checkbox" className="mt-1" checked={f.newOnly} onChange={(e) => set('newOnly', e.target.checked)} />
          <span>New members only<span className="block text-xs text-ink-400">People who have never paid for a plan or used another coupon.</span></span>
        </label>
        <label className="text-xs text-ink-300 md:col-span-2">Note for the team (optional)
          <input maxLength={200} className={`${inputCls} mt-1 w-full`} placeholder="e.g. Diwali campaign, Instagram" value={f.note} onChange={(e) => set('note', e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className={primaryBtnCls} disabled={busy || (kind === 'FREE_ACCESS' && !hours)}>{busy ? 'Creating…' : 'Create coupon'}</button>
        <span className="text-xs text-ink-400">
          {summary}{f.maxUses ? ` First ${fmtN(Number(f.maxUses))} people.` : ''}{f.newOnly ? ' New members only.' : ''} Each person once, one per phone.
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
  const discount = c.kind === 'DISCOUNT';
  return (
    <div className="overflow-x-auto">
      {err && <p role="alert" className="mb-2 text-xs text-bad">{err}</p>}
      <table className="w-full">
        <thead>
          <tr>
            <th className={th}>Person</th><th className={th}>What</th><th className={th}>When</th>
            {discount ? <><th className={`${th} text-right`}>Price</th><th className={`${th} text-right`}>Off</th><th className={`${th} text-right`}>Paid</th></> : <th className={th}>Plan ends</th>}
            <th className={th}>Status</th><th className={th} />
          </tr>
        </thead>
        <tbody>
          {data.uses.map((u) => {
            const st = USE_STATUS[u.status] || { label: u.status, tone: 'neutral' as const };
            return (
              <tr key={u.id} className="border-t border-ink-700">
                <td className={`${td} font-mono text-xs`}>{u.pid || <span className="font-sans text-ink-400">deleted account</span>}</td>
                <td className={`${td} text-xs text-ink-300`}>{u.plan === 'STUDIO' ? 'Studio' : 'Pro'}{u.period ? ` ${PERIOD[u.period]}` : ''}{u.hours ? ` · ${lasts(u.hours)}` : ''}{u.test && <span className="ml-1.5"><Badge>test</Badge></span>}</td>
                <td className={`${td} text-xs text-ink-300`}>{when(u.redeemedAt || u.createdAt)}</td>
                {discount ? (
                  <>
                    <td className={`${td} text-right text-xs`} data-numeric>{money(u.listMinor, u.currency || 'INR')}</td>
                    <td className={`${td} text-right text-xs text-ok`} data-numeric>{u.discountMinor ? `−${money(u.discountMinor, u.currency || 'INR')}` : '–'}</td>
                    <td className={`${td} text-right text-xs font-medium`} data-numeric>{u.status === 'REDEEMED' || u.status === 'REFUNDED' || u.status === 'REVOKED' ? money(u.paidMinor, u.currency || 'INR') : '–'}</td>
                  </>
                ) : <td className={`${td} text-xs text-ink-300`}>{when(u.expiresAt) || '–'}</td>}
                <td className={td}>{!discount && u.status === 'REDEEMED' ? (u.inForce ? <Badge tone="ok">In force</Badge> : <Badge>Ended</Badge>) : <Badge tone={st.tone}>{st.label}</Badge>}</td>
                <td className={`${td} text-right`}>{!discount && u.inForce && <button onClick={() => end(u)} className="text-xs text-ink-300 hover:text-bad">End now</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-label text-ink-400">
        People are shown as pseudonyms. {discount ? '“At checkout” holds one use for 30 minutes while the Play sheet is open; “Didn’t buy” and “Backed out” don’t count. Paid is the first period; renewals are at the full price.' : ''}
      </p>
    </div>
  );
}

function Flagged({ onChanged, version }: { onChanged: () => void; version: number }) {
  // version: bumped by the page's Refresh, so this list refreshes with it
  const { data, error, reload } = useAdminApi<{ flagged: Use[] }>('promo-codes/flagged', { params: { v: version } });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const decide = async (u: Use, action: 'allow' | 'revoke') => {
    const q = action === 'revoke'
      ? `Refund ${u.pid}’s purchase in Google Play and end their plan now?\n\nThey get their money back and lose the plan.`
      : `Allow ${u.pid}’s discounted purchase? It stays as it is and leaves this list.`;
    if (!confirm(q)) return;
    setMsg(null);
    try {
      await adminSend('POST', `promo-codes/flagged/${u.id}`, { action });
      setMsg({ ok: true, text: action === 'revoke' ? 'Refunded in Google Play; the plan has ended.' : 'Allowed.' });
      reload(); onChanged();
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  };
  if (error) return <InlineError message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-16 w-full" />;
  if (!data.flagged.length) {
    return (
      <>
        {msg && <p role="status" className={`mb-2 text-xs ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}
        <p className="text-sm text-ink-400">Nothing flagged. Every discounted purchase matched a coupon.</p>
      </>
    );
  }
  return (
    <div className="overflow-x-auto">
      {msg && <p role="status" className={`mb-2 text-xs ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}
      <table className="w-full">
        <thead><tr><th className={th}>Person</th><th className={th}>Offer used</th><th className={th}>Plan</th><th className={`${th} text-right`}>Paid</th><th className={th}>When</th><th className={th} /></tr></thead>
        <tbody>
          {data.flagged.map((u) => (
            <tr key={u.id} className="border-t border-ink-700">
              <td className={`${td} font-mono text-xs`}>{u.pid || 'deleted account'}</td>
              <td className={`${td} font-mono text-xs`}>{u.offerId}{u.test && <span className="ml-1.5 font-sans"><Badge>test</Badge></span>}</td>
              <td className={`${td} text-xs`}>{u.plan === 'STUDIO' ? 'Studio' : 'Pro'}{u.period ? ` ${PERIOD[u.period]}` : ''}</td>
              <td className={`${td} text-right text-xs`} data-numeric>{money(u.paidMinor, u.currency || 'INR')}</td>
              <td className={`${td} text-xs text-ink-300`}>{when(u.createdAt)}</td>
              <td className={`${td} text-right`}>
                <span className="inline-flex gap-3">
                  <button onClick={() => decide(u, 'allow')} className="text-xs text-ink-300 hover:text-ok">Allow</button>
                  {u.platform === 'android' && <button onClick={() => decide(u, 'revoke')} className="text-xs text-ink-300 hover:text-bad">Refund &amp; end</button>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Coupons() {
  const { data, error, reload: reloadCodes } = useAdminApi<Data>('promo-codes');
  const [version, setVersion] = useState(0);
  const reload = () => { reloadCodes(); setVersion((v) => v + 1); };
  const [made, setMade] = useState<Code | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const planName = (p: string) => data?.plans.find((x) => x.plan === p)?.name || p;

  const act = async (method: 'PATCH' | 'POST' | 'DELETE', path: string, body: unknown, done: string) => {
    setMsg(null);
    try { await adminSend(method, path, body); setMsg({ ok: true, text: done }); reload(); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  };
  const end = (c: Code) => {
    if (!confirm(`Stop ${c.code} now? Nobody new can use it.`)) return;
    const everyone = c.kind === 'FREE_ACCESS' && c.inForce > 0 && confirm(`Also end ${planName(c.plan || '')} now for the ${c.inForce} ${c.inForce === 1 ? 'person' : 'people'} who still have it from this code?\n\nOK = end it for them too · Cancel = let it run out by itself`);
    act('POST', `promo-codes/${c.id}/end`, { endAccess: everyone }, everyone ? `${c.code} stopped and ended for everyone.` : `${c.code} stopped. Anyone who has it keeps it.`);
  };
  const totals = (data?.codes || []).reduce((t, c) => ({ paid: t.paid + (c.revenueMinor || 0), off: t.off + (c.discountMinor || 0) }), { paid: 0, off: 0 });

  return (
    <>
      <PageHeader title="Coupons" subtitle="Discounts on a plan (charged by Google Play) and free access. People enter them at checkout after choosing a plan, or under Plans → Have a code?. Each person once, one per phone; every use is recorded and every change is in the audit log." />

      {!!data?.flagged && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-inner border border-bad/30 bg-bad/5 px-3 py-2.5 text-sm text-ink-100">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-bad" aria-hidden="true" />
          <span>{data.flagged} store {data.flagged === 1 ? 'purchase used' : 'purchases used'} a coupon discount without a coupon. Review {data.flagged === 1 ? 'it' : 'them'} under “Flagged purchases” below.</span>
        </div>
      )}

      <ChartCard title="New coupon" caption="Discounts need the matching Play offer (coupon-10, -20, -30, -50) on each subscription they’re used with; see docs/PAYMENTS.md in the API.">
        {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-40 w-full" /> : (
          <>
            <NewCoupon data={data} onMade={(c) => { setMade(c); setMsg(null); reload(); }} />
            {made && (
              <div role="status" className="mt-4 flex flex-wrap items-center gap-2 rounded-inner border border-ok/30 px-3 py-2 text-sm text-ink-100">
                Created <span className="font-mono font-semibold text-ok">{made.code}</span><CopyCode code={made.code} />
                <span className="text-xs text-ink-300">· {gives(made, planName)}{made.maxUses ? `, up to ${fmtN(made.maxUses)} people` : ''}{made.newCustomersOnly ? ', new members only' : ''}</span>
              </div>
            )}
          </>
        )}
      </ChartCard>

      <div className="mt-6">
        <ChartCard title="All coupons"
          caption={`Newest first. Used counts everyone who used it (refunds included) and people at checkout right now. Paid through coupons: ${money(totals.paid)} · discount given: ${money(totals.off)} (store test purchases left out).`}
          actions={<button className={btnCls} onClick={reload}>Refresh</button>}>
          {msg && <p role="status" className={`mb-3 text-xs ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}
          {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-32 w-full" /> : !data.codes.length ? <EmptyState title="No coupons yet" body="Create one above." /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Code</th><th className={th}>Gives</th><th className={`${th} text-right`}>Used</th>
                    <th className={`${th} text-right`}>Paid / in force</th><th className={th}>Can be used</th><th className={th}>Status</th><th className={th} />
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
                          {(c.note || c.createdBy || env) && <span className="block max-w-xs text-xs text-ink-400">{env ? 'From the PROMO_CODES setting (local only)' : [c.note, c.createdBy && `by ${c.createdBy}`].filter(Boolean).join(' · ')}</span>}
                        </td>
                        <td className={`${td} whitespace-normal text-sm`}>
                          {gives(c, planName)}
                          {c.newCustomersOnly && <span className="block text-xs text-ink-400">New members only</span>}
                        </td>
                        <td className={`${td} text-right`} data-numeric>
                          {fmtN(c.uses)}{c.maxUses ? <span className="text-ink-400"> / {fmtN(c.maxUses)}</span> : ''}
                          {(c.reserved > 0 || c.refunded > 0) && <span className="block text-xs text-ink-400">{[c.reserved && `${c.reserved} at checkout`, c.refunded && `${c.refunded} refunded`].filter(Boolean).join(' · ')}</span>}
                        </td>
                        <td className={`${td} text-right`} data-numeric>
                          {c.kind === 'DISCOUNT'
                            ? <>{money(c.revenueMinor)}{c.discountMinor > 0 && <span className="block text-xs text-ok">−{money(c.discountMinor)}</span>}</>
                            : <>{fmtN(c.inForce)}<span className="block text-xs text-ink-400">in force</span></>}
                        </td>
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
                          <td colSpan={7} className="px-3 py-3"><Uses c={c} onChanged={reload} /></td>
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

      <div className="mt-6">
        <ChartCard title="Flagged purchases" caption="Google Play purchases that used a coupon discount (a coupon-N offer) without a coupon reserved for them, which only a tampered app can do. Allow keeps it; Refund & end refunds it in Play and ends the plan.">
          <Flagged onChanged={reloadCodes} version={version} />
        </ChartCard>
      </div>
    </>
  );
}
