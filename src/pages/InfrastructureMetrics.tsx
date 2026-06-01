import { useEffect, useState } from 'react';
import axios from 'axios';
import { Database, HardDrive, Cpu, Layers } from 'lucide-react';

export default function InfrastructureMetrics() {
  const [infra, setInfra] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInfraDiagnostics = async () => {
      try {
        const token = localStorage.getItem('admin_session_token');
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const API_URL = isLocal 
          ? 'http://localhost:3000/api/admin/infrastructure-diagnostics'
          : 'https://api.fluntr.com/api/v1/admin/infrastructure-diagnostics';

        const res = await axios.get(API_URL, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) setInfra(res.data.data);
      } catch (err) {
        console.error("Infrastructure lookup fault:", err);
      } finally { setLoading(false); }
    };
    loadInfraDiagnostics();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0B0F19] text-indigo-400 font-mono text-xs">Querying S3 Storage Blobs & Schema Rows...</div>;

  return (
    <div className="space-y-6 animate-fadeIn font-mono text-[#E2E8F0]">
      <div>
        <h1 className="text-xl font-black text-white uppercase tracking-tight">Cloud Infrastructure Logs</h1>
        <p className="text-xs text-[#64748B] mt-0.5">Real-time AWS data metrics tracking relational storage rows and asset sizes.</p>
      </div>

      {/* Top Static Core Network Mappings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0F172A] border border-[#1E293B] p-4 rounded-xl flex items-center gap-3">
          <HardDrive className="text-indigo-500" size={18} />
          <div>
            <div className="text-[9px] text-[#64748B] uppercase font-bold">AWS S3 Vector</div>
            <div className="text-xs font-black text-white mt-0.5">digital-wardrobe-images</div>
          </div>
        </div>
        <div className="bg-[#0F172A] border border-[#1E293B] p-4 rounded-xl flex items-center gap-3">
          <Database className="text-emerald-500" size={18} />
          <div>
            <div className="text-[9px] text-[#64748B] uppercase font-bold">PostgreSQL RDS Engine</div>
            <div className="text-xs font-black text-white mt-0.5">Connected (Active Pool)</div>
          </div>
        </div>
        <div className="bg-[#0F172A] border border-[#1E293B] p-4 rounded-xl flex items-center gap-3">
          <Cpu className="text-purple-500" size={18} />
          <div>
            <div className="text-[9px] text-[#64748B] uppercase font-bold">Express Environment Host</div>
            <div className="text-xs font-black text-white mt-0.5">AWS Elastic Beanstalk</div>
          </div>
        </div>
      </div>

      {/* Live Dynamic Cloud Real-Time Meter Data Sheets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* AWS S3 Density Metrics */}
        <div className="bg-[#0F172A] border border-[#1E293B] p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-[#1E293B] pb-2 text-[#94A3B8] font-bold text-xs uppercase">
            <Layers size={14} className="text-indigo-500" />
            <span>Object Registry Metrics</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1E293B]/30 border border-[#1E293B] p-4 rounded-lg">
              <div className="text-[9px] text-gray-500 uppercase font-bold">Total Wardrobe Images</div>
              <div className="text-xl font-black mt-1 text-white">{infra?.storage?.objectCount ?? 0}</div>
            </div>
            <div className="bg-[#1E293B]/30 border border-[#1E293B] p-4 rounded-lg">
              <div className="text-[9px] text-gray-500 uppercase font-bold">Storage Density Vol.</div>
              <div className="text-xl font-black mt-1 text-indigo-400">{infra?.storage?.sizeMB ?? '0.00'} <span className="text-xs text-gray-500">MB</span></div>
            </div>
          </div>
          <div className="flex justify-between items-center text-xs bg-[#1E293B]/20 p-3 border border-[#1E293B] rounded-lg">
            <span className="text-gray-400">Average Upload Size Weight</span>
            <span className="font-bold text-white">{infra?.storage?.avgSizeKB ?? 0} KB / file</span>
          </div>
        </div>

        {/* Database Row Multipliers */}
        <div className="bg-[#0F172A] border border-[#1E293B] p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-[#1E293B] pb-2 text-[#94A3B8] font-bold text-xs uppercase">
            <Database size={14} className="text-emerald-500" />
            <span>Prisma Record Capacities</span>
          </div>
          <div className="space-y-2.5 pt-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">User Profiles Collection</span>
              <span className="font-bold text-white">{infra?.database?.users ?? 0} rows</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Digitized Closet Items</span>
              <span className="font-bold text-white">{infra?.database?.closetItems ?? 0} rows</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Asynchronous System Logs</span>
              <span className="font-bold text-white">{infra?.database?.activityLogs ?? 0} rows</span>
            </div>
            <div className="pt-3 border-t border-[#1E293B] flex justify-between font-bold text-xs">
              <span className="text-emerald-400 uppercase tracking-wide text-[10px]">Aggregate Table Load Matrix</span>
              <span className="bg-emerald-950/40 text-emerald-400 px-2 py-0.5 rounded border border-emerald-900/30 font-mono">
                {infra?.database?.totalIndexedRows ?? 0} rows
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
