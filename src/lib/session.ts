import axios from 'axios';
import { API_BASE_URL } from '../config';

/* The console session. A sign-in lasts 2 hours whether or not you use it; Extend gives the same
   session 2 more hours. The server decides (every request checks the session); this file keeps the
   browser in step: it remembers when the session ends and clears everything when it does. */

export const TOKEN_KEY = 'admin_session_token';
export const EXPIRES_KEY = 'admin_session_expires';
const KEYS = [TOKEN_KEY, 'admin_user', 'admin_me', EXPIRES_KEY];

/** Why you're back at sign-in: the page says so (LoginPortal reads ?ended=). */
export type EndReason = 'timeout' | 'password' | 'session' | 'signout';

/** The API's 401 code → the reason shown on the sign-in page. */
export function reasonFor(code?: string): EndReason {
  return code === 'SESSION_EXPIRED' ? 'timeout' : code === 'PASSWORD_CHANGED' ? 'password' : 'session';
}

/** Keep a session the server just handed out (sign-in or Extend). */
export function saveSession(token: string, expiresAt?: string | null) {
  localStorage.setItem(TOKEN_KEY, token);
  if (expiresAt) localStorage.setItem(EXPIRES_KEY, expiresAt);
  else localStorage.removeItem(EXPIRES_KEY);
}

/** When this browser's session ends (ms since epoch), or null for accounts without one. */
export function savedExpiry(): number | null {
  const at = Date.parse(localStorage.getItem(EXPIRES_KEY) || '');
  return Number.isFinite(at) ? at : null;
}

let ending = false;
/** Forget the session in this browser (every tab) and go to sign-in, saying why. */
export function endSession(reason: EndReason) {
  if (ending) return;
  ending = true;
  KEYS.forEach((k) => localStorage.removeItem(k));
  window.location.assign(reason === 'signout' ? '/portal/secure-gateway-entry' : `/portal/secure-gateway-entry?ended=${reason}`);
}

/** A 401 from the admin API means the session is over (expired, signed out, password changed). */
export function endIfUnauthorized(err: unknown): boolean {
  const res = (err as { response?: { status?: number; data?: { code?: string } } })?.response;
  if (res?.status !== 401) return false;
  endSession(reasonFor(res.data?.code));
  return true;
}

/** Sign out: the server ends the session too, so a copied token stops working. */
export async function signOut() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    await axios.post(`${API_BASE_URL}session/sign-out`, {}, { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }).catch(() => {});
  }
  endSession('signout');
}
