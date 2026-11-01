import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

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
import { SoftErrorBanner } from '@/components/SoftErrorBanner';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SkeletonListRow } from '@/components/Skeleton';
import { VerificationBadge } from '@/components/VerificationBadge';
import {
  connectionsEmptyCopy,
  formatConnectionsBadge,
  isActionableConnectionActivity,
  NEXA_CONNECTIONS_VIEWS,
  type NexaConnectionsView,
} from '@/features/connections/nexaConnectionsIdentity';
import { fetchConversations } from '@/features/chat/chatSlice';
import { acceptFriendRequest, declineFriendRequest } from '@/features/friends/friendsSlice';
import {
  aggregateInbox,
  aggregatedSignalLabel,
  type AggregatedInboxRow,
} from '@/features/interactions/aggregateInbox';
import { useInboxInteractions } from '@/features/interactions/useInboxInteractions';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import { withNexaMutationFeedback } from '@/haptics/nexaInteractionFeedback';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { focusUserOnMap } from '@/navigation/focusUserOnMap';
import { onSocketConnected, useSocket } from '@/realtime/useSocket';
import { appAlert } from '@/ui/appAlert';
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type HubRow =
  | { kind: 'chat'; sortAt: number; conversation: ConversationSummary }
  | { kind: 'inbox'; sortAt: number; aggregated: AggregatedInboxRow };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function peerOf(convo: ConversationSummary, myUserId: string) {
  return convo.participants.find((p) => p.id !== myUserId) ?? convo.participants[0] ?? null;
}

function InboxRow({
  aggregated,
  busy,
  onSeen,
  onWaveBack,
  onAccept,
  onDecline,
  onFollowBack,
  onOpenProfile,
  onViewOnMap,
}: {
  aggregated: AggregatedInboxRow;
  busy: boolean;
  onSeen: (seenThrough: string) => void;
  onWaveBack: (userId: string) => void;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onFollowBack: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
  onViewOnMap: (item: InboxItem) => void;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const item = aggregated.primary;
  const label = aggregatedSignalLabel(item, aggregated.count);
  const markSeen = (): void => onSeen(aggregated.latestAt);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => {
        markSeen();
        onOpenProfile(item.fromUser.id);
      }}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`${item.fromUser.displayName}, ${label}`}
    >
      <Avatar uri={item.fromUser.avatarUrl} name={item.fromUser.displayName} size={50} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{item.fromUser.displayName}</Text>
          <VerificationBadge verification={item.fromUser.verification ?? 'none'} size={14} />
        </View>
        <Text style={styles.signal} numberOfLines={2}>{label}</Text>
        <Text style={styles.time}>{timeAgo(aggregated.latestAt)}</Text>
      </View>

      {item.type === 'wave' ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.secondaryAction}
            disabled={busy}
            onPress={(event) => {
              event.stopPropagation?.();
              markSeen();
              onViewOnMap(item);
            }}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.fromUser.displayName} on map`}
          >
            <Icon name="map-marker-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.secondaryActionText}>Map</Text>
          </TouchableOpacity>
          {item.isMutual ? (
            <View style={styles.mutualBadge} accessibilityRole="text">
              <Icon name="check" size={15} color={colors.verified} />
              <Text style={styles.mutualText}>Mutual</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.primaryAction}
              disabled={busy}
              onPress={(event) => {
                event.stopPropagation?.();
                markSeen();
                onWaveBack(item.fromUser.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Wave back to ${item.fromUser.displayName}`}
              accessibilityState={{ disabled: busy }}
            >
              <Text style={styles.primaryActionText}>Wave back</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {item.type === 'friend_request' && item.requestId ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.secondaryAction}
            disabled={busy}
            onPress={(event) => {
              event.stopPropagation?.();
              markSeen();
              onDecline(item.requestId!);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Decline request from ${item.fromUser.displayName}`}
            accessibilityState={{ disabled: busy }}
          >
            <Text style={styles.secondaryActionText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryAction}
            disabled={busy}
            onPress={(event) => {
              event.stopPropagation?.();
              markSeen();
              onAccept(item.requestId!);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Accept request from ${item.fromUser.displayName}`}
            accessibilityState={{ disabled: busy }}
          >
            <Text style={styles.primaryActionText}>Accept</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {item.type === 'follow' && (item.isFollowingBack ? (
        <View style={styles.mutualBadge}>
          <Icon name="check" size={15} color={colors.verified} />
          <Text style={styles.mutualText}>Following</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.primaryAction}
          disabled={busy}
          onPress={(event) => {
            event.stopPropagation?.();
            markSeen();
            onFollowBack(item.fromUser.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Follow back ${item.fromUser.displayName}`}
          accessibilityState={{ disabled: busy }}
        >
          <Text style={styles.primaryActionText}>Follow back</Text>
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
  onOpen: (conversation: ConversationSummary) => void;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const peer = peerOf(conversation, myUserId);
  const name = peer?.displayName ?? 'Chat';
  const last = conversation.lastMessage;
  const isFromMe = last?.senderId === myUserId;
  const unreadCount = conversation.unreadCount ?? 0;
  const unread = unreadCount > 0;
  const preview = last
    ? `${isFromMe ? 'You: ' : ''}${last.body}`
    : conversation.status === 'pending'
      ? 'Message request'
      : 'No messages yet';
  const when = conversation.lastMessageAt ? timeAgo(conversation.lastMessageAt) : '';
  const online = conversation.peerOnline === true;
  const badge = formatConnectionsBadge(unreadCount);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onOpen(conversation)}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${name}${unread ? `, ${unreadCount} unread` : ''}`}
    >
      <View style={styles.avatarWrap}>
        <Avatar uri={peer?.avatarUrl ?? null} name={name} size={50} />
        {online ? <View style={styles.onlineDot} accessibilityLabel="Online" /> : null}
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>{name}</Text>
          {conversation.isFriend ? <Text style={styles.friendHint}>Connected</Text> : null}
        </View>
        <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={2}>{preview}</Text>
      </View>
      <View style={styles.chatRight}>
        {when ? <Text style={styles.time}>{when}</Text> : null}
        {badge ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{badge}</Text>
          </View>
        ) : conversation.status === 'pending' ? (
          <View style={styles.pendingBadge}><Text style={styles.pendingText}>Request</Text></View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function InteractionsScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const myUserId = useAppSelector((state) => state.auth.user?.id ?? '');
  const conversations = useAppSelector((state) => state.chat.conversations);
  const conversationsLoading = useAppSelector((state) => state.chat.conversationsLoading);
  const { items, loading: inboxLoading, error: inboxError, refresh } = useInboxInteractions();
  const { unreadCount: unreadActivityCount, markSeen } = useReceivedInteractions();
  const { on } = useSocket();
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [tab, setTab] = useState<NexaConnectionsView>('activity');
  const [chatError, setChatError] = useState(false);
  const loadChatsInFlightRef = useRef<Promise<void> | null>(null);

  const loadChats = useCallback((): Promise<void> => {
    const existing = loadChatsInFlightRef.current;
    if (existing) return existing;

    const task = (async (): Promise<void> => {
      const result = await dispatch(fetchConversations());
      setChatError(fetchConversations.rejected.match(result));
    })();

    loadChatsInFlightRef.current = task;
    void task.finally(() => {
      if (loadChatsInFlightRef.current === task) {
        loadChatsInFlightRef.current = null;
      }
    });
    return task;
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      void loadChats();
    }, [loadChats]),
  );

  useEffect(() => {
    const unsubs = [
      onSocketConnected(() => { void loadChats(); }),
      on('conversation:opened', () => { void loadChats(); }),
      on('friend:accepted', () => { void loadChats(); }),
    ];
    return () => {
      for (const unsubscribe of unsubs) unsubscribe();
    };
  }, [on, loadChats]);

  const chatRows: HubRow[] = useMemo(
    () => conversations.map((conversation) => ({
      kind: 'chat' as const,
      sortAt: conversation.lastMessageAt ? new Date(conversation.lastMessageAt).getTime() : 0,
      conversation,
    })),
    [conversations],
  );

  const aggregatedActivity = useMemo(() => aggregateInbox(items), [items]);
  const activityRows: HubRow[] = useMemo(
    () => aggregatedActivity.map((aggregated) => ({
      kind: 'inbox' as const,
      sortAt: new Date(aggregated.latestAt).getTime(),
      aggregated,
    })),
    [aggregatedActivity],
  );

  const unreadChatCount = useMemo(
    () => conversations.reduce((sum, conversation) => sum + Math.max(0, conversation.unreadCount ?? 0), 0),
    [conversations],
  );
  const actionableActivityCount = useMemo(
    () => aggregatedActivity.filter((row) => isActionableConnectionActivity(row.primary)).length,
    [aggregatedActivity],
  );
  const activityNeedsAttention = actionableActivityCount > 0 || unreadActivityCount > 0;
  const chatBadge = formatConnectionsBadge(unreadChatCount);

  const rows = tab === 'chats' ? chatRows : activityRows;
  const coldLoading = rows.length === 0 && (tab === 'chats' ? conversationsLoading : inboxLoading);
  const showInboxErrorEmpty = tab === 'activity' && inboxError != null && items.length === 0 && !inboxLoading;
  const showInboxSoftError = tab === 'activity' && inboxError != null && items.length > 0;
  const showChatErrorEmpty = tab === 'chats' && chatError && conversations.length === 0 && !conversationsLoading;
  const showChatSoftError = tab === 'chats' && chatError && conversations.length > 0;

  const onRefresh = useCallback((): void => {
    if (tab === 'chats') {
      void loadChats();
      return;
    }
    void refresh();
  }, [loadChats, refresh, tab]);

  const setBusy = useCallback((id: string, onFlag: boolean): void => {
    setBusyIds((previous) => onFlag
      ? previous.includes(id) ? previous : [...previous, id]
      : previous.filter((value) => value !== id));
  }, []);

  const onWaveBack = useCallback(async (userId: string): Promise<void> => {
    setBusy(userId, true);
    try {
      await withNexaMutationFeedback(
        () => postJson<WaveRequest, WaveResponse>('/interactions/wave', {
          toUserId: userId,
          context: 'profile',
        }),
        'connect',
      );
      await refresh();
    } catch {
      appAlert("Couldn't wave back", 'Try again in a moment.');
    } finally {
      setBusy(userId, false);
    }
  }, [refresh, setBusy]);

  const onAccept = useCallback(async (requestId: string): Promise<void> => {
    setBusy(requestId, true);
    try {
      await withNexaMutationFeedback(
        () => dispatch(acceptFriendRequest(requestId)).unwrap(),
        'connect',
      );
      await refresh();
    } catch {
      appAlert("Couldn't accept request", 'The request may have changed. Refresh and try again.');
    } finally {
      setBusy(requestId, false);
    }
  }, [dispatch, refresh, setBusy]);

  const onDecline = useCallback(async (requestId: string): Promise<void> => {
    setBusy(requestId, true);
    try {
      await withNexaMutationFeedback(
        () => dispatch(declineFriendRequest(requestId)).unwrap(),
        'commit',
      );
      await refresh();
    } catch {
      appAlert("Couldn't decline request", 'Refresh and try again.');
    } finally {
      setBusy(requestId, false);
    }
  }, [dispatch, refresh, setBusy]);

  const onFollowBack = useCallback(async (userId: string): Promise<void> => {
    setBusy(userId, true);
    try {
      await withNexaMutationFeedback(
        () => postJson<FollowRequest, { following: true }>('/friends/follow', { userId }),
        'connect',
      );
      await refresh();
    } catch {
      appAlert("Couldn't follow back", 'Try again in a moment.');
    } finally {
      setBusy(userId, false);
    }
  }, [refresh, setBusy]);

  const onOpenProfile = useCallback((userId: string): void => {
    navigation.navigate('UserProfile', { userId });
  }, [navigation]);

  const onViewOnMap = useCallback(async (item: InboxItem): Promise<void> => {
    const id = item.fromUser.id;
    setBusy(id, true);
    try {
      const result = await focusUserOnMap(navigation, {
        userId: id,
        displayName: item.fromUser.displayName,
        avatarUrl: item.fromUser.avatarUrl,
        verification: item.fromUser.verification ?? null,
      });
      if (result === 'no_pin') {
        appAlert(
          'Not on the map right now',
          'This person does not have a discoverable nearby pin right now. You can still open their profile.',
        );
      }
    } finally {
      setBusy(id, false);
    }
  }, [navigation, setBusy]);

  const onOpenChat = useCallback((conversation: ConversationSummary): void => {
    const peer = peerOf(conversation, myUserId);
    navigation.navigate('Chat', {
      conversationId: conversation.id,
      otherUserName: peer?.displayName ?? 'Chat',
      requestPending: conversation.status === 'pending',
      ...(peer?.id ? { otherUserId: peer.id } : {}),
    });
  }, [navigation, myUserId]);

  const openMapDiscovery = useCallback((): void => {
    navigation.navigate('Main', { screen: 'Map' });
  }, [navigation]);

  const emptyCopy = connectionsEmptyCopy(tab);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Connections" bordered />

      <View style={styles.identityStrip} accessibilityRole="summary">
        <View style={styles.identityGlyph}>
          <Icon name="account-multiple-outline" size={20} color={colors.actionPrimary} />
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.identityTitle}>People you can return to</Text>
          <Text style={styles.identityBody} numberOfLines={2}>
            Requests, mutual signals and conversations stay together here — not in a feed.
          </Text>
        </View>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {(Object.keys(NEXA_CONNECTIONS_VIEWS) as NexaConnectionsView[]).map((value) => {
          const identity = NEXA_CONNECTIONS_VIEWS[value];
          const selected = tab === value;
          const badge = value === 'chats' ? chatBadge : null;
          const showAttentionDot = value === 'activity' && activityNeedsAttention;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.tab, selected && styles.tabActive]}
              onPress={() => setTab(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${identity.accessibilityLabel}${badge ? `, ${badge} unread` : showAttentionDot ? ', attention needed' : ''}`}
            >
              <Icon
                name={identity.icon}
                size={18}
                color={selected ? colors.actionPrimary : colors.textTertiary}
              />
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>{identity.label}</Text>
              {badge ? (
                <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{badge}</Text></View>
              ) : showAttentionDot ? (
                <View style={styles.attentionDot} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {showInboxSoftError ? (
        <SoftErrorBanner message="Couldn't refresh connection activity — showing the last known signals" onRetry={() => void refresh()} />
      ) : null}
      {showChatSoftError ? (
        <SoftErrorBanner message="Couldn't refresh chats — showing recent conversations" onRetry={() => void loadChats()} />
      ) : null}

      {coldLoading ? (
        <View style={styles.list} accessibilityLabel={`Loading ${tab}`} accessibilityRole="progressbar">
          <SkeletonListRow /><SkeletonListRow /><SkeletonListRow />
          <SkeletonListRow /><SkeletonListRow />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.kind === 'chat' ? `chat-${row.conversation.id}` : row.aggregated.key}
          refreshControl={
            <RefreshControl
              refreshing={tab === 'chats' ? conversationsLoading : inboxLoading}
              onRefresh={onRefresh}
              tintColor={colors.actionPrimary}
              colors={[colors.actionPrimary]}
              progressBackgroundColor={colors.surfacePrimary}
            />
          }
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={showInboxErrorEmpty || showChatErrorEmpty ? (
            <EmptyState
              variant="plain"
              icon="cloud-alert-outline"
              title={tab === 'chats' ? "Chats didn't refresh" : "Connections didn't refresh"}
              body="Your existing connections are unchanged. Try again without changing your profile or discovery settings."
              actionLabel={tab === 'chats' ? 'Retry chats' : 'Retry activity'}
              onAction={onRefresh}
            />
          ) : (
            <EmptyState
              variant="plain"
              icon={emptyCopy.icon}
              title={emptyCopy.title}
              body={emptyCopy.body}
              actionLabel={emptyCopy.actionLabel}
              onAction={openMapDiscovery}
            />
          )}
          renderItem={({ item: row }) => row.kind === 'chat' ? (
            <ChatRow conversation={row.conversation} myUserId={myUserId} onOpen={onOpenChat} />
          ) : (
            <InboxRow
              aggregated={row.aggregated}
              busy={busyIds.includes(row.aggregated.primary.requestId ?? row.aggregated.primary.fromUser.id)}
              onSeen={markSeen}
              onWaveBack={(id) => void onWaveBack(id)}
              onAccept={(id) => void onAccept(id)}
              onDecline={(id) => void onDecline(id)}
              onFollowBack={(id) => void onFollowBack(id)}
              onOpenProfile={onOpenProfile}
              onViewOnMap={(item) => void onViewOnMap(item)}
            />
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    identityStrip: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surfacePrimary,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.actionBorderSoft,
    },
    identityGlyph: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.actionSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.actionBorderSoft,
    },
    identityCopy: { flex: 1, minWidth: 0 },
    identityTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '800' },
    identityBody: { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 17, marginTop: 2 },
    tabs: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      padding: 4,
      gap: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    tab: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.pill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tabActive: {
      backgroundColor: colors.actionSoft,
      borderColor: colors.actionBorderSoft,
    },
    tabText: { color: colors.textTertiary, fontSize: fontSize.sm, fontWeight: '700' },
    tabTextActive: { color: colors.actionPrimary },
    tabBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
      backgroundColor: colors.actionPrimary,
    },
    tabBadgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: '800' },
    attentionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.actionPrimary },
    list: { paddingTop: spacing.xs, paddingBottom: spacing.xl, flexGrow: 1 },
    emptyContainer: { flexGrow: 1, justifyContent: 'center', paddingBottom: 64 },
    row: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.md,
      backgroundColor: colors.surfacePrimary,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    avatarWrap: { position: 'relative' },
    onlineDot: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.surfacePrimary,
    },
    info: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600', flexShrink: 1 },
    nameUnread: { fontWeight: '800' },
    friendHint: { color: colors.actionPrimary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    signal: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 18, marginTop: 2 },
    preview: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 18, marginTop: 2 },
    previewUnread: { color: colors.textPrimary, fontWeight: '600' },
    time: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },
    chatRight: { alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: 2, gap: 6 },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.actionPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    unreadBadgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: '800' },
    pendingBadge: {
      paddingHorizontal: 8,
      minHeight: 24,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.discoverySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.discoveryBorderSoft,
    },
    pendingText: { color: colors.discovery, fontSize: 10, fontWeight: '800' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
    primaryAction: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: radius.md,
      backgroundColor: colors.actionPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryActionText: { color: colors.onPrimary, fontSize: fontSize.xs, fontWeight: '800' },
    secondaryAction: {
      minHeight: 44,
      paddingHorizontal: 10,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceSecondary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    secondaryActionText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '700' },
    mutualBadge: {
      minHeight: 36,
      paddingHorizontal: 9,
      borderRadius: radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: colors.discoverySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.discoveryBorderSoft,
    },
    mutualText: { color: colors.verified, fontSize: fontSize.xs, fontWeight: '800' },
  });
}
