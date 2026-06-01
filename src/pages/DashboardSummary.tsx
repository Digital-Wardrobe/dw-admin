import { useEffect, useState } from 'react';
import axios from 'axios';
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import { Users, Wifi, Globe, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardSummary() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem('admin_session_token');
        if (!token) {
          setError("No session token found");
          setLoading(false);
          return;
        }

        // Detect if running locally or in production
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const API_URL = isLocal 
          ? 'http://localhost:3000/api/admin' 
          : import.meta.env.VITE_API_URL;
        const url = `${API_URL}/dashboard-summary`;

        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          setMetrics(res.data.data);
        } else {
          setError("Failed to fetch live cloud telemetry");
        }
      } catch (err: any) {
        console.error("Dashboard metric parsing error:", err);
        setError(err.response?.data?.message || err.message || "Failed to load telemetry");
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_session_token');
    localStorage.removeItem('admin_user');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#080808] text-white">
        <div className="flex flex-col items-center gap-4">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent"></span>
          <span className="text-sm font-semibold tracking-wide text-gray-400">Loading Live Cloud Telemetry...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#080808] p-4 text-white">
        <h2 className="mb-4 text-xl font-bold text-red-500">Telemetry Synchronization Failed</h2>
        <p className="mb-6 text-sm text-[#666]">{error}</p>
        <button onClick={handleLogout} className="rounded-full bg-[#111] px-6 py-2 text-xs font-semibold text-white border border-[#222] hover:bg-[#222] transition-all">
          Return to Portal Gateway
        </button>
      </div>
    );
  }

  // Map backend data to visual chart arrays
  const networkData = metrics?.networkDistribution?.map((item: any) => ({
    name: item.networkType,
    value: item._count._all
  })) || [];

  const COLORS = ['#00E5FF', '#FF007F', '#8884d8'];

  return (
    <div className="min-h-screen w-full bg-[#080808] p-8 text-white font-sans">
      {/* Header Row */}
      <div className="mb-8 flex items-center justify-between border-b border-[#1A1A1A] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fluntr Engine Analytics</h1>
          <p className="text-sm text-[#666]">Real-time hardware connectivity and user telemetry logs</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full bg-[#111] px-4 py-2 text-xs font-semibold text-green-400 border border-[#222]">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" /> AWS Core Online
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-full bg-red-950/40 border border-red-900/50 hover:bg-red-900/40 px-4 py-2 text-xs font-semibold text-red-400 transition-all cursor-pointer"
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </div>

      {/* Top Metrics Cards Grid */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl bg-[#111] p-6 border border-[#1A1A1A] hover:border-cyan-500/20 transition-all duration-300">
          <div className="flex items-center justify-between text-[#666] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Registered Accounts</span>
            <Users size={18} className="text-white" />
          </div>
          <h2 className="text-3xl font-extrabold">{metrics?.summary?.totalUsers || 0}</h2>
        </div>

        <div className="rounded-2xl bg-[#111] p-6 border border-[#1A1A1A] hover:border-pink-500/20 transition-all duration-300">
          <div className="flex items-center justify-between text-[#666] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Activity Logs Recorded</span>
            <Wifi size={18} className="text-white" />
          </div>
          <h2 className="text-3xl font-extrabold">{metrics?.summary?.totalActivityLogs || 0}</h2>
        </div>

        <div className="rounded-2xl bg-[#111] p-6 border border-[#1A1A1A] hover:border-cyan-500/20 transition-all duration-300">
          <div className="flex items-center justify-between text-[#666] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Cloudflare Proxy Vectors</span>
            <Globe size={18} className="text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-[#00E5FF]">Active Edge</h2>
        </div>
      </div>

      {/* Charts Visualization Row */}
      <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Network Type Breakdown (Pie/Donut Layout) */}
        <div className="rounded-2xl bg-[#111] p-6 border border-[#1A1A1A] lg:col-span-1 flex flex-col justify-between hover:border-purple-500/10 transition-all duration-300">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#666] mb-4">Device Connectivity Ratio</h3>
          <div className="h-64 w-full flex items-center justify-center">
            {networkData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={networkData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="name">
                    {networkData.map((_: any, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#222', color: '#fff' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-[#555]">No telemetry records recorded yet</div>
            )}
          </div>
        </div>

        {/* Global User Data Grid List View */}
        <div className="rounded-2xl bg-[#111] p-6 border border-[#1A1A1A] lg:col-span-2 hover:border-[#222] transition-all duration-300">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#666] mb-4">Account Diagnostic Directory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#222] text-[#444] uppercase text-[10px] tracking-wider font-extrabold">
                  <th className="pb-3">User Profiling</th>
                  <th className="pb-3">Role Matrix</th>
                  <th className="pb-3">Cloudflare Geolocation Registration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]">
                {metrics?.userList?.map((user: any) => (
                  <tr key={user.id} className="hover:bg-[#151515] transition-colors">
                    <td className="py-3">
                      <div className="font-semibold text-white">{user.profileName}</div>
                      <div className="text-xs text-[#555]">@{user.username} • {user.email}</div>
                    </td>
                    <td className="py-3">
                      <span className={`rounded-md px-2 py-1 text-[10px] font-black tracking-wide uppercase ${user.role === 'USER' ? 'bg-[#222] text-[#888]' : 'bg-cyan-950 text-[#00E5FF] border border-cyan-800/40'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-[#888]">
                      {user.signupCity && user.signupCountry ? `${user.signupCity}, ${user.signupCountry}` : 'Awaiting Metadata Sync'}
                    </td>
                  </tr>
                ))}
                {(!metrics?.userList || metrics.userList.length === 0) && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-xs text-[#444] uppercase tracking-wider">
                      Zero registration entries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
