import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import React, { Suspense, lazy, useState } from 'react';
import {
  LayoutDashboard, TrendingUp, Users as UsersIcon, Server, UserPlus, LogOut, ShieldAlert, Cpu, Scale, BellRing, Receipt, Tags, Sun, Moon, Monitor,
  ToggleRight, Megaphone, Smartphone, ScrollText, IndianRupee, CreditCard, ShoppingBag,
} from 'lucide-react';

const Overview = lazy(() => import('./pages/Overview'));
const Business = lazy(() => import('./pages/business/Business'));
const Growth = lazy(() => import('./pages/business/Growth'));
const Monetisation = lazy(() => import('./pages/business/Monetisation'));
const Affiliate = lazy(() => import('./pages/business/Affiliate'));
const Users = lazy(() => import('./pages/Users'));
const Moderation = lazy(() => import('./pages/Moderation'));
const Infrastructure = lazy(() => import('./pages/Infrastructure'));
const Team = lazy(() => import('./pages/ops/Team'));
const AuditLog = lazy(() => import('./pages/ops/AuditLog'));
const FeatureFlags = lazy(() => import('./pages/ops/FeatureFlags'));
const Campaigns = lazy(() => import('./pages/ops/Campaigns'));
const AppVersions = lazy(() => import('./pages/ops/AppVersions'));
import LoginPortal from './pages/LoginPortal';
const AiCosts = lazy(() => import('./pages/ai/AiCosts'));
const MoveOrKeep = lazy(() => import('./pages/ai/MoveOrKeep'));
const Alerts = lazy(() => import('./pages/ai/Alerts'));
const Reconciliation = lazy(() => import('./pages/ai/Reconciliation'));
const PriceTable = lazy(() => import('./pages/ops/PriceTable'));
import AuthGuard from './components/AuthGuard';
import { MeProvider, useMe } from './lib/me';
import { themePref, setThemePref, type ThemePref } from './lib/theme';

/* Section names are what an operator would call them, not what an internal
   service is named. Each page names the permission it needs; the sidebar only
   shows what the signed-in role can open (the API checks again on every request). */
type NavItem = { path: string; name: string; icon: any; perm: string; element: React.ReactNode };
export const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  { group: 'Overview', items: [
    { path: '/admin/dashboard', name: 'Overview', icon: LayoutDashboard, perm: 'overview.read', element: <Overview /> },
  ] },
  { group: 'AI & Costs', items: [
    { path: '/admin/ai', name: 'AI & Costs', icon: Cpu, perm: 'ai.read', element: <AiCosts /> },
    { path: '/admin/ai/move-or-keep', name: 'Move or keep', icon: Scale, perm: 'ai.read', element: <MoveOrKeep /> },
    { path: '/admin/ai/alerts', name: 'Alerts', icon: BellRing, perm: 'ai.read', element: <Alerts /> },
    { path: '/admin/ai/reconciliation', name: 'Reconciliation', icon: Receipt, perm: 'ai.read', element: <Reconciliation /> },
  ] },
  { group: 'Business', items: [
    { path: '/admin/business', name: 'Business', icon: IndianRupee, perm: 'business.read', element: <Business /> },
    { path: '/admin/business/growth', name: 'Growth', icon: TrendingUp, perm: 'business.read', element: <Growth /> },
    { path: '/admin/business/monetisation', name: 'Monetisation', icon: CreditCard, perm: 'business.read', element: <Monetisation /> },
    { path: '/admin/business/affiliate', name: 'Affiliate', icon: ShoppingBag, perm: 'business.read', element: <Affiliate /> },
  ] },
  { group: 'Operations', items: [
    { path: '/admin/users', name: 'Users', icon: UsersIcon, perm: 'users.read', element: <Users /> },
    { path: '/admin/moderation', name: 'Reports', icon: ShieldAlert, perm: 'moderation', element: <Moderation /> },
    { path: '/admin/infra', name: 'Infrastructure', icon: Server, perm: 'infra.read', element: <Infrastructure /> },
    { path: '/admin/flags', name: 'Feature flags', icon: ToggleRight, perm: 'overview.read', element: <FeatureFlags /> },
    { path: '/admin/campaigns', name: 'Announcements', icon: Megaphone, perm: 'overview.read', element: <Campaigns /> },
    { path: '/admin/versions', name: 'App versions', icon: Smartphone, perm: 'overview.read', element: <AppVersions /> },
    { path: '/admin/prices', name: 'Price table', icon: Tags, perm: 'ai.read', element: <PriceTable /> },
    { path: '/admin/staff', name: 'Team', icon: UserPlus, perm: 'staff', element: <Team /> },
    { path: '/admin/audit', name: 'Audit log', icon: ScrollText, perm: 'audit.read', element: <AuditLog /> },
  ] },
];
export const NAV = NAV_GROUPS.flatMap((g) => g.items);

function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(themePref());
  const next: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
  const Icon = pref === 'dark' ? Moon : pref === 'light' ? Sun : Monitor;
  return (
    <button
      onClick={() => { const n = next[pref]; setThemePref(n); setPref(n); }}
      className="flex w-full items-center gap-3 rounded-inner px-3 py-2 text-sm text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
      aria-label={`Theme: ${pref}. Change theme`}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      {pref === 'system' ? 'Theme: system' : pref === 'dark' ? 'Theme: dark' : 'Theme: light'}
    </button>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const signOut = () => {
    localStorage.removeItem('admin_session_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_me');
    navigate('/portal/secure-gateway-entry');
  };

  const { me, can } = useMe();
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) })).filter((g) => g.items.length);
  const current = NAV.find(i => i.path === location.pathname);

  return (
    <div className="grain min-h-dvh bg-ink-900 text-ink-100 antialiased selection:bg-brand/30 selection:text-ink-50">
      {/* Keyboard users need a way past the navigation. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-inner focus:bg-ink-800 focus:px-4 focus:py-2 focus:text-sm focus:text-ink-50"
      >
        Skip to content
      </a>

      <aside
        className="fixed inset-x-0 top-0 z-20 flex flex-col border-b border-ink-700 bg-ink-850 lg:inset-y-0 lg:right-auto lg:w-60 lg:justify-between lg:border-b-0 lg:border-r"
        aria-label="Console sections"
      >
        <div className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
          <div className="flex items-center gap-3 px-5 py-4 lg:border-b lg:border-ink-700 lg:py-5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-inner border border-brand-line bg-brand-wash font-mono text-sm font-semibold tracking-tight text-brand"
            >
              F
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-ink-50">Fluntr</p>
              <p className="truncate text-label text-ink-400">{me ? `${me.name} · ${me.role.toLowerCase()}` : 'Admin console'}</p>
            </div>
          </div>

          <nav className="px-3 pb-3 lg:flex-1 lg:overflow-y-auto lg:p-3">
            <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-4 lg:overflow-visible">
              {groups.map((g) => (
                <li key={g.group} className="flex shrink-0 gap-1 lg:block">
                  <p className="hidden px-3 pb-1 text-label uppercase text-ink-400 lg:block">{g.group}</p>
                  <ul className="flex gap-1 lg:block lg:space-y-0.5">
                    {g.items.map(({ path, name, icon: Icon }) => {
                      const active = location.pathname === path;
                      return (
                        <li key={path} className="shrink-0">
                          <Link
                            to={path}
                            aria-current={active ? 'page' : undefined}
                            className={`relative flex items-center gap-2 whitespace-nowrap rounded-inner px-3 py-2 text-sm transition lg:gap-3
                              ${active
                                ? 'bg-brand-wash font-medium text-brand'
                                : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'}`}
                          >
                            {/* The active marker is a rail, not a filled block —
                                it reads as position rather than as a button. */}
                            {active && (
                              <span
                                aria-hidden="true"
                                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand lg:inset-x-auto lg:inset-y-1.5 lg:left-0 lg:h-auto lg:w-0.5"
                              />
                            )}
                            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                            {name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* One sign-out in the whole console. Pages used to carry their own. */}
        <div className="hidden space-y-0.5 border-ink-700 p-3 lg:block lg:border-t">
          <ThemeToggle />
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-inner px-3 py-2 text-sm text-ink-300 transition hover:bg-ink-800 hover:text-bad active:translate-y-px"
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <main id="main" className="pt-[116px] lg:pl-60 lg:pt-0">
        {/* Bottom padding slightly exceeds top so the page reads optically
            centred rather than mathematically so. */}
        <div className="mx-auto w-full max-w-[1400px] px-4 pb-14 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          {current && <p className="sr-only">{current.name}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}

// Pages load on first visit (each is its own chunk), so the console opens fast
const guarded = (el: React.ReactNode, perm?: string) => (
  <AuthGuard><AdminLayout><RequirePerm perm={perm}><Suspense fallback={<div className="skeleton h-40 w-full rounded-card" aria-busy="true" />}>{el}</Suspense></RequirePerm></AdminLayout></AuthGuard>
);

/** A page the role can't open: say so instead of showing a broken page. */
function RequirePerm({ perm, children }: { perm?: string; children: React.ReactNode }) {
  const { me, can, loading } = useMe();
  if (!perm || can(perm)) return <>{children}</>;
  if (loading && !me) return null;
  return (
    <div className="rounded-card border border-dashed border-ink-700 px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink-100">Your role can’t open this page.</p>
      <p className="mt-1 text-sm text-ink-400">Ask a SUPERADMIN if you need access.</p>
    </div>
  );
}

/** After sign-in: the first page this role can open. */
function Home() {
  const { me, can, loading, error } = useMe();
  if (loading && !me) return null;
  const first = NAV.find((i) => can(i.perm));
  if (first) return <Navigate to={first.path} replace />;
  return <div className="p-10 text-sm text-ink-300">{error || 'Your account has no admin pages.'}</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <MeProvider>
        <Routes>
          <Route path="/portal/secure-gateway-entry" element={<LoginPortal />} />
          <Route path="/admin" element={<AuthGuard><Home /></AuthGuard>} />
          {NAV.map((i) => <Route key={i.path} path={i.path} element={guarded(i.element, i.perm)} />)}
          {/* Both of these must point at the login route, not at a guarded page:
              AuthGuard redirects unauthenticated visitors here, so sending them
              onward to a guarded route creates an infinite redirect loop. */}
          <Route path="/" element={<Navigate to="/portal/secure-gateway-entry" replace />} />
          <Route path="*" element={<Navigate to="/portal/secure-gateway-entry" replace />} />
        </Routes>
      </MeProvider>
    </BrowserRouter>
  );
}
