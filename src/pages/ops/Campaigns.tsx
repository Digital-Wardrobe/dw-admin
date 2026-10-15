import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { PageHeader, Badge, InlineError, EmptyState, Skeleton } from '../../components/ui';
import { ChartCard, AsOf, th, td, fmtN, fmtPct } from '../../components/dash';

/* Announcements show at the top of Home while they're active. Push campaigns go out once to a
   segment and are measured by how many people opened them (push_open). People who turned off
   "News from Fluntr" never get a push. */

const PLANS = ['FREE', 'PRO', 'STUDIO'];
const input = 'h-8 rounded-inner border border-ink-600 bg-ink-800 px-2 text-sm text-ink-100';
const STATUS_TONE: Record<string, any> = { draft: 'neutral', scheduled: 'brand', sending: 'warn', sent: 'ok', cancelled: 'neutral' };

function NewCampaign({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [c, setC] = useState<any>({ kind: 'announcement', title: '', body: '', segment: { plans: [], platforms: [] }, endsAt: '', scheduleAt: '' });
  const [aud, setAud] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const seg = c.segment;
  const toggle = (k: 'plans' | 'platforms', v: string) => setC({ ...c, segment: { ...seg, [k]: seg[k].includes(v) ? seg[k].filter((x: string) => x !== v) : [...seg[k], v] } });
  // datetime-local is the browser's local time: send it as an instant
  const iso = (v: string) => (v ? new Date(v).toISOString() : null);
  const body = () => ({ kind: c.kind, title: c.title, body: c.body, segment: seg, endsAt: iso(c.endsAt), scheduleAt: iso(c.scheduleAt) });
  return (
    <form className="space-y-3 rounded-inner border border-ink-700 bg-ink-850 p-4" onSubmit={async (e) => {
      e.preventDefault(); setErr(null);
      try {
        const made = await adminSend('POST', 'campaigns', body());
        if (confirm(c.kind === 'push' ? `Send this push ${c.scheduleAt ? `at ${new Date(c.scheduleAt).toLocaleString()}` : 'now'}?` : 'Show this announcement now?')) await adminSend('POST', `campaigns/${made.id}/publish`, { at: iso(c.scheduleAt) || undefined });
        onDone();
      } catch (x: any) { setErr(x.message); }
    }}>
      <div className="flex flex-wrap gap-3 text-xs text-ink-300">
        {['announcement', 'push'].map((k) => <label key={k} className="inline-flex items-center gap-1"><input type="radio" name="kind" checked={c.kind === k} onChange={() => setC({ ...c, kind: k })} />{k === 'push' ? 'Push notification (sent once)' : 'Announcement on Home'}</label>)}
      </div>
      <label className="block text-xs text-ink-300">Title<input required maxLength={80} className={`${input} mt-1 w-full`} value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} /></label>
      <label className="block text-xs text-ink-300">Text<textarea required maxLength={240} className="mt-1 h-20 w-full rounded-inner border border-ink-600 bg-ink-800 p-2 text-sm text-ink-100" value={c.body} onChange={(e) => setC({ ...c, body: e.target.value })} /></label>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <fieldset className="text-xs text-ink-300"><legend>Plans (none = all)</legend><span className="mt-2 flex flex-wrap gap-2">{PLANS.map((p) => <label key={p} className="inline-flex items-center gap-1"><input type="checkbox" checked={seg.plans.includes(p)} onChange={() => toggle('plans', p)} />{p}</label>)}</span></fieldset>
        <fieldset className="text-xs text-ink-300"><legend>Platforms (none = all)</legend><span className="mt-2 flex gap-2">{['android', 'ios'].map((p) => <label key={p} className="inline-flex items-center gap-1"><input type="checkbox" checked={seg.platforms.includes(p)} onChange={() => toggle('platforms', p)} />{p}</label>)}</span></fieldset>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-ink-300">Min app version<input className={`${input} mt-1 w-full`} placeholder="1.0.3" value={seg.minVersion || ''} onChange={(e) => setC({ ...c, segment: { ...seg, minVersion: e.target.value || undefined } })} /></label>
          <label className="text-xs text-ink-300">Active in last (days)<input type="number" min={1} max={365} className={`${input} mt-1 w-full`} value={seg.activeWithinDays || ''} onChange={(e) => setC({ ...c, segment: { ...seg, activeWithinDays: e.target.value ? Number(e.target.value) : undefined } })} /></label>
        </div>
        <label className="text-xs text-ink-300">{c.kind === 'push' ? 'Send at (empty = now)' : 'Show from (empty = now)'}<input type="datetime-local" className={`${input} mt-1 w-full`} value={c.scheduleAt} onChange={(e) => setC({ ...c, scheduleAt: e.target.value })} /></label>
        {c.kind === 'announcement' && <label className="text-xs text-ink-300">Until (empty = until cancelled)<input type="datetime-local" className={`${input} mt-1 w-full`} value={c.endsAt} onChange={(e) => setC({ ...c, endsAt: e.target.value })} /></label>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="h-8 rounded-inner bg-brand px-3 text-xs font-medium text-ink-950">Create</button>
        <button type="button" onClick={async () => { try { setAud(await adminSend('POST', 'campaigns/audience', { segment: seg })); } catch (x: any) { setErr(x.message); } }} className="h-8 rounded-inner border border-ink-600 px-3 text-xs text-ink-100 hover:border-brand-line">How many people?</button>
        {aud && <span className="text-xs text-ink-300">{fmtN(aud.people)} people · {fmtN(aud.pushable)} can get a push</span>}
        <button type="button" onClick={onCancel} className="h-8 px-2 text-xs text-ink-300">Cancel</button>
        {err && <span className="text-xs text-bad">{err}</span>}
      </div>
    </form>
  );
}

export default function Campaigns() {
  const { data, error, reload } = useAdminApi<any>('campaigns');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (path: string, done: string) => { setMsg(null); try { await adminSend('POST', path); setMsg(done); reload(); } catch (e: any) { setMsg(e.message); } };
  const segText = (s: any) => [s?.plans?.length ? s.plans.join('/') : 'all plans', s?.platforms?.length ? s.platforms.join('/') : null, s?.minVersion ? `≥ ${s.minVersion}` : null, s?.activeWithinDays ? `active ${s.activeWithinDays}d` : null].filter(Boolean).join(' · ');
  return (
    <>
      <PageHeader title="Announcements & push" subtitle="Announcements sit at the top of Home while active. A push goes out once to a segment; opens are counted from the app. People who turned off News from Fluntr don't get pushes." actions={data && <AsOf at={data.asOf} />} />
      {msg && <p className="mb-3 text-sm text-ink-300" role="status">{msg}</p>}
      <ChartCard title="Campaigns" caption="Newest first. Opened = people who tapped the push (push_open), counted in the daily rollup." actions={data?.canEdit && !adding ? <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-inner border border-ink-600 px-2 py-1 text-xs text-ink-100 hover:border-brand-line hover:text-brand"><Plus size={13} aria-hidden="true" /> New</button> : undefined}>
        {adding && <div className="mb-4"><NewCampaign onDone={() => { setAdding(false); reload(); }} onCancel={() => setAdding(false)} /></div>}
        {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-32 w-full" /> : !data.campaigns.length ? <EmptyState title="Nothing yet" body="Create an announcement or a push to a segment." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>Message</th><th className={th}>Kind</th><th className={th}>Who</th><th className={th}>When</th><th className={th}>State</th><th className={`${th} text-right`}>Sent</th><th className={`${th} text-right`}>Opened</th>{data.canEdit && <th className={th} />}</tr></thead>
              <tbody>
                {data.campaigns.map((c: any) => (
                  <tr key={c.id} className="border-t border-ink-700 align-top">
                    <td className={`${td} max-w-sm whitespace-normal`}><span className="font-medium">{c.title}</span><span className="block text-xs text-ink-400">{c.body}</span></td>
                    <td className={td}>{c.kind}</td>
                    <td className={`${td} text-xs text-ink-300`}>{segText(c.segment)}</td>
                    <td className={`${td} text-xs text-ink-300`}>{c.scheduleAt ? new Date(c.scheduleAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–'}{c.endsAt && <span className="block">until {new Date(c.endsAt).toLocaleDateString('en-IN')}</span>}</td>
                    <td className={td}><Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></td>
                    <td className={`${td} text-right`} data-numeric>{c.kind === 'push' ? fmtN(c.sentCount) : '–'}</td>
                    <td className={`${td} text-right`} data-numeric>{c.stats ? `${fmtN(c.stats.opened)} (${fmtPct(c.stats.openRate)})` : '–'}</td>
                    {data.canEdit && <td className={`${td} text-right`}>
                      {['draft', 'cancelled'].includes(c.status) && <button onClick={() => { if (confirm(c.kind === 'push' ? 'Send this push now?' : 'Show this announcement now?')) act(`campaigns/${c.id}/publish`, 'Published.'); }} className="mr-2 text-xs text-ink-300 hover:text-brand">{c.kind === 'push' ? 'Send' : 'Show'}</button>}
                      {(c.status === 'scheduled' || (c.kind === 'announcement' && c.status === 'sent')) && <button onClick={() => act(`campaigns/${c.id}/cancel`, 'Cancelled.')} className="text-xs text-ink-300 hover:text-bad">{c.kind === 'push' ? 'Cancel' : 'Stop showing'}</button>}
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </>
  );
}
