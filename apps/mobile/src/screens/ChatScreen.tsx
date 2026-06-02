import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { type RouteProp, useRoute } from '@react-navigation/native';

import type { ChatMessage } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import {
  fetchMessages,
  messageReceived,
  messageSentOptimistic,
  messageConfirmed,
  messageQueued,
  failedMessageCleared,
} from '@/features/chat/chatSlice';
import { socketSendMessage, useSocket } from '@/realtime/useSocket';

type Route = RouteProp<RootStackParamList, 'Chat'>;

function MessageBubble({
  msg,
  isMine,
  isPending,
  isFailed,
  onRetry,
}: {
  msg: ChatMessage;
  isMine: boolean;
  isPending: boolean;
  isFailed: boolean;
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
      <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
        {msg.body}
      </Text>
      {isPending && (
        <Text style={styles.statusPending}>⏱</Text>
      )}
      {isFailed && (
        <TouchableOpacity onPress={onRetry}>
          <Text style={styles.statusFailed}>! Tap to retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ChatScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { params } = useRoute<Route>();
  const { conversationId, requestPending } = params;

  const myUserId = useAppSelector((s) => s.auth.user?.id ?? '');
  const messages = useAppSelector((s) => s.chat.messages[conversationId] ?? []);
  const nextCursor = useAppSelector((s) => s.chat.nextCursor[conversationId] ?? null);
  const loading = useAppSelector((s) => s.chat.messagesLoading[conversationId] ?? false);
  const outbox = useAppSelector((s) => s.chat.outbox);
  const failedIds = useAppSelector((s) => s.chat.failedIds);

  const pendingIds = outbox.map((e) => e.optimisticId);

  // A shared-interest request stays gated until the other person replies once.
  // Mirror the server's one-message cap: once the initiator's request message is
  // in, the composer locks until a reply arrives (server is still authoritative).
  const theyReplied = messages.some((m) => m.senderId !== myUserId);
  const iSent = messages.some((m) => m.senderId === myUserId);
  const showRequestBanner = !!requestPending && !theyReplied;
  const requestLocked = showRequestBanner && iSent;

  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const { on, joinConversation, sendMessage } = useSocket();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    void dispatch(fetchMessages({ conversationId }));
    void joinConversation(conversationId);
  }, [conversationId, dispatch, joinConversation]);

  useEffect(() => {
    return on('chat:message', (msg) => {
      dispatch(messageReceived(msg));
    });
  }, [on, dispatch]);

  const send = useCallback(async (): Promise<void> => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setBody('');

    const optimisticId = `opt-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      conversationId,
      senderId: myUserId,
      body: text,
      createdAt: new Date().toISOString(),
    };
    dispatch(messageSentOptimistic(optimistic));

    const confirmed = await sendMessage(conversationId, text, optimisticId);
    if (confirmed) {
      dispatch(messageConfirmed({ optimisticId, confirmed }));
    } else {
      // Socket disconnected — queue for retry when socket reconnects.
      dispatch(messageQueued({ optimisticId, conversationId, body: text, retries: 0 }));
    }
    setSending(false);
  }, [body, sending, conversationId, myUserId, dispatch, sendMessage]);

  const retry = useCallback(async (optimisticId: string, text: string): Promise<void> => {
    dispatch(failedMessageCleared(optimisticId));
    dispatch(messageQueued({ optimisticId, conversationId, body: text, retries: 0 }));
    const confirmed = await socketSendMessage(conversationId, text, optimisticId);
    if (confirmed) {
      dispatch(messageConfirmed({ optimisticId, confirmed }));
    } else {
      dispatch(messageQueued({ optimisticId, conversationId, body: text, retries: 0 }));
    }
  }, [conversationId, dispatch]);

  const loadMore = (): void => {
    if (nextCursor && !loading) {
      void dispatch(fetchMessages({ conversationId, cursor: nextCursor }));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {showRequestBanner && (
        <View style={styles.requestBanner}>
          <Text style={styles.requestBannerText}>
            {requestLocked
              ? 'Request sent — you can send another message once they reply.'
              : "Message request — they'll see one message until they reply."}
          </Text>
        </View>
      )}

      {loading && messages.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#00d4ff" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MessageBubble
              msg={item}
              isMine={item.senderId === myUserId}
              isPending={pendingIds.includes(item.id)}
              isFailed={failedIds.includes(item.id)}
              onRetry={() => void retry(item.id, item.body)}
            />
          )}
          inverted
          contentContainerStyle={styles.messageList}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder={requestLocked ? 'Waiting for a reply…' : 'Message…'}
          placeholderTextColor="#555"
          editable={!requestLocked}
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={send}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!body.trim() || sending || requestLocked) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!body.trim() || sending || requestLocked}
        >
          {sending ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.sendBtnText}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  requestBanner: {
    backgroundColor: '#10261f',
    borderBottomWidth: 1,
    borderBottomColor: '#1c3a30',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  requestBannerText: { color: '#7ee6bf', fontSize: 12, textAlign: 'center' },
  messageList: { paddingHorizontal: 12, paddingVertical: 8 },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: 10, marginVertical: 3 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#00d4ff' },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: '#1a1a2e' },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: '#000' },
  bubbleTextTheirs: { color: '#fff' },
  statusPending: { fontSize: 11, color: '#00000066', marginTop: 2, textAlign: 'right' },
  statusFailed: { fontSize: 11, color: '#ff4444', marginTop: 2, textAlign: 'right', fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
    backgroundColor: '#0a0a0f',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#000', fontSize: 18, fontWeight: '700' },
});
