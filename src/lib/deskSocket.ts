import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_ROOT } from './api';
import { getAdminToken } from './useAdminApi';

/* The support console's live connection (Socket.io on the API). The server checks the staff token
   and the "support" permission, then sends desk:ticket when the queue changes; watching a chat adds
   its messages, typing and who else is looking. Pages still poll as a fallback. */

let socket: Socket | null = null;
let users = 0;

function acquire(): Socket {
  users += 1;
  if (socket) return socket;
  const base = API_ROOT.replace(/\/api\/?$/, '').replace(/\/$/, '');
  socket = io(base, { transports: ['websocket'], auth: (cb) => cb({ token: getAdminToken() || '', desk: true }), reconnectionAttempts: 10 });
  return socket;
}
function release() {
  users = Math.max(0, users - 1);
  if (!users && socket) { socket.disconnect(); socket = null; }
}

/** The shared socket (null until mounted) and whether it's connected. */
export function useDeskSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const s = acquire();
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    s.on('connect', on); s.on('disconnect', off);
    setSocket(s);
    if (s.connected) setConnected(true);
    return () => { s.off('connect', on); s.off('disconnect', off); setSocket(null); release(); };
  }, []);
  return { socket, connected };
}

/** Listen to one event while mounted. */
export function useDeskEvent<T = any>(socket: Socket | null, event: string, fn: (p: T) => void) {
  const h = useRef(fn);
  useEffect(() => { h.current = fn; });
  useEffect(() => {
    if (!socket) return;
    const cb = (p: T) => h.current(p);
    socket.on(event, cb);
    return () => { socket.off(event, cb); };
  }, [socket, event]);
}
