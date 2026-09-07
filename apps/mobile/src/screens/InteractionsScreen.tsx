import { EmptyState } from '@/components/EmptyState';
import { SkeletonListRow } from '@/components/Skeleton';
import { ScreenHeader } from '@/components/ScreenHeader';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type {
  ConversationSummary,
  InboxItem,
} from '@g88/shared';

import { Avatar } from '@/components/Avatar';
import { fetchConversations } from '@/features/chat/chatSlice';
import { useInboxInteractions } from '@/features/interactions/useInboxInteractions';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useSocket } from '@/realtime/useSocket';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, fontSize } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type HubRow =
  | { kind: 'chat'; sortAt: number; conversation: ConversationSummary }
  | { kind: 'inbox'; sortAt: number; item: InboxItem };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function signalLabel(item: InboxItem): string {
  if (item.type === 'wave') return 'waved at you';
  if (item.type === 'friend_request') return 'sent you a friend request';
  if (item.type === 'follow') return 'started following you';
  if (item.reactionKind === 'heart') return '❤️ reacted to your story';
  if (item.reactionKind === 'wave') return '👋 reacted to your story';
  return 'reacted to your story';
}

function peerOf(convo: ConversationSummary, myUserId: string) {
  return (
    convo.participants.find((p) => p.id !== myUserId) ??
    convo.participants[0] ??
    null
  );
}

export function InteractionsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const myUserId = useAppSelector((s) => s.auth.user?.id ?? '');
  const conversations = useAppSelector((s) => s.chat.conversations);
  const conversationsLoading = useAppSelector((s) => s.chat.conversationsLoading);
  const inbox = useInboxInteractions();
  const received = useReceivedInteractions();
  const { on } = useSocket();

  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchConversations());
      void inbox.refresh();
      received.markSeen();
    }, [dispatch, inbox, received]),
  );

  useEffect(() => {
    const unsubs = [
      on('chat:message', () => {
        void dispatch(fetchConversations());
      }),
      on('wave:received', () => {
        void inbox.refresh();
      }),
      on('friend:request', () => {
        void inbox.refresh();
      }),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [on, dispatch, inbox]);

  const rows: HubRow[] = useMemo(() => {
    const chatRows: HubRow[] = conversations.map((c) => ({
      kind: 'chat' as const,
      sortAt: new Date(c.lastMessageAt ?? 0).getTime(),
      conversation: c,
    }));
    const inboxRows: HubRow[] = inbox.items.map((item) => ({
      kind: 'inbox' as const,
      sortAt: new Date(item.createdAt).getTime(),
      item,
    }));
    return [...chatRows, ...inboxRows].sort((a, b) => b.sortAt - a.sortAt);
  }, [conversations, inbox.items]);

  const loading = conversationsLoading && inbox.loading && rows.length === 0;

  const onRefresh = useCallback(() => {
    void dispatch(fetchConversations());
    void inbox.refresh();
  }, [dispatch, inbox]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Interactions" bordered />
      {loading ? (
        <View style={styles.listContent}>
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) =>
            r.kind === 'chat' ? `chat-${r.conversation.id}` : `inbox-${r.item.id}`
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={conversationsLoading || inbox.loading}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              variant="plain"
              icon="inbox-outline"
              title="No interactions yet"
              body="Waves, chats, and friend requests will show up here."
            />
          }
          renderItem={({ item }) => {
            if (item.kind === 'chat') {
              const peer = peerOf(item.conversation, myUserId);
              const name = peer?.displayName ?? 'Chat';
              const unread = (item.conversation.unreadCount ?? 0) > 0;
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() =>
                    navigation.navigate('Chat', {
                      conversationId: item.conversation.id,
                      otherUserName: name,
                      ...(peer?.id ? { otherUserId: peer.id } : {}),
                    })
                  }
                >
                  <Avatar uri={peer?.avatarUrl ?? null} name={name} size={48} />
                  <View style={styles.info}>
                    <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.preview} numberOfLines={1}>
                      {item.conversation.lastMessage?.body ?? 'Say hi'}
                    </Text>
                  </View>
                  {unread ? <View style={styles.dot} /> : null}
                </TouchableOpacity>
              );
            }
            const sig = item.item;
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate('UserProfile', { userId: sig.fromUser.id })}
              >
                <Avatar
                  uri={sig.fromUser.avatarUrl ?? null}
                  name={sig.fromUser.displayName}
                  size={48}
                />
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {sig.fromUser.displayName}
                  </Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {signalLabel(sig)} · {timeAgo(sig.createdAt)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { flexGrow: 1, paddingVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  info: { flex: 1, gap: 2 },
  name: { color: colors.textPrimary, fontWeight: '600', fontSize: fontSize.md },
  nameUnread: { fontWeight: '800' },
  preview: { color: colors.textMuted, fontSize: fontSize.sm },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
});
