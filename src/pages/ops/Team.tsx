import { useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { useAdminApi } from '../../lib/useAdminApi';
import { adminSend } from '../../lib/api';
import { PageHeader, Badge, InlineError, Skeleton } from '../../components/ui';
import { ChartCard, th, td } from '../../components/dash';

/* Staff and their roles (SUPERADMIN only). Every change is logged; there is always at least
   one SUPERADMIN, and nobody changes their own role. */

const ROLE_HELP: Record<string, string> = {
  SUPERADMIN: 'Everything, including staff, prices and seeing who a user is',
  ADMIN: 'Everything except staff, prices and seeing who a user is',
  ANALYST: 'Read-only dashboards, people as pseudonyms',
  MODERATOR: 'The reports queue only',
  SUPPORT: 'Looking people up and seeing who they are (logged)',
};
const input = 'h-8 rounded-inner border border-ink-600 bg-ink-800 px-2 text-sm text-ink-100';

export default function Team() {
  const { data, error, reload } = useAdminApi<any>('staff');
  const [form, setForm] = useState({ username: '', email: '', role: 'ANALYST', password: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (fn: () => Promise<any>, done: string) => { setMsg(null); try { await fn(); setMsg(done); reload(); } catch (e: any) { setMsg(e.message); } };
  return (
    <>
      <PageHeader title="Team" subtitle="Who can use this console and what their role allows. Changes are logged and take effect within 30 seconds." />
      {msg && <p className="mb-3 text-sm text-ink-300" role="status">{msg}</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title="Staff" caption="Console accounts and app users with a staff role.">
          {error ? <InlineError message={error} onRetry={reload} /> : !data ? <Skeleton className="h-40 w-full" /> : (
            <table className="w-full">
              <thead><tr><th className={th}>Who</th><th className={th}>Role</th><th className={th}>Since</th><th className={th} /></tr></thead>
              <tbody>
                {data.staff.map((s: any) => (
                  <tr key={s.id} className="border-t border-ink-700">
                    <td className={td}>{s.username}<span className="block text-xs text-ink-400">{s.email} · {s.kind === 'admin' ? 'console account' : 'app account'}</span></td>
                    <td className={td}>
                      {s.id === data.me ? <Badge tone="brand">{s.role} (you)</Badge> : (
                        <select aria-label={`Role for ${s.username}`} className={input} value={s.role} onChange={(e) => act(() => adminSend('PATCH', `staff/${s.kind}/${s.id}`, { role: e.target.value }), `${s.username} is now ${e.target.value}.`)}>
                          {data.roles.map((r: string) => <option key={r}>{r}</option>)}
                          {s.kind === 'user' && <option value="USER">Remove staff role</option>}
                        </select>
                      )}
                    </td>
                    <td className={`${td} text-xs text-ink-400`}>{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className={`${td} text-right`}>{s.kind === 'admin' && s.id !== data.me && <button onClick={() => { if (confirm(`Remove ${s.username}'s console access?`)) act(() => adminSend('DELETE', `staff/admin/${s.id}`), 'Removed.'); }} className="text-ink-400 hover:text-bad" aria-label={`Remove ${s.username}`}><Trash2 size={14} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ChartCard>
        <ChartCard title="Add someone" caption="They sign in at the console with this username and change the password after.">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(async () => { await adminSend('POST', 'staff', form); setForm({ username: '', email: '', role: 'ANALYST', password: '' }); }, 'Added.'); }}>
            <label className="block text-xs text-ink-300">Username<input required className={`${input} mt-1 w-full`} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} /></label>
            <label className="block text-xs text-ink-300">Email<input required type="email" className={`${input} mt-1 w-full`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="block text-xs text-ink-300">Role<select className={`${input} mt-1 w-full`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{Object.keys(ROLE_HELP).map((r) => <option key={r}>{r}</option>)}</select><span className="mt-1 block text-label text-ink-400">{ROLE_HELP[form.role]}</span></label>
            <label className="block text-xs text-ink-300">First password (12+ characters)<input required type="password" minLength={12} autoComplete="new-password" className={`${input} mt-1 w-full`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <button className="inline-flex h-8 items-center gap-1 rounded-inner bg-brand px-3 text-xs font-medium text-ink-950"><UserPlus size={13} aria-hidden="true" /> Add</button>
          </form>
        </ChartCard>
      </div>
    </>
  );
}
