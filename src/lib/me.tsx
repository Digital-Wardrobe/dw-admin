import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAdminToken } from './useAdminApi';

/* Who is signed in and what their role can use (GET /api/admin/me). The server checks every
   request anyway; this only decides which pages and buttons to show. */

export type Role = 'SUPERADMIN' | 'ADMIN' | 'ANALYST' | 'MODERATOR' | 'SUPPORT';
export type Me = { id: string; name: string; role: Role; permissions: string[]; profile?: string | null; displayName?: string | null };
export const STAFF_ROLES: Role[] = ['SUPERADMIN', 'ADMIN', 'ANALYST', 'MODERATOR', 'SUPPORT'];

type Ctx = { me: Me | null; loading: boolean; error: string | null; can: (perm: string) => boolean; reload: () => void };
const MeContext = createContext<Ctx>({ me: null, loading: true, error: null, can: () => false, reload: () => {} });

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(() => {
    try { return JSON.parse(localStorage.getItem('admin_me') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(!me);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) { setLoading(false); return; }
    let live = true;
    axios.get(`${API_BASE_URL}me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (!live) return; setMe(r.data); localStorage.setItem('admin_me', JSON.stringify(r.data)); setError(null); })
      .catch((e) => {
        if (!live) return;
        const status = e?.response?.status;
        if (status === 401 || status === 403) { localStorage.removeItem('admin_me'); setMe(null); }
        setError(status === 401 || status === 403 ? 'Your session has ended. Sign in again.' : 'Could not check your access.');
      })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [nonce]);

  // 'a|b' = any of them (a page several profiles can open)
  const can = useCallback((perm: string) => !!me && perm.split('|').some((p) => me.permissions.includes(p)), [me]);
  return <MeContext.Provider value={{ me, loading, error, can, reload: () => setNonce((n) => n + 1) }}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);
