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
import { colors } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import {
  fetchMessages,
  messageReceived,
  messageSentOptimistic,
  messageConfirmed,
  messageQueued,
  failedMessageCleared,
  setActiveConversation,
  markConversationReadRemote,
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
}: {
  msg: ChatMessage;
  isMine: boolean;
  isPending: boolean;
  isFailed: boolean;
  onRetry: () => void;
}): React.JSX.Element {
  if (msg.type === 'location_session') {
    return <LocationSessionBubble msg={msg} isMine={isMine} />;
  }

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<Route>();
  const {
    conversationId,
    requestPending,
    otherUserName,
    otherUserVerification,
    otherUserIdVerified,
    otherUserId: paramOtherUserId,
  } = params;

  const myUserId = useAppSelector((s) => s.auth.user?.id ?? '');
  const messages = useAppSelector((s) => s.chat.messages[conversationId] ?? []);
  const nextCursor = useAppSelector((s) => s.chat.nextCursor[conversationId] ?? null);
  const loading = useAppSelector((s) => s.chat.messagesLoading[conversationId] ?? false);
  const outbox = useAppSelector((s) => s.chat.outbox);
  const failedIds = useAppSelector((s) => s.chat.failedIds);

  const pendingIds = useMemo(() => {
    const ids = new Set(outbox.map((e) => e.optimisticId));
    for (const m of messages) {
      if (m.id.startsWith('opt-') && !failedIds.includes(m.id)) {
        ids.add(m.id);
      }
    }
    return ids;
  }, [outbox, messages, failedIds]);

  const theyReplied = messages.some((m) => m.senderId !== myUserId);
  const iSent = messages.some((m) => m.senderId === myUserId);
  const showRequestBanner = !!requestPending && !theyReplied;
  const requestLocked = showRequestBanner && iSent;

  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [fetchedPeer, setFetchedPeer] = useState<{
    userId: string;
    verification: VerificationLevel;
    idVerified: boolean;
    blockedByViewer: boolean;
    avatarUrl: string | null;
  } | null>(null);
  const { on, joinConversation, sendMessage } = useSocket();

  const {
    session: liveSession,
    starting: shareStarting,
    isSharer,
    start: startShare,
    stop: stopShare,
    openInMaps,
  } = useLiveLocationShare(conversationId);

  const otherUserId =
    paramOtherUserId ??
    messages.find((m) => m.senderId !== myUserId)?.senderId ??
    null;
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (!otherUserId) return;
    let cancelled = false;
    getJson<PublicUserProfile>(`/users/${otherUserId}`)
      .then((p) => {
        if (!cancelled) {
          setFetchedPeer({
            userId: otherUserId,
            verification: p.verification,
            idVerified: p.idVerified,
            blockedByViewer: p.blockedByViewer ?? false,
            avatarUrl: p.avatarUrl ?? p.photoUrls?.[0] ?? null,
          });
        }
      })
      .catch(() => { /* non-blocking */ });
    return () => { cancelled = true; };
  }, [otherUserId]);

  const peerBadge = fetchedPeer?.userId === otherUserId ? fetchedPeer : null;
  const badgeVerification = otherUserVerification ?? peerBadge?.verification ?? 'none';
  const badgeIdVerified = otherUserIdVerified ?? peerBadge?.idVerified;
  const canGift = !!otherUserId && peerBadge != null && !peerBadge.blockedByViewer;
  const canShareLocation = !requestLocked;

  // Track active thread so inbound socket msgs do not bump unread; clear on leave.
  useEffect(() => {
    dispatch(setActiveConversation(conversationId));
    void dispatch(markConversationReadRemote(conversationId));
    return () => {
      dispatch(setActiveConversation(null));
    };
  }, [conversationId, dispatch]);

  useEffect(() => {
    void dispatch(fetchMessages({ conversationId }));
    void joinConversation(conversationId);
  }, [conversationId, dispatch, joinConversation]);

  // While focused, keep advancing last_read_at as messages arrive.
  useEffect(() => {
    return on('chat:message', (msg) => {
      dispatch(
        messageReceived({
          ...msg,
          type: msg.type ?? 'text',
          location: msg.location ?? null,
          locationSessionId: msg.locationSessionId ?? null,
          viewerId: myUserId,
        }),
      );
      if (msg.conversationId === conversationId && msg.senderId !== myUserId) {
        void dispatch(markConversationReadRemote(conversationId));
      }
    });
  }, [on, dispatch, conversationId, myUserId]);

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
      type: 'text',
      createdAt: new Date().toISOString(),
    };
    dispatch(messageSentOptimistic(optimistic));

    const confirmed = await sendMessage(conversationId, text, optimisticId);
    if (confirmed) {
      dispatch(
        messageConfirmed({
          optimisticId,
          confirmed: {
            ...confirmed,
            type: confirmed.type ?? 'text',
            location: confirmed.location ?? null,
            locationSessionId: confirmed.locationSessionId ?? null,
          },
        }),
      );
    } else {
      dispatch(messageQueued({ optimisticId, conversationId, body: text, retries: 0 }));
    }
    setSending(false);
  }, [body, sending, conversationId, myUserId, dispatch, sendMessage]);

  const retry = useCallback(async (optimisticId: string, text: string): Promise<void> => {
    dispatch(failedMessageCleared(optimisticId));
    dispatch(messageQueued({ optimisticId, conversationId, body: text, retries: 0 }));
    const confirmed = await socketSendMessage(conversationId, text, optimisticId);
    if (confirmed) {
      dispatch(
        messageConfirmed({
          optimisticId,
          confirmed: {
            ...confirmed,
            type: confirmed.type ?? 'text',
            location: confirmed.location ?? null,
            locationSessionId: confirmed.locationSessionId ?? null,
          },
        }),
      );
    } else {
      dispatch(messageQueued({ optimisticId, conversationId, body: text, retries: 0 }));
    }
  }, [conversationId, dispatch]);

  const loadMore = (): void => {
    if (nextCursor && !loading) {
      void dispatch(fetchMessages({ conversationId, cursor: nextCursor }));
    }
  };

  const onShareDuration = useCallback(
    async (duration: '15m' | '60m' | 'until_off') => {
      await startShare(duration);
      setShareOpen(false);
    },
    [startShare],
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.headerBackText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerTitleTap}
          onPress={() => {
            if (!otherUserId) return;
            navigation.navigate('UserProfile', { userId: otherUserId });
          }}
          disabled={!otherUserId}
          accessibilityRole="button"
          accessibilityLabel={`Open profile for ${otherUserName || 'user'}`}
          activeOpacity={0.7}
        >
          <Avatar
            uri={peerBadge?.avatarUrl ?? null}
            name={otherUserName || 'Chat'}
            size={32}
          />
          <Text style={styles.headerName} numberOfLines={1}>
            {otherUserName || 'Chat'}
          </Text>
          <VerificationBadge
            verification={badgeVerification}
            idVerified={badgeIdVerified}
            size={18}
          />
        </TouchableOpacity>
      </View>

      {showRequestBanner && (
        <View style={styles.requestBanner}>
          <Text style={styles.requestBannerText}>
            {requestLocked
              ? 'Request sent — you can send another message once they reply.'
              : "Message request — they'll see one message until they reply."}
          </Text>
        </View>
      )}

      {liveSession ? (
        <LocationSessionBanner
          session={liveSession}
          isSharer={isSharer}
          peerName={otherUserName}
          onStop={() => void stopShare()}
          onOpenMap={openInMaps}
        />
      ) : null}

      {loading && messages.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
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
              isPending={pendingIds.has(item.id)}
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
        {canShareLocation ? (
          <TouchableOpacity
            style={styles.locBtn}
            onPress={() => setShareOpen(true)}
            disabled={shareStarting}
          >
            <Text style={styles.locBtnText}>📍</Text>
          </TouchableOpacity>
        ) : null}
        {canGift ? (
          <TouchableOpacity style={styles.giftBtn} onPress={() => setGiftOpen(true)}>
            <Text style={styles.giftBtnText}>🎁</Text>
          </TouchableOpacity>
        ) : null}
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder={requestLocked ? 'Waiting for a reply…' : 'Message…'}
          placeholderTextColor={colors.textFaint}
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
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={styles.sendBtnText}>↑</Text>
          )}
        </TouchableOpacity>
      </View>

      {canGift && otherUserId ? (
        <SendGiftSheet
          visible={giftOpen}
          recipientId={otherUserId}
          recipientName={otherUserName}
          onClose={() => setGiftOpen(false)}
        />
      ) : null}

      <LocationShareSheet
        visible={shareOpen}
        starting={shareStarting}
        onClose={() => setShareOpen(false)}
        onShare={(d) => void onShareDuration(d)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerBack: { paddingHorizontal: 6 },
  headerBackText: { color: colors.primary, fontSize: 28, lineHeight: 28, marginTop: -2 },
  headerTitleTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  headerName: { flexShrink: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  requestBanner: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  requestBannerText: { color: colors.action, fontSize: 12, textAlign: 'center' },
  messageList: { paddingHorizontal: 12, paddingVertical: 8 },
  locBtn: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  locBtnText: { fontSize: 20 },
  giftBtn: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  giftBtnText: { fontSize: 22 },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: 10, marginVertical: 3 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceAlt },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: colors.onPrimary },
  bubbleTextTheirs: { color: colors.textPrimary },
  statusPending: { fontSize: 11, color: 'rgba(10,10,15,0.4)', marginTop: 2, textAlign: 'right' },
  statusFailed: { fontSize: 11, color: colors.danger, marginTop: 2, textAlign: 'right', fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
    backgroundColor: colors.bg,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: colors.onPrimary, fontSize: 18, fontWeight: '700' },
});
