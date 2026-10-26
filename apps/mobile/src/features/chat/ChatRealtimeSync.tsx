import React, { useCallback, useEffect, useRef } from 'react';

import { fetchConversations, messageReceived } from '@/features/chat/chatSlice';
import { useAppDispatch } from '@/hooks/redux';
import { onSocketConnected, useSocket } from '@/realtime/useSocket';
import { store } from '@/store';

const RESYNC_COALESCE_MS = 150;

export function ChatRealtimeSync({ viewerId }: { viewerId: string }): null {
  const dispatch = useAppDispatch();
  const { on } = useSocket();
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleResync = useCallback((): void => {
    if (resyncTimerRef.current !== null) return;

    resyncTimerRef.current = setTimeout(() => {
      resyncTimerRef.current = null;
      void dispatch(fetchConversations());
    }, RESYNC_COALESCE_MS);
  }, [dispatch]);

  useEffect(() => () => {
    if (resyncTimerRef.current !== null) {
      clearTimeout(resyncTimerRef.current);
      resyncTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribers = [
      onSocketConnected(scheduleResync),
      on('conversation:opened', scheduleResync),
      on('friend:accepted', scheduleResync),
      on('chat:message', (event) => {
        const knownConversation = store
          .getState()
          .chat
          .conversations
          .some((conversation) => conversation.id === event.conversationId);

        dispatch(messageReceived({
          ...event,
          type: event.type ?? 'text',
          location: event.location ?? null,
          locationSessionId: event.locationSessionId ?? null,
          viewerId,
        }));

        if (!knownConversation) scheduleResync();
      }),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [dispatch, on, scheduleResync, viewerId]);

  return null;
}
