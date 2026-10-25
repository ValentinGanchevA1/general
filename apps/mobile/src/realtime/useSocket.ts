import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import * as Sentry from '@sentry/react-native';

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
import {
  resolveSocketAppStateAction,
  shouldReplayCachedPresence,
} from './socketAppState';
import { SocketRoomRegistry } from './socketRoomRegistry';

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
/** Socket lifecycle listeners (connect/disconnect/error) bound once per instance. */
let lifecycleBound = false;
/** One AppState subscription owns foreground/background transport policy. */
let appStateSubscription: { remove: () => void } | null = null;
/** Last location heartbeat observed while the app was active, scoped to this login. */
let lastPresencePayload: PresenceUpdatePayload | null = null;
/** Room membership intent survives connection-scoped Socket.IO reconnects. */
const roomRegistry = new SocketRoomRegistry();

/** Monotonic suffix so two sends in the same ms never share an optimistic id. */
let clientMessageSeq = 0;

function nextClientMessageId(): string {
  clientMessageSeq += 1;
  // Deterministic client id (time + monotonic seq). No Math.random — Sonar + no need for crypto here.
  return `c-${Date.now()}-${clientMessageSeq}`;
}

/**
 * Handlers registered before the socket exists — or kept as source of truth.
 * Attached to the live socket on create; cleaned up via returned unsub.
 */
const eventHandlers = new Map<
  keyof ServerToClientEvents,
  Set<ServerToClientEvents[keyof ServerToClientEvents]>
>();

/** Runs on every successful socket connect (incl. foreground reconnect). */
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
    } catch (e) {
      Sentry.captureException(e, { tags: { resource: 'socket.connect_listener' } });
      if (__DEV__) console.warn('[socket] connect listener failed', e);
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
      Sentry.captureException(e, { tags: { resource: 'socket.connect_listener' } });
      if (__DEV__) console.warn('[socket] connect listener failed', e);
    }
  }
}

function socketSendPresence(
  payload: PresenceUpdatePayload,
): Promise<{ cellId: string } | null> {
  return new Promise((resolve) => {
    if (AppState.currentState !== 'active') return resolve(null);
    const s = sharedSocket;
    if (!s?.connected) return resolve(null);
    const timer = setTimeout(() => resolve(null), 3_000);
    s.emit('presence:update', payload, (res) => {
      clearTimeout(timer);
      resolve(res.ok ? res.data : null);
    });
  });
}

function socketJoinConversation(conversationId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const s = sharedSocket;
    if (!s?.connected) return resolve(false);
    const timer = setTimeout(() => resolve(false), 3_000);
    s.emit('conversation:join', { conversationId }, (res) => {
      clearTimeout(timer);
      resolve(res.ok);
    });
  });
}

function socketJoinEvent(eventId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const s = sharedSocket;
    if (!s?.connected) return resolve(false);
    const timer = setTimeout(() => resolve(false), 3_000);
    s.emit('event:join', { eventId }, (res) => {
      clearTimeout(timer);
      resolve(res.ok);
    });
  });
}

function socketLeaveEvent(eventId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const s = sharedSocket;
    if (!s?.connected) return resolve(false);
    const timer = setTimeout(() => resolve(false), 3_000);
    s.emit('event:leave', { eventId }, (res) => {
      clearTimeout(timer);
      resolve(res.ok);
    });
  });
}

async function rejoinTrackedRooms(): Promise<void> {
  const { conversationIds, eventIds } = roomRegistry.snapshot();
  if (conversationIds.length === 0 && eventIds.length === 0) return;

  const results = await Promise.all([
    ...conversationIds.map((conversationId) =>
      socketJoinConversation(conversationId),
    ),
    ...eventIds.map((eventId) => socketJoinEvent(eventId)),
  ]);

  if (__DEV__) {
    const failures = results.filter((ok) => !ok).length;
    if (failures > 0) {
      console.warn(`[socket] failed to rejoin ${failures} tracked room(s)`);
    }
  }
}

async function onConnectedSideEffects(): Promise<void> {
  if (
    shouldReplayCachedPresence(
      AppState.currentState,
      lastPresencePayload !== null,
    ) &&
    lastPresencePayload !== null
  ) {
    // Re-establish online/cell presence immediately after foreground/network
    // reconnect instead of waiting for the Map's next 30 s heartbeat.
    void socketSendPresence(lastPresencePayload);
  }

  // Socket.IO rooms are connection-scoped. Restore the current session's room
  // intents before any reconnect listener or queued chat send can depend on them.
  await rejoinTrackedRooms();

  notifyConnectListeners();
  // Heal friends badge after any gap offline.
  try {
    const { store } = await import('@/store');
    const { fetchPendingCount } = await import('@/features/friends/friendsSlice');
    void store.dispatch(fetchPendingCount());
  } catch (e) {
    Sentry.captureException(e, { tags: { resource: 'socket.fetch_pending_count' } });
    if (__DEV__) console.warn('[socket] fetchPendingCount on connect failed', e);
  }
  // Drain chat outbox (dynamic import avoids circular dep).
  try {
    const { store } = await import('@/store');
    const { outbox } = store.getState().chat;
    if (outbox.length === 0) return;

    // Persisted/queued messages can outlive the ChatScreen that originally joined
    // the room. Join those conversations transiently before the first retry;
    // do not retain them in the active-screen room intent registry.
    const outboxConversationIds = [
      ...new Set(outbox.map((entry) => entry.conversationId)),
    ];
    const joinResults = await Promise.all(
      outboxConversationIds.map((conversationId) =>
        socketJoinConversation(conversationId),
      ),
    );
    const joinedConversations = new Set(
      outboxConversationIds.filter((_, index) => joinResults[index] === true),
    );

    const { messageConfirmed, outboxRetryIncremented } = await import(
      '@/features/chat/chatSlice'
    );
    for (const entry of outbox) {
      if (!joinedConversations.has(entry.conversationId)) {
        store.dispatch(outboxRetryIncremented(entry.optimisticId));
        continue;
      }
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
    Sentry.captureException(e, { tags: { resource: 'socket.outbox_drain' } });
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

function applySocketAppState(state: AppStateStatus): void {
  const s = sharedSocket;
  if (!s) return;

  const action = resolveSocketAppStateAction(state, s.connected);
  if (action === 'connect') {
    s.connect();
    return;
  }
  if (action === 'disconnect') {
    // Always disconnect outside foreground, even if the handshake/reconnect is
    // still in progress and `connected` has not flipped true yet.
    s.disconnect();
  }
}

function bindAppStateLifecycle(): void {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener('change', applySocketAppState);
}

function unbindAppStateLifecycle(): void {
  appStateSubscription?.remove();
  appStateSubscription = null;
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
 * Survives screen navigation, pauses outside foreground, and is torn down only
 * on logout.
 */
export function useSocket(options: UseSocketOptions = {}): UseSocketResult {
  const { autoConnect = true } = options;
  const [connected, setConnected] = useState(sharedSocket?.connected ?? false);
  const handlersRef = useRef<Set<() => void>>(new Set());
  const conversationIntentsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!autoConnect) return;

    let cancelled = false;

    const ensureSocket = async (): Promise<void> => {
      if (sharedSocket?.connected) {
        bindAppStateLifecycle();
        applySocketAppState(AppState.currentState);
        if (!cancelled) setConnected(sharedSocket.connected);
        return;
      }

      const token = await tokenStore.getAccessToken();
      if (!token || cancelled) return;

      let socket = sharedSocket;
      if (!socket) {
        socket = io(`${Config.API_BASE_URL}/realtime`, {
          // Foreground lifecycle owns the first connect as well as reconnects.
          autoConnect: false,
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
        sharedSocket = socket;

        bindLifecycle(socket);
        attachAllRegisteredHandlers(socket);
      } else {
        bindLifecycle(socket);
      }

      // Per-hook connected flag (module lifecycle connect also runs side effects).
      const onConnect = (): void => {
        if (!cancelled) setConnected(true);
      };
      const onDisconnect = (): void => {
        if (!cancelled) setConnected(false);
      };
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);

      // Cleanup only this hook's connect/disconnect flags — not the shared socket.
      handlersRef.current.add(() => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
      });

      bindAppStateLifecycle();
      applySocketAppState(AppState.currentState);
      // If we raced into an already-open socket, sync state.
      if (socket.connected && !cancelled) setConnected(true);
    };

    void ensureSocket();

    const handlers = handlersRef.current;
    const conversationIntents = conversationIntentsRef.current;
    return () => {
      cancelled = true;
      handlers.forEach((unsub) => unsub());
      handlers.clear();
      for (const conversationId of conversationIntents) {
        roomRegistry.untrackConversation(conversationId);
      }
      conversationIntents.clear();
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
    (payload: PresenceUpdatePayload): Promise<{ cellId: string } | null> => {
      // Cache only foreground observations. Background timers cannot overwrite the
      // last legitimate active location used for the next reconnect replay.
      if (AppState.currentState === 'active') {
        lastPresencePayload = payload;
      }
      return socketSendPresence(payload);
    },
    [],
  );

  const joinConversation = useCallback(
    (conversationId: string): Promise<boolean> => {
      // Retain this hook's room intent exactly once. The hook cleanup releases it,
      // so reconnect cost follows active consumers instead of navigation history.
      if (!conversationIntentsRef.current.has(conversationId)) {
        conversationIntentsRef.current.add(conversationId);
        roomRegistry.trackConversation(conversationId);
      }
      return socketJoinConversation(conversationId);
    },
    [],
  );

  const sendMessage = useCallback(
    (conversationId: string, body: string, clientMessageId?: string): Promise<ChatMessageEvent | null> =>
      socketSendMessage(conversationId, body, clientMessageId ?? nextClientMessageId()),
    [],
  );

  const joinEvent = useCallback(
    (eventId: string): Promise<boolean> => {
      roomRegistry.trackEvent(eventId);
      return socketJoinEvent(eventId);
    },
    [],
  );

  const leaveEvent = useCallback(
    (eventId: string): Promise<boolean> => {
      // Remove intent even while offline; otherwise a closed event screen would
      // be rejoined when the foreground connection comes back.
      roomRegistry.untrackEvent(eventId);
      return socketLeaveEvent(eventId);
    },
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
  unbindAppStateLifecycle();
  lastPresencePayload = null;
  roomRegistry.clear();
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
    sharedSocket = null;
  }
  lifecycleBound = false;
  // Keep eventHandlers + connectListeners so the next login re-attaches the same UI subs.
}
