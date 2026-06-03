import { useEffect, useState } from 'react';
import axios from 'axios';
import { Database, HardDrive, Cpu, Layers, TableProperties, RefreshCw } from 'lucide-react';

// ── Utility: Convert raw bytes → human-readable string ──────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0 || bytes == null) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Priority table display names (maps pg relname → label)
const TABLE_LABELS: Record<string, string> = {
  User:            'User Profiles',
  Post:            'Feed Posts',
  ClosetItem:      'Closet Items',
  Follow:          'Follow Graph',
  Collection:      'Collections',
  Like:            'Likes',
  Comment:         'Comments',
  Notification:    'Notifications',
  UserActivityLog: 'Activity Logs',
  Mirror:          'Mirrors',
  Vibe:            'Vibes',
  SavedItem:       'Saved Items',
};

export default function InfrastructureMetrics() {
  const [infra, setInfra] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInfraDiagnostics = async (force = false) => {
    force ? setRefreshing(true) : setLoading(true);
    try {
      const token = localStorage.getItem('admin_session_token');
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      const url = `${API_URL}infrastructure-metrics${force ? '?force=true' : ''}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) setInfra(res.data.data);
    } catch (err) {
      console.error('Infrastructure lookup fault:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadInfraDiagnostics(); }, []);

  // Extract table sizes — surface the three primary tables first
  const tableSizes: { table: string; bytes: number; prettySize: string }[] =
    infra?.database?.tableSizes ?? [];

  const primaryTables = ['User', 'Post', 'ClosetItem'];
  const primaryRows = primaryTables
    .map(name => tableSizes.find(t => t.table === name))
    .filter(Boolean) as typeof tableSizes;
  const otherRows = tableSizes.filter(t => !primaryTables.includes(t.table));

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#0B0F19] text-indigo-400 font-mono text-xs">
      Querying S3 Storage Blobs &amp; Schema Rows...
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn font-mono text-[#E2E8F0]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">Cloud Infrastructure Logs</h1>
          <p className="text-xs text-[#64748B] mt-0.5">Real-time AWS data metrics tracking relational storage rows and asset sizes.</p>
        </div>
        <button
          onClick={() => loadInfraDiagnostics(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 bg-indigo-950/30 border border-indigo-900/40 px-3 py-2 rounded-lg hover:bg-indigo-600 hover:text-white transition-all cursor-pointer disabled:opacity-40"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Force Refresh'}
        </button>
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
          <div className={`flex justify-between items-center text-xs p-3 rounded-lg border ${
            infra?.storage?.status === 'WARNING_UNOPTIMIZED'
              ? 'bg-amber-950/30 border-amber-900/40 text-amber-400'
              : 'bg-emerald-950/30 border-emerald-900/40 text-emerald-400'
          }`}>
            <span className="uppercase font-bold text-[10px]">Compression Status</span>
            <span className="font-mono text-[10px]">{infra?.storage?.status ?? 'UNKNOWN'}</span>
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

      {/* ── PostgreSQL Physical Table Storage Footprint ──────────────────────── */}
      <div className="bg-[#0F172A] border border-[#1E293B] p-5 rounded-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-[#1E293B] pb-2 text-[#94A3B8] font-bold text-xs uppercase">
          <TableProperties size={14} className="text-violet-400" />
          <span>PostgreSQL Physical Table Storage</span>
          <span className="ml-auto text-[9px] text-[#475569] font-normal normal-case">pg_total_relation_size incl. indexes + TOAST</span>
        </div>

        {/* Primary tables — Users, Posts, ClosetItems — highlighted */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {primaryRows.length > 0 ? primaryRows.map(row => (
            <div key={row.table} className="bg-[#1E293B]/40 border border-[#1E293B] p-4 rounded-xl">
              <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">
                {TABLE_LABELS[row.table] ?? row.table}
              </div>
              <div className="text-2xl font-black text-white leading-tight">
                {formatBytes(row.bytes)}
              </div>
              <div className="text-[10px] text-violet-400 mt-1 font-mono">{row.prettySize}</div>
            </div>
          )) : (
            <div className="col-span-3 text-center py-6 text-xs text-[#475569]">
              No table size data — backend may not have returned $queryRaw results yet.
            </div>
          )}
        </div>

        {/* Full table list */}
        {otherRows.length > 0 && (
          <div className="border border-[#1E293B] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1E293B]/30 text-[#64748B] uppercase text-[9px] tracking-wider font-bold border-b border-[#1E293B]">
                  <th className="py-2 pl-4 text-left">Table</th>
                  <th className="py-2 text-right pr-4">Physical Size</th>
                  <th className="py-2 text-right pr-4">Raw Bytes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 text-gray-300">
                {otherRows.map(row => (
                  <tr key={row.table} className="hover:bg-[#1E293B]/20 transition-colors">
                    <td className="py-2.5 pl-4 font-semibold">{TABLE_LABELS[row.table] ?? row.table}</td>
                    <td className="py-2.5 text-right pr-4 text-violet-300 font-mono font-bold">{formatBytes(row.bytes)}</td>
                    <td className="py-2.5 text-right pr-4 text-[#475569] font-mono text-[10px]">{row.bytes.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
