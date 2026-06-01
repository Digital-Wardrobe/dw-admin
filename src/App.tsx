import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import React from 'react';
import { LayoutDashboard, BarChart3, Users, HardDrive, UserPlus, LogOut } from 'lucide-react';

import DashboardSummary from './pages/DashboardSummary';
import BusinessMetrics from './pages/BusinessMetrics';
import UserManagement from './pages/UserManagement';
import InfrastructureMetrics from './pages/InfrastructureMetrics';
import StaffManagement from './pages/StaffManagement';
import LoginPortal from './pages/LoginPortal';
import AuthGuard from './components/AuthGuard';

function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogOut = () => {
    localStorage.removeItem('admin_session_token');
    navigate('/portal/secure-gateway-entry');
  };

  const navItems = [
    { path: '/admin/dashboard', name: 'Overview Console', icon: <LayoutDashboard size={16} /> },
    { path: '/admin/business', name: 'Growth Analytics', icon: <BarChart3 size={16} /> },
    { path: '/admin/users', name: 'User Directory', icon: <Users size={16} /> },
    { path: '/admin/infra', name: 'Cloud Resources', icon: <HardDrive size={16} /> },
    { path: '/admin/staff', name: 'Staff Provisioning', icon: <UserPlus size={16} /> },
  ];

  return (
    <div className="flex min-h-screen w-full bg-[#0B0F19] text-[#E2E8F0] font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Modern Left Navigation Sidebar */}
      <aside className="w-64 border-r border-[#1E293B] bg-[#0F172A] flex flex-col justify-between fixed h-full z-10">
        <div>
          {/* Premium Brand Header */}
          <div className="p-6 border-b border-[#1E293B] flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-mono text-sm font-black text-white tracking-tighter">
              FL
            </div>
            <div>
              <h2 className="text-xs font-black tracking-widest uppercase text-white font-mono">Fluntr Engine</h2>
              <p className="text-[10px] text-[#64748B] font-mono tracking-tight">HQ Control // v1.0</p>
            </div>
          </div>

          {/* Nav Link Items */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold font-mono tracking-wide transition-all ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/60'
                  }`}
                >
                  {item.icon}
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Action Section */}
        <div className="p-4 border-t border-[#1E293B]">
          <button 
            onClick={handleLogOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold font-mono text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-all cursor-pointer border-none outline-none"
          >
            <LogOut size={16} />
            Terminate Link
          </button>
        </div>
      </aside>

      {/* Right View Window Main Workspace */}
      <main className="flex-1 pl-64 w-full">
        <div className="p-8 w-full max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/portal/secure-gateway-entry" element={<LoginPortal />} />
        <Route path="/admin/dashboard" element={<AuthGuard><AdminLayout><DashboardSummary /></AdminLayout></AuthGuard>} />
        <Route path="/admin/business" element={<AuthGuard><AdminLayout><BusinessMetrics /></AdminLayout></AuthGuard>} />
        <Route path="/admin/users" element={<AuthGuard><AdminLayout><UserManagement /></AdminLayout></AuthGuard>} />
        <Route path="/admin/infra" element={<AuthGuard><AdminLayout><InfrastructureMetrics /></AdminLayout></AuthGuard>} />
        <Route path="/admin/staff" element={<AuthGuard><AdminLayout><StaffManagement /></AdminLayout></AuthGuard>} />
        <Route path="*" element={<LoginPortal />} />
      </Routes>
    </BrowserRouter>
  );
}
