import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, User, Eye, EyeOff } from 'lucide-react';

export default function LoginPortal() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false); // Controls 403 styling
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError("Please fill in all security fields.");
      return;
    }

    setLoading(true);
    setError(null);
    setAuthError(false);

    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const API_URL = isLocal 
        ? 'http://localhost:3000/api/admin' 
        : import.meta.env.VITE_API_URL;
      
      // Strip any trailing slashes cleanly
      const cleanBaseUrl = API_URL ? API_URL.replace(/\/$/, '') : '';
      
      // Route flawlessly into the true /api/auth namespace
      const loginUrl = isLocal
        ? 'http://localhost:3000/api/auth/login'
        : `${cleanBaseUrl.replace(/\/admin$/, '')}/auth/login`;

      console.log("📡 Target True API Auth Handshake:", loginUrl);

      const res = await axios.post(loginUrl, {
        identifier: identifier.trim(),
        password: password
      });

      if (res.data.success) {
        const { accessToken, user } = res.data;
        
        // Explicit role matrix check
        if (user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN')) {
          localStorage.setItem('admin_session_token', accessToken);
          localStorage.setItem('admin_user', JSON.stringify(user));
          navigate('/admin/dashboard');
        } else {
          // Trigger explicit 403 Access Denied: Unauthorized Account
          setAuthError(true);
          setError("403 Access Denied: Unauthorized Account");
          // Instant session destruction
          localStorage.removeItem('admin_session_token');
          localStorage.removeItem('admin_user');
        }
      } else {
        setError(res.data.message || "Authentication rejected.");
      }
    } catch (err: any) {
      console.error("Login portal connection error:", err);
      const status = err.response?.status;
      const msg = err.response?.data?.message;

      if (status === 403) {
        setAuthError(true);
        setError("403 Access Denied: Unauthorized Account");
      } else {
        setError(msg || err.message || "Failed to establish uplink with authentication server.");
      }
      localStorage.removeItem('admin_session_token');
      localStorage.removeItem('admin_user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#080808] p-4 text-white font-sans selection:bg-cyan-500 selection:text-black">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,229,255,0.02)_0%,transparent_65%)] pointer-events-none" />

      <div className="relative w-full max-w-[420px] rounded-3xl border border-[#1A1A1A] bg-[#0E0E10]/90 p-8 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-cyan-500/10">
        
        {/* Portal Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-950/50 border border-cyan-800/30 text-cyan-400">
            <span className="text-xl font-bold tracking-widest font-mono">F</span>
          </div>
          <h1 className="text-lg font-bold tracking-wide uppercase text-gray-200">Fluntr Admin Portal</h1>
          <p className="text-xs text-[#555] mt-1 font-mono">Secure administrative gateway</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className={`mb-6 flex gap-3 rounded-2xl p-4 text-xs font-semibold border leading-relaxed animate-[shake_0.4s_ease-in-out] ${
            authError 
              ? 'bg-red-950/40 border-red-900/50 text-red-400' 
              : 'bg-[#151111] border-red-950 text-red-500'
          }`}>
            <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold uppercase tracking-wide">
                {authError ? 'Security System Intercept' : 'Invalid Entry'}
              </p>
              <p className="mt-1 text-[#aaa] font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSignIn} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#666] mb-2 font-mono">
              Identity Identifier
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                <User size={14} />
              </span>
              <input
                type="text"
                required
                disabled={loading}
                placeholder="Username or email address"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full rounded-2xl border border-[#1A1A1A] bg-[#121214] py-3.5 pl-11 pr-4 text-xs font-medium text-white placeholder-gray-600 outline-none transition-all focus:border-cyan-500/30 focus:bg-[#151518]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#666] mb-2 font-mono">
              Access Credentials
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                <Lock size={14} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={loading}
                placeholder="Security access password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-[#1A1A1A] bg-[#121214] py-3.5 pl-11 pr-12 text-xs font-medium text-white placeholder-gray-600 outline-none transition-all focus:border-cyan-500/30 focus:bg-[#151518]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-400 py-3.5 text-xs font-extrabold uppercase tracking-widest text-black transition-all hover:bg-cyan-300 disabled:opacity-50 active:scale-[0.99] cursor-pointer mt-4 flex items-center justify-center"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></span>
            ) : (
              'Authenticate Uplink ✦'
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-[#1A1A1A] pt-4 text-center">
          <p className="text-[10px] text-[#444] font-mono leading-relaxed">
            Authorized access only. All actions and IP logs are signed and monitored.
          </p>
        </div>
      </div>
    </div>
  );
}
