import { useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { UserPlus } from 'lucide-react';

export default function StaffManagement() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [profileName, setProfileName] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [roleAssign, setRoleAssign] = useState('ADMIN');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCreateStaff = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const token = localStorage.getItem('admin_session_token');
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      const url = `${API_URL}create-staff`;

      const res = await axios.post(url, {
        email, username, profileName, initialPassword, roleAssign
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data.success) {
        setStatusMessage(`🚀 Success! Onboarded administrative account for @${username}`);
        // Reset the input values cleanly
        setEmail(''); setUsername(''); setProfileName(''); setInitialPassword('');
      }
    } catch (err: any) {
      setStatusMessage(`❌ Error: ${err.response?.data?.message || 'Failed creating sub-admin row.'}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl animate-fadeIn text-white">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff Account Provisioning</h1>
        <p className="text-sm text-[#666]">Onboard employee accounts, authorize administrative permission hierarchies, and seed initial system access parameters.</p>
      </div>

      {/* Main Creation Card Form Component */}
      <div className="rounded-2xl border border-[#1A1A1A] bg-[#0E0E10] p-6 shadow-xl">
        <form onSubmit={handleCreateStaff} className="space-y-4">
          
          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 mb-2">Display Profile Name</label>
            <input 
              type="text" required placeholder="e.g. Rachel (Operations Lead)" 
              value={profileName} onChange={(e)=>setProfileName(e.target.value)}
              className="w-full rounded-xl border border-[#1A1A1A] bg-[#121214] py-3 px-4 text-xs font-medium text-white placeholder-gray-700 outline-none focus:border-cyan-500/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 mb-2">Corporate Email Address</label>
              <input 
                type="email" required placeholder="name@fluntr.com" 
                value={email} onChange={(e)=>setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#1A1A1A] bg-[#121214] py-3 px-4 text-xs font-medium text-white placeholder-gray-700 outline-none focus:border-cyan-500/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 mb-2">Unique System Username</label>
              <input 
                type="text" required placeholder="rachel_mod" 
                value={username} onChange={(e)=>setUsername(e.target.value)}
                className="w-full rounded-xl border border-[#1A1A1A] bg-[#121214] py-3 px-4 text-xs font-medium text-white placeholder-gray-700 outline-none focus:border-cyan-500/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 mb-2">Initial Security Access Passphrase</label>
              <input 
                type="text" required placeholder="Min 6 secure characters..." 
                value={initialPassword} onChange={(e)=>setInitialPassword(e.target.value)}
                className="w-full rounded-xl border border-[#1A1A1A] bg-[#121214] py-3 px-4 text-xs font-mono text-white placeholder-gray-700 outline-none focus:border-cyan-500/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 mb-2">IAM Clearance Role Level</label>
              <select 
                value={roleAssign} onChange={(e)=>setRoleAssign(e.target.value)}
                className="w-full rounded-xl border border-[#1A1A1A] bg-[#121214] py-3 px-4 text-xs font-bold text-gray-400 outline-none focus:border-cyan-500/30 cursor-pointer"
              >
                <option value="ADMIN">Standard Admin (Moderator / Support)</option>
                <option value="SUPERADMIN">Superadmin (Complete Workspace Core Access)</option>
              </select>
            </div>
          </div>

          {statusMessage && (
            <div className="p-3.5 rounded-xl border border-[#1A1A1A] bg-[#151518] text-xs font-mono font-bold text-gray-300 animate-fadeIn">
              {statusMessage}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full rounded-xl bg-cyan-400 py-3.5 text-xs font-extrabold uppercase tracking-widest text-black transition-all hover:bg-cyan-300 disabled:opacity-50 active:scale-[0.99] cursor-pointer mt-2 flex items-center justify-center gap-2"
          >
            <UserPlus size={14} />
            {loading ? 'Executing Server Record Provisioning...' : 'Provision Access Credentials ✦'}
          </button>

        </form>
      </div>
    </div>
  );
}
