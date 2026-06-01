import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, KeyRound, CheckCircle2, XCircle, Wifi, MapPin, Shirt, FolderHeart, X } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const [inspectorUser, setInspectorUser] = useState<any>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // State variables for password override
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_session_token');
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const API_URL = isLocal 
        ? `http://localhost:3000/api/admin/users-directory?search=${search}&page=${page}`
        : `https://api.fluntr.com/api/v1/admin/users-directory?search=${search}&page=${page}`;

      const res = await axios.get(API_URL, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
        setUsers(res.data.data.users);
        setTotalPages(res.data.data.totalPages);
      }
    } catch (err) {
      console.error("Error loading user index directory:", err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [page]);

  const openInspectorDrawer = async (userId: string) => {
    setInspectorLoading(true);
    setDrawerOpen(true);
    try {
      const token = localStorage.getItem('admin_session_token');
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const PROFILE_URL = isLocal 
        ? `http://localhost:3000/api/admin/user-profile-deep/${userId}`
        : `https://api.fluntr.com/api/v1/admin/user-profile-deep/${userId}`;

      const res = await axios.get(PROFILE_URL, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) setInspectorUser(res.data.data);
    } catch (err) {
      console.error("Failed deep profile data pull:", err);
    } finally { setInspectorLoading(false); }
  };

  const executePasswordReset = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      alert("Please enter a secure password string (min 6 chars).");
      return;
    }
    try {
      const token = localStorage.getItem('admin_session_token');
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const RESET_URL = isLocal 
        ? 'http://localhost:3000/api/admin/force-password-reset' 
        : 'https://api.fluntr.com/api/v1/admin/force-password-reset';
      
      const res = await axios.post(RESET_URL, { 
        userId: selectedUser.id, 
        newPassword 
      }, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (res.data.success) {
        alert(`Successfully updated password configuration for @${selectedUser.username}`);
        setModalOpen(false);
        setNewPassword('');
      }
    } catch (err) {
      alert("Failed execution override update protocol.");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn font-mono text-[#E2E8F0]">
      <div>
        <h1 className="text-xl font-black text-white uppercase tracking-tight">User Directory Workspace</h1>
        <p className="text-xs text-[#64748B] mt-0.5">Filter shoppers and inspect device telemetry variables straight from live system nodes.</p>
      </div>

      {/* Modern Query Form */}
      <form onSubmit={(e)=>{e.preventDefault(); setPage(1); fetchUsers();}} className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#475569]"><Search size={14} /></span>
          <input 
            type="text" 
            placeholder="Filter registry by typing name, @username, or email handle..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0F172A] py-3 pl-11 pr-4 text-xs font-semibold text-white outline-none focus:border-indigo-500/50 transition-colors placeholder:text-[#334155]"
          />
        </div>
        <button type="submit" className="rounded-lg bg-indigo-600 px-5 text-xs font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer">
          Query Registry
        </button>
      </form>

      {/* Table Component */}
      <div className="rounded-xl bg-[#0F172A] border border-[#1E293B] overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-xs text-indigo-400">Running database registry query...</div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E293B] bg-[#1E293B]/20 text-[#64748B] uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 pl-4">Account Profile Identifier</th>
                <th className="py-3">Clearance Level</th>
                <th className="py-3">Onboard Matrix</th>
                <th className="py-3 text-right pr-4">Diagnostic Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-gray-300">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-[#1E293B]/30 transition-colors cursor-pointer" onClick={() => openInspectorDrawer(u.id)}>
                  <td className="py-4 pl-4">
                    <div className="font-bold text-white hover:text-indigo-400 transition-colors">{u.profileName}</div>
                    <div className="text-[11px] text-[#475569] mt-0.5">@{u.username} • {u.email}</div>
                  </td>
                  <td className="py-4">
                    <span className="bg-[#1E293B] text-[#94A3B8] rounded px-1.5 py-0.5 text-[9px] font-bold uppercase">{u.role}</span>
                  </td>
                  <td className="py-4">
                    {u.isOnboarded 
                      ? <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Ready</span> 
                      : <span className="text-amber-500 font-bold flex items-center gap-1"><XCircle size={12}/> Pending</span>}
                  </td>
                  <td className="py-4 text-right pr-4">
                    <button className="text-[10px] font-bold text-indigo-400 bg-indigo-950/30 border border-indigo-900/40 rounded px-2.5 py-1 hover:bg-indigo-600 hover:text-white transition-all">Audit Engine →</button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-[#444] uppercase tracking-wider font-mono">
                    No user registry matches found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4 text-xs font-bold font-mono text-white">
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            className="px-4 py-2 bg-[#0F172A] border border-[#1E293B] rounded-xl hover:bg-[#1E293B] disabled:opacity-30 cursor-pointer"
          >
            PREV
          </button>
          <span className="px-4 py-2 text-gray-500 flex items-center">{page} / {totalPages}</span>
          <button 
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            className="px-4 py-2 bg-[#0F172A] border border-[#1E293B] rounded-xl hover:bg-[#1E293B] disabled:opacity-30 cursor-pointer"
          >
            NEXT
          </button>
        </div>
      )}

      {/* Sliding Side Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
          <div className="w-full max-w-[440px] bg-[#0F172A] border-l border-[#1E293B] h-full p-6 space-y-6 flex flex-col justify-between shadow-2xl relative text-white">
            <div>
              <button onClick={() => setDrawerOpen(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors cursor-pointer border-none bg-transparent outline-none"><X size={16} /></button>

              {inspectorLoading ? (
                <div className="text-center py-32 text-xs text-indigo-400 font-mono">Compiling direct index relational telemetry...</div>
              ) : (
                <div className="space-y-6 mt-4">
                  <div className="border-b border-[#1E293B] pb-4">
                    <h2 className="text-sm font-black text-white">{inspectorUser?.profileName}</h2>
                    <p className="text-xs text-[#64748B]">@{inspectorUser?.username}</p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[10px] uppercase font-bold text-[#475569] tracking-wider">Network Connection Footprint</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                      <div className="bg-[#1E293B]/40 border border-[#1E293B] p-3 rounded-lg flex items-center gap-2">
                        <Wifi size={14} className="text-indigo-400" />
                        <div>
                          <div className="text-[9px] text-gray-500 uppercase">Link Mode</div>
                          <div className="text-white font-bold mt-0.5">{inspectorUser?.telemetry?.network}</div>
                        </div>
                      </div>
                      <div className="bg-[#1E293B]/40 border border-[#1E293B] p-3 rounded-lg flex items-center gap-2">
                        <MapPin size={14} className="text-orange-400" />
                        <div>
                          <div className="text-[9px] text-gray-500 uppercase">Geo Location</div>
                          <div className="text-white font-bold mt-0.5 truncate max-w-[130px]">{inspectorUser?.telemetry?.location}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1E293B]/20 border border-[#1E293B] p-4 rounded-lg space-y-2 text-xs text-gray-300">
                    <div className="flex justify-between text-[11px] text-gray-400 border-b border-[#1E293B] pb-1.5 uppercase"><span>Parameter</span><span>Value</span></div>
                    <div className="flex justify-between"><span>User UUID</span><span className="text-[10px] text-gray-500">{inspectorUser?.id}</span></div>
                    <div className="flex justify-between"><span>Email Address</span><span>{inspectorUser?.email}</span></div>
                    <div className="flex justify-between"><span>Registered</span><span>{inspectorUser?.createdAt ? new Date(inspectorUser.createdAt).toLocaleDateString() : '-'}</span></div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[10px] uppercase font-bold text-[#475569] tracking-wider">Asset Relational Matrix</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                      <div className="bg-[#1E293B]/30 border border-[#1E293B] p-4 rounded-lg text-center">
                        <Shirt className="mx-auto text-indigo-400 mb-1" size={14} />
                        <div className="text-lg font-black text-white">{inspectorUser?.metrics?.clothesCount}</div>
                        <div className="text-[9px] text-gray-500 uppercase mt-0.5">Closet Clothes</div>
                      </div>
                      <div className="bg-[#1E293B]/30 border border-[#1E293B] p-4 rounded-lg text-center">
                        <FolderHeart className="mx-auto text-pink-400 mb-1" size={14} />
                        <div className="text-lg font-black text-white">{inspectorUser?.metrics?.collectionsCount}</div>
                        <div className="text-[9px] text-gray-500 uppercase mt-0.5">Collections</div>
                      </div>
                    </div>
                  </div>

                  {/* Manual Password Override Button */}
                  {inspectorUser && (
                    <button 
                      onClick={() => { setSelectedUser(inspectorUser); setModalOpen(true); }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-950/30 text-indigo-400 border border-indigo-900/40 px-4 py-3 text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all cursor-pointer mt-4"
                    >
                      <KeyRound size={14} /> Override Access Key
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="text-[9px] text-[#475569] text-center uppercase tracking-wider">Fluntr HQ Secure Internal Node.</div>
          </div>
        </div>
      )}

      {/* Simple Password Reset Inline Modal Layer overlay */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-[400px] bg-[#0F172A] border border-[#1E293B] rounded-3xl p-6 shadow-2xl text-white">
            <h2 className="text-sm font-black uppercase tracking-wider text-gray-200 mb-2">Manual Password Override</h2>
            <p className="text-xs text-[#555] font-mono mb-4">Injecting fresh access tokens for: @{selectedUser?.username}</p>
            <input 
              type="text" 
              placeholder="Type secure replacement password..." 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-[#1E293B] bg-[#0F172A] py-3 px-4 text-xs font-mono text-white outline-none mb-4 focus:border-indigo-500/50 transition-colors"
            />
            <div className="flex gap-3 justify-end text-xs font-bold">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white cursor-pointer border-none bg-transparent">Abort</button>
              <button onClick={executePasswordReset} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 cursor-pointer border-none">Commit Override ✦</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
