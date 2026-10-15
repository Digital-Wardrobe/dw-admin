import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { useMe } from '../../lib/me';
import { InlineError, Skeleton, EmptyState } from '../../components/ui';
import { ChartCard, Kpi, Grid, Segmented, ChartTip, axis, th, td, fmtN, fmtDay, btnCls, primaryBtnCls, inputCls } from '../../components/dash';
import { CHART } from '../../chartColors';
import { fmtMin, ago, StatusDot } from './shared';

type Range = '7d' | '30d' | '90d';
const RANGES = [{ id: '7d' as Range, label: '7 days' }, { id: '30d' as Range, label: '30 days' }, { id: '90d' as Range, label: '90 days' }];
const TAG_LABEL: Record<string, string> = { quick: 'Quick', friendly: 'Friendly', solved: 'Solved it', clear: 'Clear', slow: 'Slow', not_solved: 'Didn’t solve it', unclear: 'Hard to follow', rude: 'Unfriendly' };

/* Team: each agent's workload and numbers (support.team). No conversations. */
export function TeamTab() {
  const [range, setRange] = useState<Range>('7d');
  const { data, error, reload } = useAdminApi<any>('support/team', { params: { range } });
  return (
    <div className="space-y-3">
      <Segmented value={range} onChange={setRange} label="Range" options={RANGES} />
      <ChartCard title="Agents" caption="Chats assigned in the range, how fast they answered and how people rated them. CSAT = share of ratings that are 4 or 5 stars.">
        {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-48 w-full" /> : !data.agents.length ? <EmptyState title="No agents yet" body="People with a support profile appear here once they set a display name or take a chat." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr>{['Agent', 'Now', 'Handled', 'Resolved', 'Replies', 'First reply', 'Resolution', 'CSAT', 'Rating'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {data.agents.map((a: any) => (
                  <tr key={a.id} className="border-t border-ink-700">
                    <td className={td}><span className="inline-flex items-center gap-2"><StatusDot status={a.status} />{a.displayName || a.name}<span className="text-xs text-ink-400">{a.displayName ? a.name : ''}</span></span></td>
                    <td className={td}>{a.open}/{a.maxChats} open{a.lastActiveAt ? <span className="block text-xs text-ink-400">active {ago(a.lastActiveAt)} ago</span> : null}</td>
                    <td className={td}>{fmtN(a.handled)}</td><td className={td}>{fmtN(a.resolved)}</td><td className={td}>{fmtN(a.replies)}</td>
                    <td className={td}>{fmtMin(a.firstResponseMedianMin)}</td><td className={td}>{fmtMin(a.resolutionMedianMin)}</td>
                    <td className={td}><span className={a.csat == null ? 'text-ink-400' : a.csat >= 80 ? 'text-ok' : a.csat >= 60 ? 'text-warn' : 'text-bad'}>{a.csat == null ? '–' : `${a.csat}%`}</span></td>
                    <td className={td}>{a.avgRating ?? '–'}<span className="text-xs text-ink-400"> ({a.ratings})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

/* Ready replies: everyone with "support" uses them; support.macros edits them. */
export function RepliesTab() {
  const { can } = useMe();
  const edit = can('support.macros');
  const { data, error, reload } = useAdminApi<any[]>('support/macros');
  const [form, setForm] = useState<{ id?: string; title: string; body: string; topics: string }>({ title: '', body: '', topics: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    try {
      const body = { title: form.title, body: form.body, topics: form.topics.split(',').map((x) => x.trim()).filter(Boolean) };
      await adminSend(form.id ? 'PUT' : 'POST', form.id ? `support/macros/${form.id}` : 'support/macros', body);
      setForm({ title: '', body: '', topics: '' }); setMsg('Saved.'); reload();
    } catch (e: any) { setMsg(e.message); }
  };
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <ChartCard className="xl:col-span-2" title="Ready replies" caption="Most used first. {name} becomes the customer’s first name and {agent} your display name when you send.">
        {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-48 w-full" /> : (
          <ul className="divide-y divide-ink-700">
            {data.map((m: any) => (
              <li key={m.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1"><p className="text-sm text-ink-100">{m.title} <span className="text-xs text-ink-400">· used {fmtN(m.uses)}×{m.topics?.length ? ` · ${m.topics.join(', ')}` : ''}</span></p><p className="whitespace-pre-wrap text-xs text-ink-300">{m.body}</p></div>
                {edit && <span className="flex shrink-0 gap-1">
                  <button className="text-ink-400 hover:text-ink-100" aria-label={`Edit ${m.title}`} onClick={() => setForm({ id: m.id, title: m.title, body: m.body, topics: (m.topics || []).join(', ') })}><Pencil size={14} /></button>
                  <button className="text-ink-400 hover:text-bad" aria-label={`Delete ${m.title}`} onClick={async () => { if (confirm(`Delete “${m.title}”?`)) { await adminSend('DELETE', `support/macros/${m.id}`).catch((e) => setMsg(e.message)); reload(); } }}><Trash2 size={14} /></button>
                </span>}
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
      {edit ? (
        <ChartCard title={form.id ? 'Edit ready reply' : 'New ready reply'} caption="Keep it short and friendly; agents can change it before sending.">
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <label className="block text-xs text-ink-300">Title<input required maxLength={60} className={`${inputCls} mt-1 w-full`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="block text-xs text-ink-300">Text<textarea required rows={5} maxLength={2000} className="mt-1 w-full rounded-inner border border-ink-600 bg-ink-800 px-2 py-1.5 text-sm text-ink-100" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
            <label className="block text-xs text-ink-300">Suggest first for topics (comma separated, e.g. billing, scan)<input className={`${inputCls} mt-1 w-full`} value={form.topics} onChange={(e) => setForm({ ...form, topics: e.target.value })} /></label>
            <div className="flex gap-2"><button className={`${primaryBtnCls} inline-flex items-center gap-1`}><Plus size={13} aria-hidden="true" />{form.id ? 'Save' : 'Add'}</button>{form.id && <button type="button" className={btnCls} onClick={() => setForm({ title: '', body: '', topics: '' })}>Cancel</button>}</div>
            {msg && <p role="status" className="text-xs text-ink-300">{msg}</p>}
          </form>
        </ChartCard>
      ) : <p className="text-xs text-ink-400">Your support lead edits ready replies.</p>}
    </div>
  );
}

/* Insights: numbers only, for leads and analysts (support.insights). Never the words. */
export function InsightsTab() {
  const [range, setRange] = useState<Range>('30d');
  const { data, error, reload } = useAdminApi<any>('support/insights', { params: { range } });
  if (error) return <InlineError message={error} onRetry={reload} />;
  return (
    <div className="space-y-3">
      <Segmented value={range} onChange={setRange} label="Range" options={RANGES} />
      {!data ? <Skeleton className="h-64 w-full" /> : <>
        <Grid cols={4}>
          <Kpi label="Chats" value={fmtN(data.chats)} hint={`Started in the last ${data.days} days`} />
          <Kpi label="First reply (median)" value={fmtMin(data.firstResponseMedianMin)} hint={data.slaMetPct == null ? undefined : `${data.slaMetPct}% within the target for their priority`} />
          <Kpi label="CSAT" value={data.csatPct == null ? '–' : `${data.csatPct}%`} hint={`${fmtN(data.ratings)} ratings · average ${data.avgRating ?? '–'} ★`} />
          <Kpi label="Solved by self-help" value={data.selfServe.solvedPct == null ? '–' : `${data.selfServe.solvedPct}%`} hint={`${fmtN(data.selfServe.solved)} solved, ${fmtN(data.selfServe.handoff)} went to the team, ${fmtN(data.selfServe.abandoned)} left`} />
        </Grid>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <ChartCard className="xl:col-span-2" title="Chats per day" caption="Chats handed to the team (self-help answers that solved it aren’t counted).">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byDay} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="day" {...axis} tickFormatter={fmtDay} minTickGap={24} />
                  <YAxis {...axis} width={32} allowDecimals={false} />
                  <Tooltip content={<ChartTip labelFormat={fmtDay} />} cursor={{ fill: 'rgb(var(--ink-700) / 0.4)' }} />
                  <Bar dataKey="chats" name="Chats" fill={CHART.brand} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Ratings" caption="Stars and the quick tags people picked.">
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((s) => {
                const n = data.stars[s - 1]; const max = Math.max(1, ...data.stars);
                return <div key={s} className="flex items-center gap-2 text-xs"><span className="w-6 text-warn">{s}★</span><span className="h-2 flex-1 rounded bg-ink-800"><span className="block h-2 rounded bg-warn" style={{ width: `${(n / max) * 100}%` }} /></span><span className="w-8 text-right text-ink-300">{n}</span></div>;
              })}
              <div className="flex flex-wrap gap-1.5 pt-2">{Object.entries(data.ratingTags).sort((a: any, b: any) => b[1] - a[1]).map(([k, n]) => <span key={k} className="rounded-inner border border-ink-700 px-2 py-0.5 text-xs text-ink-300">{TAG_LABEL[k] || k} · {n as number}</span>)}</div>
            </div>
          </ChartCard>
        </div>
        <ChartCard title="By topic" caption="What people need help with, and how well each topic goes.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead><tr><th className={th}>Topic</th><th className={th}>Chats</th><th className={th}>First reply</th><th className={th}>Rating</th></tr></thead>
              <tbody>{data.byTopic.map((r: any) => <tr key={r.key} className="border-t border-ink-700"><td className={td}>{r.label}</td><td className={td}>{fmtN(r.chats)}</td><td className={td}>{fmtMin(r.firstResponseMedianMin)}</td><td className={td}>{r.avgRating ?? '–'}</td></tr>)}</tbody>
            </table>
          </div>
        </ChartCard>
      </>}
    </div>
  );
}
