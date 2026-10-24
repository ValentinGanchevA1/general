import { WebRealtimeClient, type WebRealtimeHandlers } from '../src/realtime';
import type { ChatMessageEvent } from '../../packages/shared/src/events';

interface RealtimeSnapshot {
  connectionStates: boolean[];
  joinSuccesses: number;
  messages: ChatMessageEvent[];
  errors: string[];
}

interface NexaRealtimeE2EApi {
  connect(token: string, conversationId: string): void;
  rotateToken(token: string): void;
  disconnect(): void;
  snapshot(): RealtimeSnapshot;
}

declare global {
  interface Window {
    nexaRealtimeE2E: NexaRealtimeE2EApi;
  }
}

const realtime = new WebRealtimeClient();
let activeConversationId: string | null = null;
const connectionStates: boolean[] = [];
let joinSuccesses = 0;
const messages: ChatMessageEvent[] = [];
const errors: string[] = [];

const handlers: WebRealtimeHandlers = {
  onConnectionChange(connected): void {
    connectionStates.push(connected);
    if (!connected || !activeConversationId) return;

    const conversationId = activeConversationId;
    void realtime.joinConversation(conversationId).then((result) => {
      if (result.ok) {
        joinSuccesses += 1;
      } else {
        errors.push(`${result.code}:${result.message}`);
      }
    });
  },
  onChatMessage(event): void {
    messages.push(event);
  },
  onFriendRequest(): void {},
  onFriendAccepted(): void {},
  onFriendPresence(): void {},
  onWaveReceived(): void {},
  onWaveMutual(): void {},
  onConversationOpened(): void {},
  onError(message): void {
    errors.push(message);
  },
};

window.nexaRealtimeE2E = {
  connect(token, conversationId): void {
    activeConversationId = conversationId;
    realtime.connect(token, handlers);
  },
  rotateToken(token): void {
    realtime.setToken(token);
  },
  disconnect(): void {
    activeConversationId = null;
    realtime.disconnect();
  },
  snapshot(): RealtimeSnapshot {
    return {
      connectionStates: [...connectionStates],
      joinSuccesses,
      messages: [...messages],
      errors: [...errors],
    };
  },
};
