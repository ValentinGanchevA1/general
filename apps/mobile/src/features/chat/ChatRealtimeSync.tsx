import React, { useCallback, useEffect, useRef } from 'react';

import {
  fetchConversations,
  markConversationReadRemote,
  messageReceived,
} from '@/features/chat/chatSlice';
import { useAppDispatch } from '@/hooks/redux';
import { onSocketConnected, useSocket } from '@/realtime/useSocket';
import { store } from '@/store';

const RESYNC_COALESCE_MS = 150;
const READ_RECEIPT_COALESCE_MS = 250;

export function ChatRealtimeSync({ viewerId }: { viewerId: string }): null {
  const dispatch = useAppDispatch();
  const { on } = useSocket();
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleResync = useCallback((): void => {
    if (resyncTimerRef.current !== null) return;

    resyncTimerRef.current = setTimeout(() => {
      resyncTimerRef.current = null;
      void dispatch(fetchConversations());
    }, RESYNC_COALESCE_MS);
  }, [dispatch]);

  const scheduleReadReceipt = useCallback((conversationId: string): void => {
    if (readTimersRef.current.has(conversationId)) return;

    const timer = setTimeout(() => {
      readTimersRef.current.delete(conversationId);
      void dispatch(markConversationReadRemote(conversationId));
    }, READ_RECEIPT_COALESCE_MS);
    readTimersRef.current.set(conversationId, timer);
  }, [dispatch]);

  useEffect(() => () => {
    if (resyncTimerRef.current !== null) {
      clearTimeout(resyncTimerRef.current);
      resyncTimerRef.current = null;
    }
    for (const timer of readTimersRef.current.values()) clearTimeout(timer);
    readTimersRef.current.clear();
  }, []);

  useEffect(() => {
    const unsubscribers = [
      onSocketConnected(scheduleResync),
      on('conversation:opened', scheduleResync),
      on('friend:accepted', scheduleResync),
      on('chat:message', (event) => {
        const chatState = store.getState().chat;
        const knownConversation = chatState.conversations.some(
          (conversation) => conversation.id === event.conversationId,
        );
        const isFocusedConversation = chatState.activeConversationId === event.conversationId;

        dispatch(messageReceived({
          ...event,
          type: event.type ?? 'text',
          location: event.location ?? null,
          locationSessionId: event.locationSessionId ?? null,
          viewerId,
        }));

        if (isFocusedConversation && event.senderId !== viewerId) {
          scheduleReadReceipt(event.conversationId);
        }
        if (!knownConversation) scheduleResync();
      }),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [dispatch, on, scheduleReadReceipt, scheduleResync, viewerId]);

  return null;
}
