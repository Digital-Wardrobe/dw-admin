/*
 * Design preview entry.
 *
 * Renders the real console components against fixture data so the layout,
 * palette, typography and states can be reviewed without a backend. It is not
 * the app: there is no sign-in, no token, and no request ever leaves the page.
 * The production entry is src/main.tsx and is untouched.
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

import { AdminLayout } from './App';
import DashboardSummary from './pages/DashboardSummary';
import BusinessMetrics from './pages/BusinessMetrics';
import UserManagement from './pages/UserManagement';
import InfrastructureMetrics from './pages/InfrastructureMetrics';
import StaffManagement from './pages/StaffManagement';
import './index.css';

/* ── Fixtures ──────────────────────────────────────────────────────────────
   Deliberately uneven numbers and real-looking names. Round figures and
   "Jane Smith" make a design review lie to you about how the layout copes. */
const FIXTURES: Record<string, any> = {
  'dashboard-summary': {
    success: true,
    data: {
      summary: { totalUsers: 12847, totalActivityLogs: 341962 },
      networkDistribution: [
        { networkType: 'WIFI',     _count: { _all: 7412 } },
        { networkType: 'CELLULAR', _count: { _all: 4186 } },
        { networkType: 'UNKNOWN',  _count: { _all: 1249 } },
      ],
    },
  },
  'growth-analytics': {
    success: true,
    metrics: {
      userVelocity: [
        { date: 'Mar 3',  count: 218 }, { date: 'Mar 10', count: 347 },
        { date: 'Mar 17', count: 291 }, { date: 'Mar 24', count: 508 },
        { date: 'Mar 31', count: 664 }, { date: 'Apr 7',  count: 592 },
        { date: 'Apr 14', count: 803 },
      ],
      userStates: [
        { name: 'Onboarded', value: 9214 },
        { name: 'Signed up, not onboarded', value: 2418 },
        { name: 'Dormant 30d+', value: 1215 },
      ],
      deviceDistribution: [
        { name: 'iOS', value: 6841 }, { name: 'Android', value: 5772 }, { name: 'Web', value: 234 },
      ],
      geoDistribution: [
        { country: 'India', count: 5142 }, { country: 'United Kingdom', count: 2318 },
        { country: 'United States', count: 1976 }, { country: 'United Arab Emirates', count: 884 },
        { country: 'Singapore', count: 617 },
      ],
      contentVelocity: [
        { date: 'Mar 3', posts: 412, items: 1184 }, { date: 'Mar 17', posts: 688, items: 1902 },
        { date: 'Mar 31', posts: 931, items: 2617 }, { date: 'Apr 14', posts: 1264, items: 3488 },
      ],
    },
  },
  'users-directory': {
    success: true,
    data: {
      totalPages: 214,
      users: [
        { id: 'u1', profileName: 'Ananya Raghunathan', username: 'ananyar', email: 'ananya.r@hey.com',        role: 'USER',       isOnboarded: true,  storageAssets: { estimatedMB: '184.60', fileCount: 92 } },
        { id: 'u2', profileName: 'Tomás Vilanova',     username: 'tvilanova', email: 'tomas@vilanova.studio', role: 'USER',       isOnboarded: true,  storageAssets: { estimatedMB: '76.10',  fileCount: 41 } },
        { id: 'u3', profileName: 'Priya Balakrishnan', username: 'priyab',  email: 'priya.b@outlook.com',     role: 'ADMIN',      isOnboarded: true,  storageAssets: { estimatedMB: '12.40',  fileCount: 8 } },
        { id: 'u4', profileName: 'Marcus Oyelaran',    username: 'moyelaran', email: 'm.oyelaran@gmail.com',  role: 'USER',       isOnboarded: false, storageAssets: { estimatedMB: '0.00',   fileCount: 0 } },
        { id: 'u5', profileName: 'Hana Okonkwo',       username: 'hanao',   email: 'hana@okonkwo.co',         role: 'USER',       isOnboarded: true,  storageAssets: { estimatedMB: '311.80', fileCount: 147 } },
        { id: 'u6', profileName: 'Rahul Deshmukh',     username: 'rdesh',   email: 'rahul.deshmukh@proton.me',role: 'SUPERADMIN', isOnboarded: true,  storageAssets: { estimatedMB: '4.20',   fileCount: 3 } },
      ],
    },
  },
  'infra-metrics': {
    success: true,
    data: {
      storage: { objectCount: 48213, sizeMB: '19418.70', avgSizeKB: 412, status: 'WARNING_UNOPTIMIZED' },
      database: { users: 12847, posts: 28104, closetItems: 96412, messages: 214883 },
    },
  },
};

/* Answer from fixtures instead of the network. Nothing reaches the internet. */
const match = (url: string) => Object.keys(FIXTURES).find(k => url.includes(k));
axios.defaults.adapter = async (config: any) => {
  const key = match(config.url || '');
  await new Promise(r => setTimeout(r, 420));   // enough to see skeletons
  return {
    data: key ? FIXTURES[key] : { success: true, data: {} },
    status: 200, statusText: 'OK', headers: {}, config,
  } as any;
};

// AdminLayout reads this for the signed-in label; no real token is involved.
try {
  localStorage.setItem('admin_session_token', 'preview');
  localStorage.setItem('admin_user', JSON.stringify({ role: 'SUPERADMIN', username: 'preview' }));
} catch { /* private mode */ }

function PreviewBanner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-brand-line bg-ink-850/95 px-4 py-2 text-xs text-ink-300 shadow-lift backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
        Design preview. Sample data, no backend connected.
        <button onClick={() => setOpen(false)} className="ml-1 rounded px-1.5 py-0.5 text-ink-400 transition hover:text-ink-100">
          Hide
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* MemoryRouter keeps navigation entirely in memory, so the preview works
        on static hosting with no server-side rewrite rules. */}
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <AdminLayout>
        <Routes>
          <Route path="/admin/dashboard" element={<DashboardSummary />} />
          <Route path="/admin/business"  element={<BusinessMetrics />} />
          <Route path="/admin/users"     element={<UserManagement />} />
          <Route path="/admin/infra"     element={<InfrastructureMetrics />} />
          <Route path="/admin/staff"     element={<StaffManagement />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </AdminLayout>
      <PreviewBanner />
    </MemoryRouter>
  </React.StrictMode>,
);
