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
  FollowRequest,
  InboxItem,
  WaveRequest,
  WaveResponse,
} from '@g88/shared';

import { postJson } from '@/api/client';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SkeletonListRow } from '@/components/Skeleton';
import { VerificationBadge } from '@/components/VerificationBadge';
import {
  acceptFriendRequest,
  declineFriendRequest,
} from '@/features/friends/friendsSlice';
import { fetchConversations } from '@/features/chat/chatSlice';
import { useInboxInteractions } from '@/features/interactions/useInboxInteractions';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useSocket } from '@/realtime/useSocket';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, radius, fontSize } from '@/theme';

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

function InboxRow({
  item,
  busy,
  onMatch,
  onAccept,
  onDecline,
  onFollowBack,
  onOpenProfile,
}: {
  item: InboxItem;
  busy: boolean;
  onMatch: (userId: string) => void;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onFollowBack: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onOpenProfile(item.fromUser.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.fromUser.displayName}, ${signalLabel(item)}`}
    >
      <Avatar
        uri={item.fromUser.avatarUrl}
        name={item.fromUser.displayName}
        size={48}
      />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.fromUser.displayName}
          </Text>
          <VerificationBadge verification={item.fromUser.verification ?? 'none'} size={14} />
        </View>
        <Text style={styles.signal} numberOfLines={1}>
          {signalLabel(item)} · {timeAgo(item.createdAt)}
        </Text>
      </View>

      {item.type === 'wave' &&
        (item.isMutual ? (
          <View style={styles.mutualBadge}>
            <Text style={styles.mutualText}>Match</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            disabled={busy}
            onPress={(e) => {
              e.stopPropagation?.();
              onMatch(item.fromUser.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Match ${item.fromUser.displayName}`}
          >
            <Text style={styles.primaryBtnText}>Match</Text>
          </TouchableOpacity>
        ))}

      {item.type === 'friend_request' && item.requestId ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.declineBtn}
            disabled={busy}
            onPress={(e) => {
              e.stopPropagation?.();
              onDecline(item.requestId!);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Decline request from ${item.fromUser.displayName}`}
          >
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryBtn}
            disabled={busy}
            onPress={(e) => {
              e.stopPropagation?.();
              onAccept(item.requestId!);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Accept request from ${item.fromUser.displayName}`}
          >
            <Text style={styles.primaryBtnText}>Accept</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {item.type === 'follow' &&
        (item.isFollowingBack ? (
          <View style={styles.mutualBadge}>
            <Text style={styles.mutualText}>Following</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            disabled={busy}
            onPress={(e) => {
              e.stopPropagation?.();
              onFollowBack(item.fromUser.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Follow back ${item.fromUser.displayName}`}
          >
            <Text style={styles.primaryBtnText}>Follow back</Text>
          </TouchableOpacity>
        ))}
    </TouchableOpacity>
  );
}

function ChatRow({
  conversation,
  myUserId,
  onOpen,
}: {
  conversation: ConversationSummary;
  myUserId: string;
  onOpen: (c: ConversationSummary) => void;
}): React.JSX.Element {
  const peer = peerOf(conversation, myUserId);
  const name = peer?.displayName ?? 'Chat';
  const last = conversation.lastMessage;
  const isFromMe = last?.senderId === myUserId;
  const unread = (conversation.unreadCount ?? 0) > 0;
  const preview = last
    ? `${isFromMe ? 'You: ' : ''}${last.body}`
    : conversation.status === 'pending'
      ? 'Message request'
      : 'No messages yet';
  const when = conversation.lastMessageAt ? timeAgo(conversation.lastMessageAt) : '';
  const online = conversation.peerOnline === true;
  const badge =
    (conversation.unreadCount ?? 0) > 99
      ? '99+'
      : String(conversation.unreadCount ?? 0);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onOpen(conversation)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${name}`}
    >
      <View style={styles.avatarWrap}>
        <Avatar uri={peer?.avatarUrl ?? null} name={name} size={48} />
        {online ? <View style={styles.onlineDot} /> : null}
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
            {name}
          </Text>
          {conversation.isFriend ? (
            <Text style={styles.friendHint}>Friend</Text>
          ) : null}
        </View>
        <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
          {preview}
        </Text>
        {when ? <Text style={styles.time}>{when}</Text> : null}
      </View>
      <View style={styles.chatRight}>
        {unread ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{badge}</Text>
          </View>
        ) : conversation.status === 'pending' ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Pending</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function InteractionsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const myUserId = useAppSelector((s) => s.auth.user?.id ?? '');
  const conversations = useAppSelector((s) => s.chat.conversations);
  const conversationsLoading = useAppSelector((s) => s.chat.conversationsLoading);
  const { items, loading: inboxLoading, refresh } = useInboxInteractions();
  const { markSeen } = useReceivedInteractions();
  const { on } = useSocket();
  const [busyIds, setBusyIds] = React.useState<string[]>([]);

  const loadChats = useCallback(() => {
    void dispatch(fetchConversations());
  }, [dispatch]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      markSeen();
    });
  }, [markSeen]);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats]),
  );

  useEffect(() => {
    const unsubs = [
      on('chat:message', () => {
        loadChats();
      }),
      on('wave:received', () => {
        void refresh();
      }),
      on('friend:request', () => {
        void refresh();
      }),
      on('friend:accepted', () => {
        void refresh();
      }),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [on, loadChats, refresh]);

  const rows: HubRow[] = useMemo(() => {
    const chatRows: HubRow[] = conversations.map((c) => ({
      kind: 'chat' as const,
      sortAt: c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0,
      conversation: c,
    }));
    const inboxRows: HubRow[] = items.map((item) => ({
      kind: 'inbox' as const,
      sortAt: new Date(item.createdAt).getTime(),
      item,
    }));
    return [...chatRows, ...inboxRows].sort((a, b) => b.sortAt - a.sortAt);
  }, [conversations, items]);

  const coldLoading =
    rows.length === 0 && (inboxLoading || conversationsLoading);

  const onRefresh = useCallback(() => {
    loadChats();
    void refresh();
  }, [loadChats, refresh]);

  const setBusy = useCallback((id: string, onFlag: boolean) => {
    setBusyIds((prev) => (onFlag ? [...prev, id] : prev.filter((x) => x !== id)));
  }, []);

  const onMatch = useCallback(
    async (userId: string): Promise<void> => {
      setBusy(userId, true);
      try {
        await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
          toUserId: userId,
          context: 'profile',
        });
        await refresh();
      } catch {
        // global error path
      } finally {
        setBusy(userId, false);
      }
    },
    [refresh, setBusy],
  );

  const onAccept = useCallback(
    async (requestId: string): Promise<void> => {
      setBusy(requestId, true);
      try {
        await dispatch(acceptFriendRequest(requestId)).unwrap();
        await refresh();
      } catch {
        // slice surfaces error
      } finally {
        setBusy(requestId, false);
      }
    },
    [dispatch, refresh, setBusy],
  );

  const onDecline = useCallback(
    async (requestId: string): Promise<void> => {
      setBusy(requestId, true);
      try {
        await dispatch(declineFriendRequest(requestId)).unwrap();
        await refresh();
      } catch {
        // slice surfaces error
      } finally {
        setBusy(requestId, false);
      }
    },
    [dispatch, refresh, setBusy],
  );

  const onFollowBack = useCallback(
    async (userId: string): Promise<void> => {
      setBusy(userId, true);
      try {
        await postJson<FollowRequest, { following: true }>('/friends/follow', {
          userId,
        });
        await refresh();
      } catch {
        // global error path
      } finally {
        setBusy(userId, false);
      }
    },
    [refresh, setBusy],
  );

  const onOpenProfile = useCallback(
    (userId: string): void => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation],
  );

  const onOpenChat = useCallback(
    (c: ConversationSummary): void => {
      const peer = peerOf(c, myUserId);
      navigation.navigate('Chat', {
        conversationId: c.id,
        otherUserName: peer?.displayName ?? 'Chat',
        requestPending: c.status === 'pending',
        ...(peer?.id ? { otherUserId: peer.id } : {}),
      });
    },
    [navigation, myUserId],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="Interactions" bordered />

      {coldLoading ? (
        <View style={styles.list}>
          <SkeletonListRow />
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
          refreshControl={
            <RefreshControl
              refreshing={inboxLoading || conversationsLoading}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={
            rows.length === 0 ? styles.emptyContainer : styles.list
          }
          ListEmptyComponent={
            <EmptyState
              variant="plain"
              icon="message-text-outline"
              title="No interactions yet"
              body="Chats, waves, friend requests, and new followers show up here."
            />
          }
          renderItem={({ item: row }) =>
            row.kind === 'chat' ? (
              <ChatRow
                conversation={row.conversation}
                myUserId={myUserId}
                onOpen={onOpenChat}
              />
            ) : (
              <InboxRow
                item={row.item}
                busy={busyIds.includes(row.item.requestId ?? row.item.fromUser.id)}
                onMatch={(id) => void onMatch(id)}
                onAccept={(id) => void onAccept(id)}
                onDecline={(id) => void onDecline(id)}
                onFollowBack={(id) => void onFollowBack(id)}
                onOpenProfile={onOpenProfile}
              />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { paddingVertical: spacing.sm, flexGrow: 1 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatarWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.action,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  info: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: fontSize.md,
    maxWidth: 160,
  },
  nameUnread: { fontWeight: '800' },
  friendHint: { color: colors.action, fontSize: 11, fontWeight: '600' },
  signal: { color: colors.textSecondary, fontSize: fontSize.sm },
  preview: { color: colors.textSecondary, fontSize: fontSize.sm },
  previewUnread: { color: colors.textPrimary, fontWeight: '600' },
  time: { color: colors.textFaint, fontSize: fontSize.xs },
  chatRight: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 28 },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.action,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.action,
  },
  primaryBtnText: { color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.sm },
  declineBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  declineBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.sm },
  mutualBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  mutualText: { color: colors.action, fontWeight: '700', fontSize: fontSize.xs },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  pendingText: { color: colors.warning, fontWeight: '700', fontSize: fontSize.xs },
});
