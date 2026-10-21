import type {
  AckResult,
  ChatMessageEvent,
  ClientToServerEvents,
  ConversationOpenedEvent,
  FriendAcceptedEvent,
  FriendPresenceEvent,
  FriendRequestEvent,
  ServerToClientEvents,
  WaveMutualEvent,
  WaveReceivedEvent,
} from '../../packages/shared/src/events';

interface SocketIoClient {
  connected: boolean;
  auth: Record<string, unknown>;
  connect(): this;
  disconnect(): this;
  on(event: 'connect', listener: () => void): this;
  on(event: 'disconnect', listener: (reason: string) => void): this;
  on(event: 'connect_error', listener: (error: Error) => void): this;
  on<E extends keyof ServerToClientEvents>(event: E, listener: ServerToClientEvents[E]): this;
  emit<E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ): this;
}

type IoFactory = (
  url: string,
  options: {
    auth: { token: string };
    withCredentials: boolean;
    reconnection: boolean;
    reconnectionDelay: number;
    reconnectionDelayMax: number;
  },
) => SocketIoClient;

declare global {
  interface Window {
    io?: IoFactory;
  }
}

export interface WebRealtimeHandlers {
  onConnectionChange(connected: boolean): void;
  onChatMessage(event: ChatMessageEvent): void;
  onFriendRequest(event: FriendRequestEvent): void;
  onFriendAccepted(event: FriendAcceptedEvent): void;
  onFriendPresence(event: FriendPresenceEvent): void;
  onWaveReceived(event: WaveReceivedEvent): void;
  onWaveMutual(event: WaveMutualEvent): void;
  onConversationOpened(event: ConversationOpenedEvent): void;
  onError(message: string): void;
}

const SOCKET_ORIGIN = window.location.origin === 'http://127.0.0.1:4174'
  ? 'http://127.0.0.1:3001'
  : window.location.origin === 'http://localhost:4174'
    ? 'http://localhost:3001'
    : window.location.origin;

let clientScriptPromise: Promise<IoFactory> | null = null;

export class WebRealtimeClient {
  private socket: SocketIoClient | null = null;
  private token = '';
  private handlers: WebRealtimeHandlers | null = null;

  async connect(token: string, handlers: WebRealtimeHandlers): Promise<void> {
    this.token = token;
    this.handlers = handlers;

    if (this.socket) {
      this.socket.auth = { token };
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    const io = await loadSocketIoClient();
    if (this.socket) return;

    const socket = io(`${SOCKET_ORIGIN}/realtime`, {
      auth: { token },
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8_000,
    });
    this.socket = socket;
    this.bind(socket);
  }

  setToken(token: string): void {
    this.token = token;
    if (this.socket) this.socket.auth = { token };
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.handlers?.onConnectionChange(false);
    this.handlers = null;
  }

  async joinConversation(conversationId: string): Promise<AckResult<{ joined: true }>> {
    const socket = this.socket;
    if (!socket?.connected) {
      return { ok: false, code: 'socket.offline', message: 'Realtime connection is offline' };
    }
    return emitWithAck(socket, 'conversation:join', { conversationId });
  }

  async sendMessage(conversationId: string, body: string): Promise<AckResult<ChatMessageEvent>> {
    const socket = this.socket;
    if (!socket?.connected) {
      return { ok: false, code: 'socket.offline', message: 'Realtime connection is offline' };
    }
    return emitWithAck(socket, 'chat:send', {
      conversationId,
      body,
      clientMessageId: crypto.randomUUID(),
    });
  }

  private bind(socket: SocketIoClient): void {
    socket.on('connect', () => {
      socket.auth = { token: this.token };
      this.handlers?.onConnectionChange(true);
    });
    socket.on('disconnect', () => this.handlers?.onConnectionChange(false));
    socket.on('connect_error', (error) => {
      this.handlers?.onConnectionChange(false);
      this.handlers?.onError(error.message || 'Realtime connection failed');
    });
    socket.on('chat:message', (event) => this.handlers?.onChatMessage(event));
    socket.on('friend:request', (event) => this.handlers?.onFriendRequest(event));
    socket.on('friend:accepted', (event) => this.handlers?.onFriendAccepted(event));
    socket.on('friend:presence', (event) => this.handlers?.onFriendPresence(event));
    socket.on('wave:received', (event) => this.handlers?.onWaveReceived(event));
    socket.on('wave:mutual', (event) => this.handlers?.onWaveMutual(event));
    socket.on('conversation:opened', (event) => this.handlers?.onConversationOpened(event));
    socket.on('error:event', (event) => this.handlers?.onError(event.message));
  }
}

async function loadSocketIoClient(): Promise<IoFactory> {
  if (window.io) return window.io;
  if (clientScriptPromise) return clientScriptPromise;

  clientScriptPromise = new Promise<IoFactory>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${SOCKET_ORIGIN}/socket.io/socket.io.js`;
    script.async = true;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.onload = () => {
      if (window.io) resolve(window.io);
      else reject(new Error('Socket.IO client did not initialize'));
    };
    script.onerror = () => reject(new Error('Failed to load Socket.IO client from backend'));
    document.head.append(script);
  }).catch((error: unknown) => {
    clientScriptPromise = null;
    throw error;
  });

  return clientScriptPromise;
}

function emitWithAck<K extends keyof ClientToServerEvents>(
  socket: SocketIoClient,
  event: K,
  payload: Parameters<ClientToServerEvents[K]>[0],
): Promise<AckFromClientEvent<ClientToServerEvents[K]>> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, code: 'socket.timeout', message: 'Realtime request timed out' } as AckFromClientEvent<ClientToServerEvents[K]>);
    }, 8_000);

    const ack = (result: AckFromClientEvent<ClientToServerEvents[K]>): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };

    socket.emit(event, payload, ack as Parameters<ClientToServerEvents[K]>[1]);
  });
}

type AckFromClientEvent<T> = T extends (
  payload: infer _Payload,
  ack: (result: infer Result) => void,
) => void
  ? Result
  : AckResult<never>;
