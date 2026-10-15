import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { useMe } from '../../lib/me';
import { humanise } from '../../lib/names';
import { PageHeader, InlineError, EmptyState, Skeleton } from '../../components/ui';
import { DashControls, useDashParams, ChartCard, ExportButton, FunnelBars, fmtN, fmtDay, inputCls, btnCls, primaryBtnCls } from '../../components/dash';

/* Funnels for people who signed up in the range: onboarding, building a closet, and getting to
   paying, plus funnels you build from any event or first-time milestone (saved for everyone). */

type Step = { event?: string; milestone?: string };
const enc = (s: Step) => (s.milestone ? `m:${s.milestone}` : `e:${s.event}`);
const dec = (v: string): Step => (v.startsWith('m:') ? { milestone: v.slice(2) } : { event: v.slice(2) });

function CustomFunnel({ query, events, milestones, saved, reloadSaved }: { query: Record<string, string>; events: string[]; milestones: { key: string; label: string }[]; saved: any[]; reloadSaved: () => void }) {
  const { me, can } = useMe();
  const [steps, setSteps] = useState<Step[]>([{ milestone: 'first_item' }, { milestone: 'ten_items' }, { event: 'outfit_plan' }]);
  const [windowDays, setWindowDays] = useState(14);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const label = (s: Step) => (s.milestone ? milestones.find((m) => m.key === s.milestone)?.label || s.milestone : humanise(s.event || ''));

  const run = async () => {
    setBusy(true); setErr(null);
    try { setResult(await adminSend('POST', 'behaviour/funnels/run', { ...query, steps, windowDays })); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setErr(null);
    try { await adminSend('POST', 'behaviour/funnels', { name, steps: steps.map((s) => ({ ...s, label: label(s) })) }); setName(''); reloadSaved(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setErr(null);
    try { await adminSend('DELETE', `behaviour/funnels/${id}`); reloadSaved(); } catch (e: any) { setErr(e.message); }
  };

  return (
    <ChartCard title="Build a funnel" caption="People who signed up in the range (at most 90 days). Each step has to happen after the one before, within the window after sign-up. Counts and median waits only.">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="space-y-2 xl:col-span-2">
          <p className="text-xs text-ink-400">1. Signed up</p>
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-4 text-xs text-ink-400">{i + 2}.</span>
              <select aria-label={`Step ${i + 2}`} className={`${inputCls} min-w-0 flex-1`} value={enc(s)} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? dec(e.target.value) : x)))}>
                <optgroup label="First time…">{milestones.map((m) => <option key={m.key} value={`m:${m.key}`}>{m.label}</option>)}</optgroup>
                <optgroup label="Any time they…">{events.map((ev) => <option key={ev} value={`e:${ev}`}>{humanise(ev)}</option>)}</optgroup>
              </select>
              <button aria-label={`Remove step ${i + 2}`} className="text-ink-400 hover:text-bad disabled:opacity-40" disabled={steps.length <= 1} onClick={() => setSteps(steps.filter((_, j) => j !== i))}><X size={14} aria-hidden="true" /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button className={btnCls} disabled={steps.length >= 6} onClick={() => setSteps([...steps, { event: 'outfit_worn' }])}><Plus size={13} aria-hidden="true" /> Add step</button>
            <label className="flex items-center gap-1.5 text-xs text-ink-300">within
              <input type="number" min={1} max={30} aria-label="Window in days" className={`${inputCls} w-16`} value={windowDays} onChange={(e) => setWindowDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} /> days
            </label>
            <button className={primaryBtnCls} disabled={busy} onClick={run}>{busy ? 'Running…' : 'Run'}</button>
          </div>
          <div className="flex items-center gap-2 border-t border-ink-700 pt-3">
            <input aria-label="Funnel name" maxLength={60} placeholder="name, to save it for everyone" className={`${inputCls} min-w-0 flex-1`} value={name} onChange={(e) => setName(e.target.value)} />
            <button className={btnCls} disabled={busy || !name.trim()} onClick={save}>Save</button>
          </div>
          {err && <p className="text-xs text-bad">{err}</p>}
          {!!saved.length && (
            <div className="border-t border-ink-700 pt-3">
              <p className="mb-1 text-label uppercase text-ink-400">Saved funnels</p>
              <ul className="space-y-1">
                {saved.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-sm">
                    <button className="min-w-0 flex-1 truncate text-left text-brand hover:underline" onClick={() => { setSteps(f.steps.map((s: any) => (s.milestone ? { milestone: s.milestone } : { event: s.event }))); setResult(null); }} title={f.steps.map((s: any) => s.label).join(' → ')}>{f.name}</button>
                    <span className="text-label text-ink-400">{f.createdBy}</span>
                    {(f.createdBy === me?.name || can('ops.write')) && <button aria-label={`Delete ${f.name}`} className="text-ink-400 hover:text-bad" onClick={() => remove(f.id)}><Trash2 size={13} aria-hidden="true" /></button>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="xl:col-span-3">
          {!result ? <EmptyState title="Pick steps and run" body="The result shows how many people reached each step and the median wait from the step before." /> : (
            <>
              <p className="mb-3 text-xs text-ink-400">{fmtN(result.signups)} people signed up {fmtDay(result.range.from)}–{fmtDay(result.range.to)}; steps within {result.windowDays} days of signing up.</p>
              <FunnelBars steps={result.steps} />
            </>
          )}
        </div>
      </div>
    </ChartCard>
  );
}

export default function Funnels() {
  const { query, ready } = useDashParams();
  const { data: d, error, reload } = useAdminApi<any>('behaviour/funnels', { params: query, enabled: ready });
  const card = (key: 'onboarding' | 'creation' | 'monetisation', title: string, caption: string) => (
    <ChartCard title={title} caption={caption} asOf={d?.asOf} actions={<ExportButton path="behaviour/funnels" params={query} table={key} />}>
      {!d ? <Skeleton className="h-56 w-full" /> : !d[key][0]?.people ? <EmptyState title="No sign-ups in this range" body="Pick a longer range." /> : <FunnelBars steps={d[key]} mode="start" />}
    </ChartCard>
  );
  return (
    <>
      <PageHeader title="Funnels" subtitle="Where new people get to, and where they stop. Built-in funnels and your own." />
      <DashControls compare={false} note={d?.note} />
      {error ? <InlineError message={error} onRetry={reload} /> : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {card('creation', 'Building a closet', 'Share of sign-ups reaching each milestone within 7 days (in any order); activated = 10 items and a plan or wear.')}
            {card('onboarding', 'Onboarding', 'Share of sign-ups reaching each step of the sign-up flow (app versions that report them), and adding a first item within 7 days.')}
          </div>
          <div className="mt-4">{card('monetisation', 'Getting to paying', 'Share of sign-ups who have ever hit a plan limit, opened Plans, and paid (not necessarily in that order).')}</div>
          <div className="mt-4">
            {!d ? <Skeleton className="h-72 w-full" /> : <CustomFunnel query={query} events={d.events} milestones={d.milestones} saved={d.saved} reloadSaved={reload} />}
          </div>
        </>
      )}
    </>
  );
}
