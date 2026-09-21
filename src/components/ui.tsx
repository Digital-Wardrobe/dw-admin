import React from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   Shared primitives.

   Before this, every page hand-rolled its own card, header, spinner and error
   block with slightly different padding, radii and colours — and two of them
   painted their own page background on top of the shell's. Centralising them
   is what makes the look consistent and keeps it that way as pages are added.
   ────────────────────────────────────────────────────────────────────────── */

/** Page title block. One per page; the shell supplies the chrome around it. */
export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-ink-700 pb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-50">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-300">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Surface container. No border+shadow+fill all at once — fill and a hairline. */
export function Card({
  children, className = '', as: Tag = 'section',
}: { children: React.ReactNode; className?: string; as?: any }) {
  return (
    <Tag className={`rounded-card border border-ink-700 bg-ink-800 shadow-card ${className}`}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-700 px-5 py-4">
      <h2 className="text-sm font-medium text-ink-100">{title}</h2>
      {hint && <span className="text-label text-ink-400">{hint}</span>}
    </div>
  );
}

/**
 * A single headline number.
 * `delta` is optional and only rendered when there is a real value to show —
 * a stat tile with a fabricated "+12%" is worse than no delta at all.
 */
export function StatTile({
  label, value, icon, delta, hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  delta?: { value: string; direction: 'up' | 'down' | 'flat' };
  hint?: string;
}) {
  const deltaTone =
    delta?.direction === 'up' ? 'text-ok' :
    delta?.direction === 'down' ? 'text-bad' : 'text-ink-400';

  return (
    <Card className="group p-5 transition-colors hover:border-brand-line">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-label uppercase text-ink-400">{label}</span>
        {icon && <span className="text-ink-400 transition-colors group-hover:text-brand">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span data-numeric className="text-stat text-ink-50">{value}</span>
        {delta && <span className={`text-xs font-medium ${deltaTone}`}>{delta.value}</span>}
      </div>
      {hint && <p className="mt-2 text-xs text-ink-400">{hint}</p>}
    </Card>
  );
}

/** Skeletons mirror the shape of what is loading, rather than a spinner. */
export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton rounded-inner ${className}`} style={style} aria-hidden="true" />;
}

export function StatTileSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="mb-4 h-3 w-28" />
      <Skeleton className="h-8 w-20" />
    </Card>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <Card>
      <CardHeader title="Loading" />
      <div className="p-5"><Skeleton style={{ height }} className="w-full" /></div>
    </Card>
  );
}

/**
 * Inline failure. Deliberately not a full-page takeover: one endpoint failing
 * should not throw the operator out of the console or end their session.
 */
export function InlineError({
  message, onRetry,
}: { message: string; onRetry?: () => void }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-bad" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-100">We couldn&rsquo;t load this section.</p>
          <p className="mt-1 break-words text-sm text-ink-300">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-inner border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-100 transition hover:border-brand-line hover:text-brand active:translate-y-px"
          >
            <RefreshCw size={13} aria-hidden="true" /> Try again
          </button>
        )}
      </div>
    </Card>
  );
}

/** Shown when a request succeeded but there is genuinely nothing yet. */
export function EmptyState({
  title, body, icon,
}: { title: string; body: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-ink-700 bg-ink-850/50 px-6 py-14 text-center">
      <div className="mb-3 text-ink-600">{icon ?? <Inbox size={28} aria-hidden="true" />}</div>
      <p className="text-sm font-medium text-ink-100">{title}</p>
      <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-ink-400">{body}</p>
    </div>
  );
}

/** Square-ish badge rather than the usual pill. */
export function Badge({
  children, tone = 'neutral',
}: { children: React.ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'brand' }) {
  const tones = {
    neutral: 'border-ink-600 text-ink-300',
    ok:      'border-ok/30 text-ok',
    warn:    'border-warn/30 text-warn',
    bad:     'border-bad/30 text-bad',
    brand:   'border-brand-line text-brand',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-1 text-label font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Live status dot + label, e.g. the API connectivity indicator. */
export function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge tone={ok ? 'ok' : 'bad'}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-ok' : 'bg-bad'}`} aria-hidden="true" />
      {label}
    </Badge>
  );
}

/** Number formatting used across the console so 1000 never renders as "1000". */
export const fmt = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
