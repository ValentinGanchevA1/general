import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ConversationSummary } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchConversations } from '@/features/chat/chatSlice';
import { useSocket } from '@/realtime/useSocket';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function ConversationRow({
  convo,
  myUserId,
  onPress,
}: {
  convo: ConversationSummary;
  myUserId: string;
  onPress: () => void;
}): React.JSX.Element {
  const other = convo.participants.find((p) => p.id !== myUserId);
  const name = other?.displayName ?? 'Unknown';
  const initials = name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName}>{name}</Text>
          <Text style={styles.rowTime}>{relativeTime(convo.lastMessageAt)}</Text>
        </View>
        {convo.lastMessage ? (
          <Text style={styles.rowPreview} numberOfLines={1}>
            {convo.lastMessage.senderId === myUserId ? 'You: ' : ''}
            {convo.lastMessage.body}
          </Text>
        ) : (
          <Text style={styles.rowPreviewEmpty}>New conversation</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function InboxScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();
  const { conversations, conversationsLoading } = useAppSelector((s) => s.chat);
  const myUserId = useAppSelector((s) => s.auth.user?.id ?? '');
  const { on } = useSocket();

  // Refresh on focus and on conversation:opened events.
  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchConversations());
    }, [dispatch]),
  );

  useEffect(() => {
    return on('conversation:opened', () => {
      void dispatch(fetchConversations());
    });
  }, [on, dispatch]);

  const openChat = (convo: ConversationSummary): void => {
    const other = convo.participants.find((p) => p.id !== myUserId);
    navigation.navigate('Chat', {
      conversationId: convo.id,
      otherUserName: other?.displayName ?? 'Chat',
    });
  };

  if (conversationsLoading && conversations.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#00d4ff" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Inbox</Text>
      {conversations.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySub}>Wave at someone on the map to start chatting.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ConversationRow
              convo={item}
              myUserId={myUserId}
              onPress={() => openChat(item)}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', padding: 20, paddingBottom: 8 },
  list: { paddingHorizontal: 16 },
  separator: { height: 1, backgroundColor: '#1a1a2e' },
  row: { flexDirection: 'row', paddingVertical: 14, gap: 12, alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#00d4ff', fontSize: 16, fontWeight: '700' },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  rowName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowTime: { color: '#555', fontSize: 12 },
  rowPreview: { color: '#888', fontSize: 13 },
  rowPreviewEmpty: { color: '#555', fontSize: 13, fontStyle: 'italic' },
  emptyTitle: { color: '#aaa', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#555', fontSize: 13, textAlign: 'center', maxWidth: 260 },
});
