import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ChatMessage, PublicUserProfile, VerificationLevel } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { getJson } from '@/api/client';
import { VerificationBadge } from '@/components/VerificationBadge';
import { Avatar } from '@/components/Avatar';
import { colors, spacing, useAppTheme } from '@/theme';
import { ScreenHeader } from '@/components/ScreenHeader';
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
import { SendGiftSheet } from '@/features/gifts/SendGiftSheet';
import { useLiveLocationShare } from '@/features/chat/useLiveLocationShare';
import { LocationShareSheet } from '@/features/chat/LocationShareSheet';
import { LocationSessionBanner } from '@/features/chat/LocationSessionBanner';
import { LocationSessionBubble } from '@/features/chat/LocationSessionBubble';

type Route = RouteProp<RootStackParamList, 'Chat'>;

function MessageBubble({
  msg,
  isMine,
  isPending,
  isFailed,
  onRetry,
  peerName,
  peerAvatarUrl,
  onOpenPeerProfile,
}: {
  msg: ChatMessage;
  isMine: boolean;
  isPending: boolean;
  isFailed: boolean;
  onRetry: () => void;
  peerName: string;
  peerAvatarUrl: string | null;
  onOpenPeerProfile: () => void;
}): React.JSX.Element {
  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowPeer]}>
      {!isMine ? (
        <TouchableOpacity onPress={onOpenPeerProfile} accessibilityRole="button" accessibilityLabel={`Open ${peerName} profile`}>
          <Avatar uri={peerAvatarUrl} name={peerName} size={32} />
        </TouchableOpacity>
      ) : null}
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubblePeer, isFailed && styles.bubbleFailed]}>
        <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextPeer]}>{msg.body}</Text>
        {isPending ? <Text style={styles.meta}>Sending…</Text> : null}
        {isFailed ? (
          <TouchableOpacity onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry send">
            <Text style={styles.retry}>Failed · tap to retry</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function ChatScreen(): React.JSX.Element {
	const { colors: themeColors } = useAppTheme();

  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<Route>();
  const conversationId = params.conversationId;
  const peerUserId = params.peerUserId;

  const messages = useAppSelector((s) => s.chat.messagesByConversation[conversationId] ?? []);
  const loading = useAppSelector((s) => s.chat.loadingByConversation[conversationId] ?? false);
  const failedIds = useAppSelector((s) => s.chat.failedMessageIds ?? []);
  const pendingIds = useAppSelector((s) => s.chat.pendingMessageIds ?? []);
  const myUserId = useAppSelector((s) => s.auth.user?.id);

  const [text, setText] = useState('');
  const [peer, setPeer] = useState<PublicUserProfile | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const { connected } = useSocket();

  const location = useLiveLocationShare(conversationId);

  useEffect(() => {
    void dispatch(fetchMessages(conversationId));
  }, [conversationId, dispatch]);

  useEffect(() => {
    let active = true;
    getJson<PublicUserProfile>(`/users/${peerUserId}/public`)
      .then((p) => {
        if (active) setPeer(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [peerUserId]);

  const sorted = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages]);

  const send = useCallback(() => {
    const body = text.trim();
    if (!body || !myUserId) return;
    setText('');
    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dispatch(
      messageSentOptimistic({
        conversationId,
        message: {
          id: clientId,
          conversationId,
          senderId: myUserId,
          body,
          createdAt: new Date().toISOString(),
          clientId,
        },
      }),
    );
    socketSendMessage({ conversationId, body, clientId });
  }, [text, myUserId, conversationId, dispatch]);

  const onRetry = useCallback(
    (msg: ChatMessage) => {
      if (!myUserId) return;
      dispatch(failedMessageCleared(msg.id));
      const clientId = msg.clientId ?? msg.id;
      dispatch(
        messageQueued({
          conversationId,
          message: { ...msg, id: clientId, clientId },
        }),
      );
      socketSendMessage({ conversationId, body: msg.body, clientId });
    },
    [conversationId, dispatch, myUserId],
  );

  const openPeer = useCallback(() => {
    navigation.navigate('UserProfile', { userId: peerUserId });
  }, [navigation, peerUserId]);

  const title = peer?.displayName ?? 'Chat';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: themeColors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScreenHeader
        title={title}
        onTitlePress={openPeer}
        right={
          peer?.verification ? (
            <VerificationBadge level={peer.verification as VerificationLevel} size="sm" />
          ) : undefined
        }
      />

      {location.active ? (
        <LocationSessionBanner session={location.session} onStop={location.stop} />
      ) : null}

      {loading && sorted.length === 0 ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      ) : (
        <FlatList
          ref={listRef}
          data={sorted}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMine = item.senderId === myUserId;
            const isPending = pendingIds.includes(item.id) || pendingIds.includes(item.clientId ?? '');
            const isFailed = failedIds.includes(item.id) || failedIds.includes(item.clientId ?? '');
            return (
              <MessageBubble
                msg={item}
                isMine={isMine}
                isPending={isPending}
                isFailed={isFailed}
                onRetry={() => onRetry(item)}
                peerName={peer?.displayName ?? 'Peer'}
                peerAvatarUrl={peer?.avatarUrl ?? null}
                onOpenPeerProfile={openPeer}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Say hello</Text>
            </View>
          }
        />
      )}

      <View style={styles.composer}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setGiftOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Send gift"
        >
          <Text style={styles.iconBtnText}>🎁</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setLocationOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Share location"
        >
          <Text style={styles.iconBtnText}>📍</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={connected ? 'Message' : 'Connecting…'}
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={2000}
          editable={connected}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || !connected) && styles.sendDisabled]}
          onPress={send}
          disabled={!text.trim() || !connected}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>

      <SendGiftSheet
        visible={giftOpen}
        onClose={() => setGiftOpen(false)}
        peerUserId={peerUserId}
        conversationId={conversationId}
      />
      <LocationShareSheet
        visible={locationOpen}
        onClose={() => setLocationOpen(false)}
        conversationId={conversationId}
        onStart={location.start}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 },
  row: { flexDirection: 'row', marginBottom: spacing.sm, alignItems: 'flex-end', gap: 8 },
  rowMine: { justifyContent: 'flex-end' },
  rowPeer: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '72%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: colors.primary },
  bubblePeer: { backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  bubbleFailed: { opacity: 0.85 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: colors.onPrimary },
  bubbleTextPeer: { color: colors.textPrimary },
  meta: { color: colors.onPrimary, opacity: 0.7, fontSize: 11, marginTop: 2 },
  retry: { color: colors.danger, fontSize: 12, marginTop: 4, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: colors.textMuted },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  iconBtn: { padding: 8 },
  iconBtnText: { fontSize: 18 },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
});
