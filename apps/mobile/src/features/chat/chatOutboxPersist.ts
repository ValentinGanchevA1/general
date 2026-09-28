// Persist pending/failed chat sends so they survive app kill.
// Reconnect drain in useSocket still owns the network retry loop.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChatMessage } from '@g88/shared';

import type { OutboxEntry } from './chatSlice';

const KEY = '@g88/chatOutbox/v1';

export interface PersistedChatOutbox {
  outbox: OutboxEntry[];
  failedIds: string[];
  /** Optimistic message rows still pending or failed (for UI after relaunch). */
  pendingMessages: ChatMessage[];
}

export async function loadChatOutbox(): Promise<PersistedChatOutbox | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedChatOutbox;
    if (!Array.isArray(parsed.outbox) || !Array.isArray(parsed.failedIds)) return null;
    return {
      outbox: parsed.outbox,
      failedIds: parsed.failedIds,
      pendingMessages: Array.isArray(parsed.pendingMessages) ? parsed.pendingMessages : [],
    };
  } catch {
    return null;
  }
}

export async function saveChatOutbox(payload: PersistedChatOutbox): Promise<void> {
  try {
    if (payload.outbox.length === 0 && payload.failedIds.length === 0) {
      await AsyncStorage.removeItem(KEY);
      return;
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* best-effort */
  }
}

export async function clearChatOutbox(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* best-effort */
  }
}

/** Collect optimistic rows still referenced by outbox or failedIds. */
export function collectPendingMessages(
  messages: Record<string, ChatMessage[]>,
  outbox: OutboxEntry[],
  failedIds: string[],
): ChatMessage[] {
  const ids = new Set<string>([
    ...outbox.map((e) => e.optimisticId),
    ...failedIds,
  ]);
  if (ids.size === 0) return [];
  const out: ChatMessage[] = [];
  for (const list of Object.values(messages)) {
    for (const m of list) {
      if (ids.has(m.id)) out.push(m);
    }
  }
  return out;
}
