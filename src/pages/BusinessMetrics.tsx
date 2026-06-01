import { useEffect, useState } from 'react';
import axios from 'axios';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Calendar, RefreshCw } from 'lucide-react';

export default function BusinessMetrics() {
  const [activationData, setActivationData] = useState<any>(null);
  const [startDate, setStartDate] = useState('2026-05-01');
  const [endDate, setEndDate] = useState('2026-05-31');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchActivationMetrics = async (force = false) => {
    if (force) setSyncing(true);
    else setLoading(true);
    try {
      const token = localStorage.getItem('admin_session_token');
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const API_URL = isLocal 
        ? 'http://localhost:3000/api/admin' 
        : import.meta.env.VITE_API_URL;
      const base = `${API_URL}/activation-analytics`;
      const url = force ? `${base}?force=true&startDate=${startDate}&endDate=${endDate}` : `${base}?startDate=${startDate}&endDate=${endDate}`;

      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) setActivationData(res.data.data);
    } catch (err) {
      console.error("Data synchronization fault:", err);
    } finally { setLoading(false); setSyncing(false); }
  };

  useEffect(() => { fetchActivationMetrics(false); }, []);

  return (
    <div className="space-y-6 animate-fadeIn text-[#E2E8F0]">
      {/* Header Context */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight font-mono uppercase">Growth Analytics Console</h1>
          <p className="text-xs text-[#64748B] mt-0.5">Real database metrics compiled directly from production transactional records.</p>
        </div>
        <button 
          onClick={() => fetchActivationMetrics(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] border border-[#1E293B] hover:border-indigo-500 px-4 py-2 font-mono text-xs font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw size={12} className={syncing ? "animate-spin text-indigo-500" : ""} />
          {syncing ? "Syncing..." : "Bypass Cache"}
        </button>
      </div>

      {/* Date Range Selection Toolbar */}
      <div className="flex items-center justify-between bg-[#0F172A] border border-[#1E293B] p-4 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-mono text-[#94A3B8]">
          <Calendar size={14} className="text-indigo-500" />
          <span>Date Bounds Configuration</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="bg-[#1E293B] border border-[#334155] rounded px-2.5 py-1 text-white outline-none" />
          <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="bg-[#1E293B] border border-[#334155] rounded px-2.5 py-1 text-white outline-none" />
          <button onClick={() => fetchActivationMetrics(false)} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-1 rounded font-bold text-white transition-all cursor-pointer">Apply</button>
        </div>
      </div>

      {/* Metric Visualization Content Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0F172A] border border-[#1E293B] p-5 rounded-xl space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">Activated Profiles</div>
          <div className="text-3xl font-black text-white font-mono tracking-tight">{activationData?.summary?.totalActivatedUsers ?? 0}</div>
        </div>
        <div className="bg-[#0F172A] border border-[#1E293B] p-5 rounded-xl space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">Power User Ratio</div>
          <div className="text-3xl font-black text-indigo-400 font-mono tracking-tight">{activationData?.summary?.powerUserRatio ?? '0.0'}%</div>
        </div>
      </div>

      {/* Distribution Horizontal Bars Graphic Block */}
      <div className="bg-[#0F172A] border border-[#1E293B] p-6 rounded-xl">
        <h3 className="text-xs font-mono uppercase text-[#64748B] tracking-wider mb-4 font-bold">User Wardrobe Capacity Spacing</h3>
        <div className="h-44 w-full font-mono">
          {loading ? (
            <div className="text-xs text-[#475569] text-center pt-16 uppercase tracking-wider">Aggregating database tiers...</div>
          ) : activationData?.distribution ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activationData.distribution} layout="vertical">
                <XAxis type="number" stroke="#334155" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={10} width={120} />
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }} />
                <Bar dataKey="value" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-xs text-[#475569] text-center pt-16 uppercase tracking-wider">No transactional metrics found inside selected window</div>
          )}
        </div>
      </div>
    </div>
  );
}
