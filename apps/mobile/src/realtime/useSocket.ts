import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PresenceUpdatePayload,
} from '@g88/shared';

import { tokenStore } from '@/api/tokenStore';
import { Config } from '@/config';

type G88Socket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketOptions {
  /** Auto-connect on mount. Default true. */
  autoConnect?: boolean;
}

interface UseSocketResult {
  socket: G88Socket | null;
  connected: boolean;
  /** Subscribe to a server event with type-checked callback. Returns unsubscribe. */
  on: <E extends keyof ServerToClientEvents>(
    event: E,
    handler: ServerToClientEvents[E],
  ) => () => void;
  /** Push a presence heartbeat. Fire from useEffect on location/AppState changes. */
  sendPresence: (payload: PresenceUpdatePayload) => Promise<{ cellId: string } | null>;
}

let sharedSocket: G88Socket | null = null;

/**
 * Module-level shared singleton so every screen sees the same socket and
 * avoids reconnect storms. The hook just exposes the lifecycle and helpers.
 *
 * Behavior:
 *  • Lazily creates the socket the first time the hook mounts.
 *  • Reconnects on AppState 'active' transitions (RN backgrounding kills sockets).
 *  • Re-auths on reconnect using the latest access token.
 *  • Cleans up subscribers but NOT the socket itself on unmount — other screens
 *    likely still need it. The singleton survives until the user logs out.
 */
export function useSocket(options: UseSocketOptions = {}): UseSocketResult {
  const { autoConnect = true } = options;
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    if (!autoConnect) return;

    let cancelled = false;

    const ensureSocket = async () => {
      if (sharedSocket?.connected) {
        if (!cancelled) setConnected(true);
        return;
      }
      const token = await tokenStore.getAccessToken();
      if (!token || cancelled) return;

      sharedSocket ??= io(`${Config.API_BASE_URL}/realtime`, {
        transports: ['websocket'],
        // Auth at handshake — re-auth happens automatically on reconnect via the function form.
        auth: async (cb) => {
          const fresh = await tokenStore.getAccessToken();
          cb({ token: fresh });
        },
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5_000,
      }) as G88Socket;

      sharedSocket.on('connect', () => !cancelled && setConnected(true));
      sharedSocket.on('disconnect', () => !cancelled && setConnected(false));
      sharedSocket.on('error:event', (e) => {
        // eslint-disable-next-line no-console
        console.warn(`[socket] server error: ${e.code} ${e.message}`);
      });
    };

    void ensureSocket();

    // Wake-from-background: reconnect if needed.
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && sharedSocket && !sharedSocket.connected) {
        sharedSocket.connect();
      }
    });

    return () => {
      cancelled = true;
      sub.remove();
      // Clean up THIS hook's subscriptions; leave the socket alive.
      handlersRef.current.forEach((unsub) => unsub());
      handlersRef.current.clear();
    };
  }, [autoConnect]);

  const on = useCallback(
    <E extends keyof ServerToClientEvents>(
      event: E,
      handler: ServerToClientEvents[E],
    ): (() => void) => {
      const s = sharedSocket;
      if (!s) return () => undefined;
      s.on(event, handler as never);
      const unsub = () => s.off(event, handler as never);
      handlersRef.current.add(unsub);
      return unsub;
    },
    [],
  );

  const sendPresence = useCallback(
    (payload: PresenceUpdatePayload): Promise<{ cellId: string } | null> => {
      return new Promise((resolve) => {
        const s = sharedSocket;
        if (!s?.connected) return resolve(null);
        // Ack-aware emit; falls back to null after 3s.
        const timer = setTimeout(() => resolve(null), 3_000);
        s.emit('presence:update', payload, (res) => {
          clearTimeout(timer);
          resolve(res.ok ? res.data : null);
        });
      });
    },
    [],
  );

  return { socket: sharedSocket, connected, on, sendPresence };
}

/** Tear down on logout — call from the auth slice's logout reducer/saga. */
export function disconnectSocket(): void {
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
    sharedSocket = null;
  }
}
