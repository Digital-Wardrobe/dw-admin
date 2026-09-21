import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

/* ──────────────────────────────────────────────────────────────────────────
   Every page repeated the same twenty lines: read the token from
   localStorage, build the URL, call axios, unwrap `data.success`, set three
   pieces of state, and invent its own error string. That is why the loading
   and error treatments had drifted apart across pages. One hook instead.
   ────────────────────────────────────────────────────────────────────────── */

export function getAdminToken() {
  return localStorage.getItem('admin_session_token');
}

type State<T> = {
  data: T | null;
  loading: boolean;
  /** null when the request succeeded. */
  error: string | null;
  /** Re-runs the request; wired to the "Try again" button on InlineError. */
  reload: () => void;
};

/**
 * GET an admin endpoint.
 * @param path endpoint relative to API_BASE_URL, e.g. 'dashboard-summary'
 * @param options.params query string values
 * @param options.enabled skip the request until it becomes true
 */
export function useAdminApi<T = any>(
  path: string,
  options: { params?: Record<string, string | number | boolean>; enabled?: boolean } = {},
): State<T> {
  const { params, enabled = true } = options;
  const paramKey = JSON.stringify(params ?? {});

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);

      const token = getAdminToken();
      if (!token) {
        if (!cancelled) {
          setError('Your session has expired. Sign in again to continue.');
          setLoading(false);
        }
        return;
      }

      try {
        const res = await axios.get(`${API_BASE_URL}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: JSON.parse(paramKey),
          signal: controller.signal,
        });

        if (cancelled) return;

        if (res.data?.success === false) {
          setError(res.data?.message || 'The server rejected this request.');
        } else {
          setData(res.data?.data ?? res.data);
        }
      } catch (err: any) {
        if (cancelled || axios.isCancel(err)) return;
        const status = err?.response?.status;
        setError(
          status === 401 || status === 403
            ? 'Your session has expired. Sign in again to continue.'
            : err?.response?.data?.message || err?.message || 'Connection failed. Please try again.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [path, paramKey, enabled, nonce]);

  return { data, loading, error, reload };
}
