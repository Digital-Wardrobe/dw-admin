import { Smartphone } from 'lucide-react';
import { Badge } from '../../components/ui';
import { getAdminToken } from '../../lib/useAdminApi';
import { API_BASE_URL } from '../../config';

/* Bits the support console's tabs share: labels, time formatting, small badges. */

export type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export const STATUS_LABEL: Record<Status, string> = { OPEN: 'Waiting', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' };
export const PRIORITY_LABEL: Record<Priority, string> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };
export const PRIORITY_DOT: Record<Priority, string> = { urgent: 'bg-bad', high: 'bg-warn', normal: 'bg-ink-500', low: 'bg-ink-700' };
export const KIND_LABEL: Record<string, string> = {
  account: 'Account', billing: 'Billing', scan: 'Scan', beautify: 'Studio shot', bug: 'Bug', feedback: 'Feedback', safety: 'Safety', general: 'General',
};

export const ago = (iso?: string | null) => {
  if (!iso) return '–';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'now' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};
export const fmtMin = (m: number | null | undefined) => (m == null ? '–' : m < 60 ? `${m} min` : m < 1440 ? `${(m / 60).toFixed(m < 600 ? 1 : 0)} h` : `${(m / 1440).toFixed(1)} d`);
export const stamp = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
export const money = (p?: { amount: number; currency: string } | null) => (p ? `${p.currency === 'INR' ? '₹' : `${p.currency} `}${p.amount.toLocaleString('en-IN')}` : '–');

export function WaitingBadge({ on, since, breached }: { on: 'us' | 'them' | null; since?: string | null; breached?: boolean }) {
  if (on === 'us') return <Badge tone={breached || (since && Date.now() - new Date(since).getTime() > 86_400_000) ? 'bad' : 'warn'}>on us · {ago(since)}</Badge>;
  if (on === 'them') return <Badge tone="neutral">on them</Badge>;
  return null;
}

export function Device({ d }: { d: any }) {
  if (!d?.platform && !d?.version) return null;
  return <span className="inline-flex items-center gap-1 text-xs text-ink-400"><Smartphone size={12} aria-hidden="true" />{[d.platform, d.version].filter(Boolean).join(' · ')}</span>;
}

export function Initial({ name, size = 'h-6 w-6 text-[11px]' }: { name?: string | null; size?: string }) {
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink-100 font-semibold text-ink-950 ${size}`} aria-hidden="true">{(name || '?').slice(0, 1).toUpperCase()}</span>;
}

export function StatusDot({ status }: { status: string }) {
  const cls = status === 'online' ? 'bg-ok' : status === 'away' ? 'bg-warn' : 'bg-ink-600';
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} aria-label={status} />;
}

/** GET an admin endpoint now (for panels that refetch on live events). */
export async function getJson(path: string) {
  const r = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${getAdminToken()}` } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.message || `Request failed (${r.status})`);
  return j?.data ?? j;
}
