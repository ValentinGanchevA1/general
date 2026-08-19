import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PresenceUpdatePayload,
  ChatMessage,
  ChatMessageEvent,
  ChatLocation,
  LocationShareDuration,
  LocationShareSession,
} from '@g88/shared';

import { tokenStore } from '@/api/tokenStore';
import { Config } from '@/config';

type G88Socket = Socket<ServerToClientEvents, ClientToServerEvents>;

type ServerHandler<E extends keyof ServerToClientEvents> = ServerToClientEvents[E];

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
  sendMessage: (conversationId: string, body: string, clientMessageId?: string) => Promise<ChatMessageEvent | null>;
  joinEvent: (eventId: string) => Promise<boolean>;
  leaveEvent: (eventId: string) => Promise<boolean>;
}

let sharedSocket: G88Socket | null = null;
/** Lifecycle listeners (connect/disconnect) bound once per socket instance. */
let lifecycleBound = false;

/**
 * Handlers registered before the socket exists — or kept as source of truth.
 * Attached to the live socket on create; cleaned up via returned unsub.
 */
const eventHandlers = new Map<
  keyof ServerToClientEvents,
  Set<ServerToClientEvents[keyof ServerToClientEvents]>
>();

/** Runs on every successful socket connect (incl. reconnect). */
const connectListeners = new Set<() => void>();

/**
 * Subscribe to socket connect/reconnect. Safe to call before the socket exists.
 * Used by inbox hooks to refetch after background disconnect.
 */
export function onSocketConnected(fn: () => void): () => void {
  connectListeners.add(fn);
  // If already connected, fire once so callers do not wait for the next reconnect.
  if (sharedSocket?.connected) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  return () => {
    connectListeners.delete(fn);
  };
}

function attachHandlerToSocket<
  E extends keyof ServerToClientEvents,
>(s: G88Socket, event: E, handler: ServerHandler<E>): void {
  s.on(event, handler as never);
}

function detachHandlerFromSocket<
  E extends keyof ServerToClientEvents,
>(s: G88Socket, event: E, handler: ServerHandler<E>): void {
  s.off(event, handler as never);
}

function attachAllRegisteredHandlers(s: G88Socket): void {
  for (const [event, set] of eventHandlers) {
    for (const handler of set) {
      attachHandlerToSocket(s, event, handler as ServerHandler<typeof event>);
    }
  }
}

function notifyConnectListeners(): void {
  for (const fn of connectListeners) {
    try {
      fn();
    } catch (e) {
      if (__DEV__) console.warn('[socket] connect listener failed', e);
    }
  }
}

async function onConnectedSideEffects(): Promise<void> {
  notifyConnectListeners();
  // Heal friends badge after any gap offline.
  try {
    const { store } = await import('@/store');
    const { fetchPendingCount } = await import('@/features/friends/friendsSlice');
    void store.dispatch(fetchPendingCount());
  } catch (e) {
    if (__DEV__) console.warn('[socket] fetchPendingCount on connect failed', e);
  }
  // Drain chat outbox (dynamic import avoids circular dep).
  try {
    const { store } = await import('@/store');
    const { outbox } = store.getState().chat;
    if (outbox.length === 0) return;
    const { messageConfirmed, outboxRetryIncremented } = await import(
      '@/features/chat/chatSlice'
    );
    for (const entry of outbox) {
      const result = await socketSendMessage(
        entry.conversationId,
        entry.body,
        entry.optimisticId,
      );
      if (result) {
        store.dispatch(
          messageConfirmed({
            optimisticId: entry.optimisticId,
            confirmed: toChatMessage(result),
          }),
        );
      } else {
        store.dispatch(outboxRetryIncremented(entry.optimisticId));
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[socket] outbox drain failed', e);
  }
}

function bindLifecycle(s: G88Socket): void {
  if (lifecycleBound) return;
  lifecycleBound = true;

  s.on('connect', () => {
    void onConnectedSideEffects();
  });
  s.on('disconnect', () => {
    /* connected state updated per-hook via shared flag listeners if needed */
  });
  s.on('error:event', (e) => {
    if (__DEV__) {
      console.warn(`[socket] server error: ${e.code} ${e.message}`);
    }
  });
}

/** Normalize socket payload to ChatMessage (type required under exactOptionalPropertyTypes). */
function toChatMessage(e: ChatMessageEvent): ChatMessage {
  return {
    id: e.id,
    conversationId: e.conversationId,
    senderId: e.senderId,
    body: e.body,
    type: e.type ?? 'text',
    location: e.location ?? null,
    locationSessionId: e.locationSessionId ?? null,
    createdAt: e.createdAt,
  };
}

/** Module-level send — used by the hook and by the outbox drain. */
export function socketSendMessage(
  conversationId: string,
  body: string,
  clientMessageId: string,
): Promise<ChatMessageEvent | null> {
  return new Promise((resolve) => {
    const s = sharedSocket;
    if (!s?.connected) return resolve(null);
    const timer = setTimeout(() => resolve(null), 5_000);
    s.emit('chat:send', { conversationId, body, clientMessageId }, (res) => {
      clearTimeout(timer);
      resolve(res.ok ? res.data : null);
    });
  });
}

export function locationShareStart(
  conversationId: string,
  duration: LocationShareDuration,
  location: ChatLocation,
): Promise<LocationShareSession | null> {
  return new Promise((resolve) => {
    const s = sharedSocket;
    if (!s?.connected) return resolve(null);
    const timer = setTimeout(() => resolve(null), 5_000);
    s.emit('location:share:start', { conversationId, duration, location }, (res) => {
      clearTimeout(timer);
      resolve(res.ok ? res.data : null);
    });
  });
}

export function locationShareUpdate(
  sessionId: string,
  location: ChatLocation,
): Promise<{ updatedAt: string } | null> {
  return new Promise((resolve) => {
    const s = sharedSocket;
    if (!s?.connected) return resolve(null);
    const timer = setTimeout(() => resolve(null), 3_000);
    s.emit('location:share:update', { sessionId, location }, (res) => {
      clearTimeout(timer);
      resolve(res.ok ? res.data : null);
    });
  });
}

export function locationShareStop(sessionId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const s = sharedSocket;
    if (!s?.connected) return resolve(false);
    const timer = setTimeout(() => resolve(false), 3_000);
    s.emit('location:share:stop', { sessionId }, (res) => {
      clearTimeout(timer);
      resolve(res.ok);
    });
  });
}

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

      if (!sharedSocket) {
        sharedSocket = io(`${Config.API_BASE_URL}/realtime`, {
          // Polling fallback when pure WS is blocked (strict mobile networks).
          transports: ['websocket', 'polling'],
          auth: async (cb) => {
            const fresh = await tokenStore.getAccessToken();
            cb({ token: fresh });
          },
          reconnection: true,
          reconnectionDelay: 500,
          reconnectionDelayMax: 5_000,
        }) as G88Socket;

        bindLifecycle(sharedSocket);
        attachAllRegisteredHandlers(sharedSocket);
      } else {
        // Existing instance, not connected — ensure lifecycle once, then connect.
        bindLifecycle(sharedSocket);
        sharedSocket.connect();
      }

      // Per-hook connected flag (lifecycle connect already runs side effects).
      const onConnect = (): void => {
        if (!cancelled) setConnected(true);
      };
      const onDisconnect = (): void => {
        if (!cancelled) setConnected(false);
      };
      sharedSocket.on('connect', onConnect);
      sharedSocket.on('disconnect', onDisconnect);
      // If we raced into an already-open socket, sync state.
      if (sharedSocket.connected && !cancelled) setConnected(true);

      // Cleanup only this hook's connect/disconnect flags — not the shared socket.
      handlersRef.current.add(() => {
        sharedSocket?.off('connect', onConnect);
        sharedSocket?.off('disconnect', onDisconnect);
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
      let set = eventHandlers.get(event);
      if (!set) {
        set = new Set();
        eventHandlers.set(event, set);
      }
      set.add(handler as ServerToClientEvents[keyof ServerToClientEvents]);

      if (sharedSocket) {
        attachHandlerToSocket(sharedSocket, event, handler);
      }

      const unsub = (): void => {
        eventHandlers.get(event)?.delete(handler as ServerToClientEvents[keyof ServerToClientEvents]);
        if (sharedSocket) {
          detachHandlerFromSocket(sharedSocket, event, handler);
        }
      };
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
    (conversationId: string, body: string, clientMessageId?: string): Promise<ChatMessageEvent | null> =>
      socketSendMessage(conversationId, body, clientMessageId ?? `${Date.now()}`),
    [],
  );

  const joinEvent = useCallback(
    (eventId: string): Promise<boolean> =>
      new Promise((resolve) => {
        const s = sharedSocket;
        if (!s?.connected) return resolve(false);
        const timer = setTimeout(() => resolve(false), 3_000);
        s.emit('event:join', { eventId }, (res) => {
          clearTimeout(timer);
          resolve(res.ok);
        });
      }),
    [],
  );

  const leaveEvent = useCallback(
    (eventId: string): Promise<boolean> =>
      new Promise((resolve) => {
        const s = sharedSocket;
        if (!s?.connected) return resolve(false);
        const timer = setTimeout(() => resolve(false), 3_000);
        s.emit('event:leave', { eventId }, (res) => {
          clearTimeout(timer);
          resolve(res.ok);
        });
      }),
    [],
  );

  return {
    socket: sharedSocket,
    connected,
    on,
    sendPresence,
    joinConversation,
    sendMessage,
    joinEvent,
    leaveEvent,
  };
}

export function disconnectSocket(): void {
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
    sharedSocket = null;
  }
  lifecycleBound = false;
  // Keep eventHandlers + connectListeners so the next login re-attaches the same UI subs.
}
