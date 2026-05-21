import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PresenceUpdatePayload,
  ChatMessageEvent,
} from '@g88/shared';

import { tokenStore } from '@/api/tokenStore';
import { Config } from '@/config';

type G88Socket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketOptions {
  autoConnect?: boolean;
}

interface UseSocketResult {
  socket: G88Socket | null;
  connected: boolean;
  on: <E extends keyof ServerToClientEvents>(
    event: E,
    handler: ServerToClientEvents[E],
  ) => () => void;
  sendPresence: (payload: PresenceUpdatePayload) => Promise<{ cellId: string } | null>;
  joinConversation: (conversationId: string) => Promise<boolean>;
  sendMessage: (conversationId: string, body: string) => Promise<ChatMessageEvent | null>;
}

let sharedSocket: G88Socket | null = null;

/**
 * Module-level singleton so every screen shares one socket connection.
 * Survives screen navigation. Torn down only on logout.
 */
export function useSocket(options: UseSocketOptions = {}): UseSocketResult {
  const { autoConnect = true } = options;
  const [connected, setConnected] = useState(sharedSocket?.connected ?? false);
  const handlersRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    if (!autoConnect) return;

    let cancelled = false;

    const ensureSocket = async (): Promise<void> => {
      if (sharedSocket?.connected) {
        if (!cancelled) setConnected(true);
        return;
      }
      const token = await tokenStore.getAccessToken();
      if (!token || cancelled) return;

      sharedSocket ??= io(`${Config.API_BASE_URL}/realtime`, {
        transports: ['websocket'],
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
        console.warn(`[socket] server error: ${e.code} ${e.message}`);
      });
    };

    void ensureSocket();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && sharedSocket && !sharedSocket.connected) {
        sharedSocket.connect();
      }
    });

    const handlers = handlersRef.current;
    return () => {
      cancelled = true;
      sub.remove();
      handlers.forEach((unsub) => unsub());
      handlers.clear();
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
    (payload: PresenceUpdatePayload): Promise<{ cellId: string } | null> =>
      new Promise((resolve) => {
        const s = sharedSocket;
        if (!s?.connected) return resolve(null);
        const timer = setTimeout(() => resolve(null), 3_000);
        s.emit('presence:update', payload, (res) => {
          clearTimeout(timer);
          resolve(res.ok ? res.data : null);
        });
      }),
    [],
  );

  const joinConversation = useCallback(
    (conversationId: string): Promise<boolean> =>
      new Promise((resolve) => {
        const s = sharedSocket;
        if (!s?.connected) return resolve(false);
        const timer = setTimeout(() => resolve(false), 3_000);
        s.emit('conversation:join', { conversationId }, (res) => {
          clearTimeout(timer);
          resolve(res.ok);
        });
      }),
    [],
  );

  const sendMessage = useCallback(
    (conversationId: string, body: string): Promise<ChatMessageEvent | null> =>
      new Promise((resolve) => {
        const s = sharedSocket;
        if (!s?.connected) return resolve(null);
        const timer = setTimeout(() => resolve(null), 5_000);
        s.emit(
          'chat:send',
          { conversationId, body, clientMessageId: `${Date.now()}` },
          (res) => {
            clearTimeout(timer);
            resolve(res.ok ? res.data : null);
          },
        );
      }),
    [],
  );

  return { socket: sharedSocket, connected, on, sendPresence, joinConversation, sendMessage };
}

export function disconnectSocket(): void {
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
    sharedSocket = null;
  }
}
