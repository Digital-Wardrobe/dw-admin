import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2, UserPlus, Copy, RotateCcw, ShieldAlert, Lock, Plus } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { PageHeader, Badge, InlineError, Skeleton, Card } from '../../components/ui';
import { ChartCard, th, td, btnCls, primaryBtnCls, inputCls } from '../../components/dash';

/* Team and access (permission "staff"). Everyone gets an access profile: pick a ready-made one
   (Support agent, Support lead, Analyst, Moderator, Admin) or make your own. Editing a profile
   changes it for everyone on it, within 30 seconds. Every change is logged; there is always a
   super admin; nobody changes their own access or gives more access than they have. */

type Perm = { key: string; label: string; help: string; sensitive?: boolean; teams?: string[] };
type Area = { area: string; label: string; perms: Perm[] };
type Profile = { id: string; key: string | null; name: string; team: string; description: string | null; permissions: string[]; locked: boolean; people: number; isDefault: boolean; updatedBy?: string | null; updatedAt?: string };
const TEAM_LABEL: Record<string, string> = { SUPERADMIN: 'Super admin', ADMIN: 'Admin', ANALYST: 'Analytics', MODERATOR: 'Moderation', SUPPORT: 'Support' };

function ProfileEditor({ profile, catalogue, teams, iAmSuper, onSaved, onClose }: {
  profile: Profile; catalogue: Area[]; teams: string[]; iAmSuper: boolean; onSaved: (msg: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description || '');
  const [team, setTeam] = useState(profile.team);
  const [perms, setPerms] = useState<Set<string>>(new Set(profile.permissions));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(profile.name); setDescription(profile.description || ''); setTeam(profile.team); setPerms(new Set(profile.permissions)); setErr(null); }, [profile]);
  const changed = name !== profile.name || description !== (profile.description || '') || team !== profile.team || perms.size !== profile.permissions.length || profile.permissions.some((p) => !perms.has(p));
  const toggle = (k: string) => setPerms((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const save = async () => {
    setBusy(true); setErr(null);
    try { await adminSend('PATCH', `staff/profiles/${profile.id}`, { name, description, team, permissions: [...perms] }); onSaved(`“${name}” saved. ${profile.people ? `${profile.people} ${profile.people === 1 ? 'person has' : 'people have'} the new access within 30 seconds.` : ''}`); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!confirm(`Put “${profile.name}” back to its default permissions?`)) return;
    try { await adminSend('POST', `staff/profiles/${profile.id}/reset`); onSaved(`“${profile.name}” is back to its defaults.`); } catch (e: any) { setErr(e.message); }
  };
  const locked = profile.locked;

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          {locked ? <p className="flex items-center gap-2 text-base font-medium text-ink-50"><Lock size={14} aria-hidden="true" />{profile.name}</p> : (
            <input aria-label="Profile name" className={`${inputCls} w-full max-w-sm !text-sm`} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          )}
          {locked ? <p className="text-xs text-ink-400">{profile.description}</p> : (
            <textarea aria-label="Description" rows={2} maxLength={300} className="w-full rounded-inner border border-ink-600 bg-ink-800 px-2 py-1.5 text-xs text-ink-200" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who is this for, and what can they do?" />
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
            {!locked && <label className="inline-flex items-center gap-1.5">Team<select className={inputCls} value={team} onChange={(e) => setTeam(e.target.value)}>{teams.map((t) => <option key={t} value={t}>{TEAM_LABEL[t] || t}</option>)}</select></label>}
            <span>{profile.people} {profile.people === 1 ? 'person' : 'people'}</span>
            {profile.isDefault && <Badge tone="brand">default</Badge>}
            {profile.updatedBy && <span>last changed by {profile.updatedBy}</span>}
          </div>
        </div>
        <button onClick={onClose} className="text-xs text-ink-400 hover:text-ink-100">Close</button>
      </div>
      {locked && <p className="mb-3 rounded-inner bg-ink-850 p-2 text-xs text-ink-300">Super admin always has everything, including anything added later. It can’t be edited.</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {catalogue.map((a) => (
          <fieldset key={a.area} className="rounded-inner border border-ink-700 p-3">
            <legend className="px-1 text-label uppercase text-ink-400">{a.label}</legend>
            <div className="space-y-1.5">
              {a.perms.map((p) => {
                const teamOnly = p.teams && !p.teams.includes(team) && team !== 'SUPERADMIN';
                const on = locked || perms.has(p.key);
                return (
                  <label key={p.key} className={`flex cursor-pointer items-start gap-2 rounded-inner px-1.5 py-1 ${teamOnly ? 'opacity-50' : 'hover:bg-ink-850'}`}>
                    <input type="checkbox" className="mt-0.5 accent-[rgb(var(--brand))]" checked={on} disabled={locked || (teamOnly && !on)} onChange={() => toggle(p.key)} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm text-ink-100">{p.label}{p.sensitive && <ShieldAlert size={12} className="text-warn" aria-label="Sensitive" />}</span>
                      <span className="block text-xs text-ink-400">{p.help}{teamOnly ? ` Only for ${p.teams!.map((t) => TEAM_LABEL[t]).join(', ')} profiles.` : ''}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {!locked && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className={primaryBtnCls} disabled={busy || !changed} onClick={save}>Save profile</button>
          {profile.isDefault && <button className={`${btnCls}`} onClick={reset}><RotateCcw size={12} aria-hidden="true" /> Reset to default</button>}
          <span className="text-xs text-ink-400">{perms.size} permission{perms.size === 1 ? '' : 's'}{!iAmSuper ? ' · you can only give access you have yourself' : ''}</span>
          {err && <span role="alert" className="text-xs text-bad">{err}</span>}
        </div>
      )}
    </Card>
  );
}

export default function Team() {
  const { data, error, reload } = useAdminApi<any>('staff');
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'profiles' ? 'profiles' : 'staff';
  const [form, setForm] = useState({ username: '', email: '', profileId: '', displayName: '', password: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(sp.get('profile'));
  const profiles: Profile[] = useMemo(() => data?.profiles || [], [data]);
  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const assignable = profiles.filter((p) => data?.iAmSuper || p.team !== 'SUPERADMIN');
  useEffect(() => { if (!form.profileId && profiles.length) setForm((f) => ({ ...f, profileId: (profiles.find((p) => p.key === 'support_agent') || profiles[0]).id })); }, [profiles, form.profileId]);

  const act = async (fn: () => Promise<any>, done: string) => { setMsg(null); try { await fn(); setMsg(done); reload(); } catch (e: any) { setMsg(e.message); } };
  const go = (t: string) => { const n = new URLSearchParams(); n.set('tab', t); setSp(n, { replace: true }); };
  const picked = byId.get(form.profileId);

  return (
    <>
      <PageHeader title="Team and access" subtitle="Who can use this console and what their access profile allows. Changes are logged and take effect within 30 seconds." />
      <div className="mb-3 flex gap-1 border-b border-ink-700" role="tablist">
        {[['staff', 'People'], ['profiles', 'Access profiles']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => go(id)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === id ? 'border-brand text-ink-50' : 'border-transparent text-ink-400 hover:text-ink-100'}`}>{label}</button>
        ))}
      </div>
      {msg && <p className="mb-3 text-sm text-ink-300" role="status">{msg}</p>}
      {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-64 w-full" /> : tab === 'staff' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard className="xl:col-span-2" title="People" caption="Console accounts and app users with staff access. The display name is what customers see in support chats.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead><tr><th className={th}>Who</th><th className={th}>Access profile</th><th className={th}>Shown to customers as</th><th className={th}>Since</th><th className={th} /></tr></thead>
                <tbody>
                  {data.staff.map((s: any) => (
                    <tr key={s.id} className="border-t border-ink-700">
                      <td className={td}>{s.username}<span className="block text-xs text-ink-400">{s.email} · {s.kind === 'admin' ? 'console account' : 'app account'}</span></td>
                      <td className={td}>
                        {s.id === data.me ? <Badge tone="brand">{s.profileName} (you)</Badge> : (
                          <select aria-label={`Access profile for ${s.username}`} className={inputCls} value={s.profileId || ''} onChange={(e) => {
                            if (e.target.value === '__remove') { if (confirm(`Remove ${s.username}'s staff access?`)) act(() => adminSend('PATCH', `staff/user/${s.id}`, { role: 'USER' }), 'Staff access removed.'); return; }
                            act(() => adminSend('PATCH', `staff/${s.kind}/${s.id}`, { profileId: e.target.value }), `${s.username} now has “${byId.get(e.target.value)?.name}”.`);
                          }}>
                            {(s.profileId && !assignable.some((p) => p.id === s.profileId)) && <option value={s.profileId}>{s.profileName}</option>}
                            {assignable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            {s.kind === 'user' && <option value="__remove">Remove staff access</option>}
                          </select>
                        )}
                      </td>
                      <td className={td}>
                        {(byId.get(s.profileId)?.permissions.includes('support') || byId.get(s.profileId)?.team === 'SUPERADMIN') ? (
                          <input aria-label={`Display name for ${s.username}`} className={`${inputCls} w-28`} defaultValue={s.displayName || ''} placeholder="e.g. Priya" maxLength={24}
                            onBlur={(e) => { const v = e.target.value.trim(); if (v !== (s.displayName || '')) act(() => adminSend('PATCH', `staff/${s.kind}/${s.id}`, { displayName: v }), 'Display name saved.'); }} />
                        ) : <span className="text-xs text-ink-500">–</span>}
                      </td>
                      <td className={`${td} text-xs text-ink-400`}>{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className={`${td} text-right`}>{s.kind === 'admin' && s.id !== data.me && <button onClick={() => { if (confirm(`Remove ${s.username}'s console access?`)) act(() => adminSend('DELETE', `staff/admin/${s.id}`), 'Removed.'); }} className="text-ink-400 hover:text-bad" aria-label={`Remove ${s.username}`}><Trash2 size={14} /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
          <ChartCard title="Add someone" caption="Pick their access profile. They sign in at the console with this username and change the password after.">
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(async () => { await adminSend('POST', 'staff', form); setForm({ ...form, username: '', email: '', displayName: '', password: '' }); }, `Added with “${picked?.name}”.`); }}>
              <div className="text-xs text-ink-300">
                <label htmlFor="new-profile">Access profile</label>
                <select id="new-profile" className={`${inputCls} mt-1 w-full`} value={form.profileId} onChange={(e) => setForm({ ...form, profileId: e.target.value })}>{assignable.map((p) => <option key={p.id} value={p.id}>{p.name} · {TEAM_LABEL[p.team]}</option>)}</select>
                {picked && <p className="mt-1 text-label text-ink-400">{picked.description} <button type="button" className="text-brand hover:underline" onClick={() => { setEditing(picked.id); go('profiles'); }}>See exactly what it allows</button></p>}
              </div>
              <label className="block text-xs text-ink-300">Username<input required className={`${inputCls} mt-1 w-full`} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} /></label>
              <label className="block text-xs text-ink-300">Email<input required type="email" className={`${inputCls} mt-1 w-full`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              {(picked?.permissions.includes('support')) && <label className="block text-xs text-ink-300">Name customers see in chats<input className={`${inputCls} mt-1 w-full`} placeholder="e.g. Priya" maxLength={24} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>}
              <label className="block text-xs text-ink-300">First password (12+ characters)<input required type="password" minLength={12} autoComplete="new-password" className={`${inputCls} mt-1 w-full`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
              <button className="inline-flex h-8 items-center gap-1 rounded-inner bg-brand px-3 text-xs font-medium text-ink-950"><UserPlus size={13} aria-hidden="true" /> Add</button>
            </form>
          </ChartCard>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {profiles.map((p) => (
              <Card key={p.id} className={`flex flex-col p-4 ${editing === p.id ? 'ring-1 ring-brand' : ''}`}>
                <div className="mb-1 flex items-center gap-2">
                  {p.locked && <Lock size={13} className="text-ink-400" aria-hidden="true" />}
                  <p className="flex-1 text-sm font-medium text-ink-50">{p.name}</p>
                  <Badge tone={p.isDefault ? 'brand' : 'neutral'}>{TEAM_LABEL[p.team] || p.team}</Badge>
                </div>
                <p className="mb-2 line-clamp-3 flex-1 text-xs text-ink-400">{p.description || 'No description.'}</p>
                <p className="mb-2 text-xs text-ink-300">{p.locked ? 'Everything' : `${p.permissions.length} permissions`} · {p.people} {p.people === 1 ? 'person' : 'people'}</p>
                <div className="flex flex-wrap gap-1.5">
                  <button className={btnCls} onClick={() => setEditing(p.id)}>{p.locked ? 'View' : 'Edit'}</button>
                  {!p.locked && <button className={btnCls} onClick={() => act(async () => { const r = await adminSend<any>('POST', 'staff/profiles', { copyFrom: p.id, name: `${p.name} copy` }); setEditing(r.id); }, `Copied “${p.name}”. Rename it and choose what it allows.`)}><Copy size={12} aria-hidden="true" /> Copy</button>}
                  {!p.isDefault && !p.people && <button className={`${btnCls} hover:!text-bad`} onClick={() => { if (confirm(`Delete “${p.name}”?`)) act(() => adminSend('DELETE', `staff/profiles/${p.id}`), 'Deleted.'); }}><Trash2 size={12} aria-hidden="true" /></button>}
                </div>
              </Card>
            ))}
            <Card className="flex items-center justify-center p-4">
              <button className={`${btnCls}`} onClick={() => act(async () => { const r = await adminSend<any>('POST', 'staff/profiles', { name: `New profile ${profiles.length + 1}`, team: 'SUPPORT', permissions: ['support'] }); setEditing(r.id); }, 'New profile created. Name it and choose what it allows.')}><Plus size={13} aria-hidden="true" /> New profile</button>
            </Card>
          </div>
          {editing && byId.get(editing) && (
            <ProfileEditor profile={byId.get(editing)!} catalogue={data.catalogue} teams={data.teams} iAmSuper={data.iAmSuper} onClose={() => setEditing(null)} onSaved={(m) => { setMsg(m); reload(); }} />
          )}
        </div>
      )}
    </>
  );
}
