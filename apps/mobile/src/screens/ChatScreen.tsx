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
} from '@/features/chat/chatSlice';
import { useSocket } from '@/realtime/useSocket';

type Route = RouteProp<RootStackParamList, 'Chat'>;

function MessageBubble({
  msg,
  isMine,
}: {
  msg: ChatMessage;
  isMine: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
      <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
        {msg.body}
      </Text>
    </View>
  );
}

export function ChatScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { params } = useRoute<Route>();
  const { conversationId } = params;

  const myUserId = useAppSelector((s) => s.auth.user?.id ?? '');
  const messages = useAppSelector((s) => s.chat.messages[conversationId] ?? []);
  const nextCursor = useAppSelector((s) => s.chat.nextCursor[conversationId] ?? null);
  const loading = useAppSelector((s) => s.chat.messagesLoading[conversationId] ?? false);

  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const { on, joinConversation, sendMessage } = useSocket();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Initial load + join socket room.
  useEffect(() => {
    void dispatch(fetchMessages({ conversationId }));
    void joinConversation(conversationId);
  }, [conversationId, dispatch, joinConversation]);

  // Listen for incoming messages.
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

    const confirmed = await sendMessage(conversationId, text);
    if (confirmed) {
      dispatch(messageConfirmed({ optimisticId, confirmed }));
    }
    setSending(false);
  }, [body, sending, conversationId, myUserId, dispatch, sendMessage]);

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
            <MessageBubble msg={item} isMine={item.senderId === myUserId} />
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
          placeholder="Message…"
          placeholderTextColor="#555"
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={send}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!body.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!body.trim() || sending}
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
  messageList: { paddingHorizontal: 12, paddingVertical: 8 },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: 10, marginVertical: 3 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#00d4ff' },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: '#1a1a2e' },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: '#000' },
  bubbleTextTheirs: { color: '#fff' },
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
