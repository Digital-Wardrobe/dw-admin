import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAdminToken } from './useAdminApi';

/* Admin writes (and CSV downloads). Reads go through useAdminApi. */

const auth = () => ({ Authorization: `Bearer ${getAdminToken()}` });

/** The API root (…/api/) for endpoints outside /api/admin, e.g. billing grants. */
export const API_ROOT = API_BASE_URL.replace(/\/$/, '').replace(/\/admin$/, '') + '/';

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.status = status; }
}

function failure(err: any): never {
  const status = err?.response?.status;
  const message =
    status === 401 ? 'Your session has ended. Sign in again.'
    : status === 403 ? (err?.response?.data?.message || 'Your role can’t do this.')
    : status === 429 ? (err?.response?.data?.message || 'Too many requests. Try again later.')
    : err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Something went wrong.';
  throw new ApiError(message, status);
}

/** POST / PUT / PATCH / DELETE to /api/admin/<path> (or a full URL under API_ROOT). */
export async function adminSend<T = any>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  try {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const res = await axios.request({ method, url, data: body, headers: auth() });
    return res.data as T;
  } catch (err) { return failure(err); }
}

/** Download one table of an endpoint as CSV (the server checks the export permission and logs it). */
export async function downloadCsv(path: string, params: Record<string, string | number | boolean | undefined>, table: string) {
  try {
    const res = await axios.get(`${API_BASE_URL}${path}`, {
      headers: auth(),
      params: { ...params, format: 'csv', table },
      responseType: 'blob',
    });
    const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')?.[1] || `${table}.csv`;
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err: any) {
    // Blob error bodies: read the JSON message out of them
    if (err?.response?.data instanceof Blob) {
      try { err.response.data = JSON.parse(await err.response.data.text()); } catch { /* keep as is */ }
    }
    failure(err);
  }
}

/** Download a file endpoint (e.g. a training dataset); the server checks the permission and logs it. */
export async function downloadFile(path: string, fallbackName: string) {
  try {
    const res = await axios.get(`${API_BASE_URL}${path}`, { headers: auth(), responseType: 'blob' });
    const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')?.[1] || fallbackName;
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err: any) {
    if (err?.response?.data instanceof Blob) {
      try { err.response.data = JSON.parse(await err.response.data.text()); } catch { /* keep as is */ }
    }
    failure(err);
  }
}
