import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { socket } from '../services/socket';
import {
  upsertInteraction,
  updateChatOnMessage,
  setUserOnline,
} from '../store/interactionsSlice';
import type { Interaction } from '@shared/types/interaction';

export function useInteractionsRealtime() {
  const dispatch = useDispatch();

  useEffect(() => {
    const onNewInteraction = (payload: Interaction) => {
      dispatch(upsertInteraction(payload));
    };

    const onChatMessage = (payload: {
      chatId: string;
      message: {
        id: string;
        text: string;
        sentAt: string;
        isFromMe: boolean;
      };
      isFromMe: boolean;
    }) => {
      dispatch(
        updateChatOnMessage({
          chatId: payload.chatId,
          message: payload.message,
          unreadIncrement: payload.isFromMe ? 0 : 1,
        })
      );
    };

    const onUserPresence = (payload: { userId: string; isOnline: boolean }) => {
      dispatch(setUserOnline(payload));
    };

    socket.on('interaction:new', onNewInteraction);
    socket.on('chat:message', onChatMessage);
    socket.on('user:online', onUserPresence);
    socket.on('user:offline', (p: { userId: string }) =>
      onUserPresence({ userId: p.userId, isOnline: false })
    );

    return () => {
      socket.off('interaction:new', onNewInteraction);
      socket.off('chat:message', onChatMessage);
      socket.off('user:online', onUserPresence);
      socket.off('user:offline');
    };
  }, [dispatch]);
}
