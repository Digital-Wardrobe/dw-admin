import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import React from 'react';
import { LayoutDashboard, TrendingUp, Users, Server, UserPlus, LogOut } from 'lucide-react';

import DashboardSummary from './pages/DashboardSummary';
import BusinessMetrics from './pages/BusinessMetrics';
import UserManagement from './pages/UserManagement';
import InfrastructureMetrics from './pages/InfrastructureMetrics';
import StaffManagement from './pages/StaffManagement';
import LoginPortal from './pages/LoginPortal';
import AuthGuard from './components/AuthGuard';

/* Section names are what an operator would call them, not what an internal
   service is named. "Terminate Link" and "Cloud Resources" made people guess. */
const NAV = [
  { path: '/admin/dashboard', name: 'Overview',      icon: LayoutDashboard },
  { path: '/admin/business',  name: 'Growth',        icon: TrendingUp },
  { path: '/admin/users',     name: 'Users',         icon: Users },
  { path: '/admin/infra',     name: 'Infrastructure',icon: Server },
  { path: '/admin/staff',     name: 'Team',          icon: UserPlus },
];

function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const signOut = () => {
    localStorage.removeItem('admin_session_token');
    localStorage.removeItem('admin_user');
    navigate('/portal/secure-gateway-entry');
  };

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
        className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col justify-between border-r border-ink-700 bg-ink-850"
        aria-label="Console sections"
      >
        <div>
          <div className="flex items-center gap-3 border-b border-ink-700 px-5 py-5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-inner border border-brand-line bg-brand-wash font-mono text-sm font-semibold tracking-tight text-brand"
            >
              F
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-ink-50">Fluntr</p>
              <p className="truncate text-label text-ink-400">Admin console</p>
            </div>
          </div>

          <nav className="p-3">
            <ul className="space-y-0.5">
              {NAV.map(({ path, name, icon: Icon }) => {
                const active = location.pathname === path;
                return (
                  <li key={path}>
                    <Link
                      to={path}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex items-center gap-3 rounded-inner px-3 py-2 text-sm transition
                        ${active
                          ? 'bg-brand-wash font-medium text-brand'
                          : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'}`}
                    >
                      {/* The active marker is a rail, not a filled block —
                          it reads as position rather than as a button. */}
                      {active && (
                        <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" />
                      )}
                      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                      {name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* One sign-out in the whole console. Pages used to carry their own. */}
        <div className="border-t border-ink-700 p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-inner px-3 py-2 text-sm text-ink-300 transition hover:bg-ink-800 hover:text-bad active:translate-y-px"
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <main id="main" className="pl-60">
        {/* Bottom padding slightly exceeds top so the page reads optically
            centred rather than mathematically so. */}
        <div className="mx-auto w-full max-w-[1400px] px-8 pb-14 pt-8">
          {current && <p className="sr-only">{current.name}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}

const guarded = (el: React.ReactNode) => (
  <AuthGuard><AdminLayout>{el}</AdminLayout></AuthGuard>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/portal/secure-gateway-entry" element={<LoginPortal />} />
        <Route path="/admin/dashboard" element={guarded(<DashboardSummary />)} />
        <Route path="/admin/business"  element={guarded(<BusinessMetrics />)} />
        <Route path="/admin/users"     element={guarded(<UserManagement />)} />
        <Route path="/admin/infra"     element={guarded(<InfrastructureMetrics />)} />
        <Route path="/admin/staff"     element={guarded(<StaffManagement />)} />
        {/* Unknown paths used to render the login form in place, which made a
            typo look like a logout. Redirect instead. */}
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
