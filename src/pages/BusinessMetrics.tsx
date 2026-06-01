import { useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCw, MapPin, Activity, Smartphone, Layers, FileText } from 'lucide-react';

export default function BusinessMetrics() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchGrowthAnalytics = async (force = false) => {
    if (force) setSyncing(true);
    else setLoading(true);
    try {
      const token = localStorage.getItem('admin_session_token');
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const API_URL = isLocal 
        ? 'http://localhost:3000/api/admin' 
        : import.meta.env.VITE_API_URL;
      const url = `${API_URL}/growth-analytics`;

      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
        setAnalytics(res.data.metrics);
      }
    } catch (err) {
      console.error("Growth metrics fetch fault:", err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchGrowthAnalytics(false);
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center font-mono text-xs text-indigo-400 uppercase tracking-widest animate-pulse">
        Aggregating system velocity matrix...
      </div>
    );
  }

  const { userVelocity, userStates, deviceDistribution, geoDistribution, contentVelocity } = analytics || {};

  // Device calculations
  const androidItem = deviceDistribution?.find((d: any) => d.devicePlatform === 'ANDROID');
  const iosItem = deviceDistribution?.find((d: any) => d.devicePlatform === 'IOS');
  const androidCount = androidItem?._count?._all ?? 0;
  const iosCount = iosItem?._count?._all ?? 0;
  const totalDeviceCount = androidCount + iosCount || 1;
  const androidPercentage = Math.round((androidCount / totalDeviceCount) * 100);
  const iosPercentage = 100 - androidPercentage;

  return (
    <div className="space-y-6 animate-fadeIn font-mono text-[#E2E8F0]">
      {/* Header Context */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight uppercase">Platform Growth Dashboard</h1>
          <p className="text-xs text-[#64748B] mt-0.5">Automated telemetry aggregation mapping user velocity and geographical clusters.</p>
        </div>
        <button 
          onClick={() => fetchGrowthAnalytics(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] border border-[#1E293B] hover:border-indigo-500 px-4 py-2 text-xs font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw size={12} className={syncing ? "animate-spin text-indigo-500" : ""} />
          {syncing ? "Syncing..." : "Refresh Analytics"}
        </button>
      </div>

      {/* 1. Global Status Overview Matrix (Total / Active / Inactive) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0F172A] border border-[#1E293B] p-5 rounded-xl space-y-1 relative overflow-hidden group">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Total Registered Accounts</div>
          <div className="text-3xl font-black text-white">{userVelocity?.total ?? 0}</div>
          <div className="text-[9px] text-[#475569] uppercase font-semibold">User records stored in cluster</div>
        </div>
        <div className="bg-[#0F172A] border border-[#1E293B] p-5 rounded-xl space-y-1 relative overflow-hidden group">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active User Pulse (30D)</span>
          </div>
          <div className="text-3xl font-black text-emerald-400">{userStates?.active ?? 0}</div>
          <div className="text-[9px] text-[#475569] uppercase font-semibold">Active activity log sign-ins</div>
        </div>
        <div className="bg-[#0F172A] border border-[#1E293B] p-5 rounded-xl space-y-1 relative overflow-hidden group">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Stagnant / Inactive Rows</div>
          <div className="text-3xl font-black text-orange-400">{userStates?.inactive ?? 0}</div>
          <div className="text-[9px] text-[#475569] uppercase font-semibold">Accounts without recent logs</div>
        </div>
      </div>

      {/* 2. Time-Horizon Velocity Ticker (Today / 7D / 30D) */}
      <div className="bg-[#0F172A] border border-[#1E293B] p-5 rounded-xl">
        <h3 className="text-xs uppercase text-[#64748B] tracking-wider mb-4 font-bold">User Acquisition velocity windows</h3>
        <div className="grid grid-cols-3 gap-4 border border-[#1E293B] rounded-lg divide-x divide-[#1E293B]">
          <div className="p-4 text-center">
            <div className="text-[9px] text-[#64748B] uppercase font-bold">Today</div>
            <div className="text-xl font-black text-white mt-1">+{userVelocity?.today ?? 0}</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-[9px] text-[#64748B] uppercase font-bold">Last 7 Days</div>
            <div className="text-xl font-black text-indigo-400 mt-1">+{userVelocity?.last7Days ?? 0}</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-[9px] text-[#64748B] uppercase font-bold">Last 30 Days</div>
            <div className="text-xl font-black text-indigo-300 mt-1">+{userVelocity?.last30Days ?? 0}</div>
          </div>
        </div>
      </div>

      {/* 3. Regional & Device Platform Distribution Split-Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional Distribution List */}
        <div className="bg-[#0F172A] border border-[#1E293B] p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-[#1E293B] pb-2 text-[#94A3B8] font-bold text-xs uppercase">
            <MapPin size={14} className="text-indigo-400" />
            <span>Top Regional Hubs (Cities)</span>
          </div>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {geoDistribution && geoDistribution.length > 0 ? (
              geoDistribution.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-[#1E293B]/20 p-2.5 border border-[#1E293B]/60 rounded-lg hover:border-indigo-500/50 transition-colors">
                  <span className="text-xs text-white font-bold">{item.city || 'Unknown Cluster'}</span>
                  <span className="bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-900/40">
                    {item._count?._all ?? 0} users
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-xs text-[#475569] py-8 uppercase">Awaiting geo records...</div>
            )}
          </div>
        </div>

        {/* Device Distribution Card */}
        <div className="bg-[#0F172A] border border-[#1E293B] p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-[#1E293B] pb-2 text-[#94A3B8] font-bold text-xs uppercase">
            <Smartphone size={14} className="text-indigo-400" />
            <span>Platform Device Segmentations</span>
          </div>
          
          <div className="space-y-6 pt-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-emerald-400">ANDROID: {androidPercentage}% ({androidCount})</span>
              <span className="text-indigo-400">IOS: {iosPercentage}% ({iosCount})</span>
            </div>

            {/* Split Progress Bar */}
            <div className="w-full h-4 bg-[#1E293B] rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${androidPercentage}%` }} />
              <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${iosPercentage}%` }} />
            </div>

            <div className="bg-[#1E293B]/25 p-3 rounded-lg border border-[#1E293B] text-[10px] text-gray-500 uppercase leading-relaxed">
              * Calculated dynamically from active app client handshake telemetry indices.
            </div>
          </div>
        </div>
      </div>

      {/* 4. Daily Content Velocity Monitors */}
      <div className="bg-[#0F172A] border border-[#1E293B] p-5 rounded-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-[#1E293B] pb-2 text-[#94A3B8] font-bold text-xs uppercase">
          <Activity size={14} className="text-indigo-400" />
          <span>Daily content interaction velocity</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#1E293B]/20 border border-[#1E293B] p-4 rounded-xl flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-indigo-950/40 border border-indigo-900/30 flex items-center justify-center text-indigo-400">
              <FileText size={18} />
            </div>
            <div>
              <div className="text-[9px] text-[#64748B] uppercase font-bold">Posts Created Today</div>
              <div className="text-xl font-black text-white mt-0.5">{contentVelocity?.postsCreatedToday ?? 0}</div>
            </div>
          </div>

          <div className="bg-[#1E293B]/20 border border-[#1E293B] p-4 rounded-xl flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-emerald-950/40 border border-emerald-900/30 flex items-center justify-center text-emerald-400">
              <Layers size={18} />
            </div>
            <div>
              <div className="text-[9px] text-[#64748B] uppercase font-bold">Closet Items Digitized Today</div>
              <div className="text-xl font-black text-white mt-0.5">{contentVelocity?.itemsDigitizedToday ?? 0}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
