import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type {
  CreateGroupConversationRequest,
  CreateGroupConversationResponse,
  FriendCard,
  FriendsPage,
  GroupConversationSummary,
} from '@g88/shared';
import { getJson, postJson } from '@/api/client';
import { Avatar } from '@/components/Avatar';
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';

type CryptoWithRandomUuid = {
  randomUUID?: () => string;
};

function createClientRequestId(): string {
  const cryptoApi = (globalThis as typeof globalThis & { crypto?: CryptoWithRandomUuid }).crypto;
  if (typeof cryptoApi?.randomUUID !== 'function') {
    throw new Error('Secure request id is unavailable');
  }
  return cryptoApi.randomUUID();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function loadAllFriends(): Promise<FriendCard[]> {
  const items: FriendCard[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;

  for (let pageIndex = 0; pageIndex < 20; pageIndex += 1) {
    const query: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const page: FriendsPage = await getJson<FriendsPage>(`/friends${query}`);
    for (const item of page.items) {
      if (!seen.has(item.userId)) {
        seen.add(item.userId);
        items.push(item);
      }
    }
    if (!page.nextCursor || page.nextCursor === cursor) break;
    cursor = page.nextCursor;
  }

  return items;
}

function GroupRow({ group }: { group: GroupConversationSummary }): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const memberCount = group.members.length;
  const last = group.lastMessage;
  const preview = last?.body ?? 'Group ready';
  const when = group.lastMessageAt ? timeAgo(group.lastMessageAt) : null;

  return (
    <View style={styles.groupRow} accessibilityRole="summary" accessibilityLabel={`${group.title}, ${memberCount} members`}>
      <View style={styles.groupIcon}>
        <Icon name="account-group-outline" size={22} color={colors.actionPrimary} />
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupTitle} numberOfLines={1}>{group.title}</Text>
        <Text style={styles.groupMeta}>{memberCount} members{when ? ` · ${when}` : ''}</Text>
        <Text style={styles.groupPreview} numberOfLines={1}>{preview}</Text>
      </View>
      <View style={styles.groupState}>
        {group.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{Math.min(group.unreadCount, 99)}{group.unreadCount > 99 ? '+' : ''}</Text>
          </View>
        ) : null}
        <Text style={styles.groupStateText}>Setup</Text>
      </View>
    </View>
  );
}

export function GroupChatsPanel(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [groups, setGroups] = useState<GroupConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [friends, setFriends] = useState<FriendCard[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const loadInFlightRef = useRef<Promise<void> | null>(null);

  const loadGroups = useCallback((): Promise<void> => {
    const existing = loadInFlightRef.current;
    if (existing) return existing;

    const task = (async (): Promise<void> => {
      try {
        const result = await getJson<GroupConversationSummary[]>('/conversations/groups');
        setGroups(result);
        setLoadError(false);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();

    loadInFlightRef.current = task;
    void task.finally(() => {
      if (loadInFlightRef.current === task) loadInFlightRef.current = null;
    });
    return task;
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const resetCreateState = useCallback((): void => {
    setTitle('');
    setSelectedIds([]);
    setCreateError(null);
    requestIdRef.current = null;
  }, []);

  const closeModal = useCallback((): void => {
    if (creating) return;
    setModalOpen(false);
    resetCreateState();
  }, [creating, resetCreateState]);

  const openModal = useCallback((): void => {
    setModalOpen(true);
    setCreateError(null);
    if (friends.length > 0 || friendsLoading) return;
    setFriendsLoading(true);
    setFriendsError(false);
    void loadAllFriends()
      .then((items) => {
        setFriends(items);
      })
      .catch(() => {
        setFriendsError(true);
      })
      .finally(() => {
        setFriendsLoading(false);
      });
  }, [friends.length, friendsLoading]);

  const updateTitle = useCallback((value: string): void => {
    requestIdRef.current = null;
    setTitle(value);
    setCreateError(null);
  }, []);

  const toggleMember = useCallback((userId: string): void => {
    requestIdRef.current = null;
    setCreateError(null);
    setSelectedIds((previous) => previous.includes(userId)
      ? previous.filter((id) => id !== userId)
      : previous.length >= 31
        ? previous
        : [...previous, userId]);
  }, []);

  const canCreate = title.trim().length > 0 && selectedIds.length >= 2 && selectedIds.length <= 31 && !creating;

  const createGroup = useCallback(async (): Promise<void> => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0 || selectedIds.length < 2 || selectedIds.length > 31 || creating) return;

    setCreating(true);
    setCreateError(null);
    try {
      const clientRequestId = requestIdRef.current ?? createClientRequestId();
      requestIdRef.current = clientRequestId;
      const response = await postJson<CreateGroupConversationRequest, CreateGroupConversationResponse>(
        '/conversations/groups',
        {
          clientRequestId,
          title: trimmedTitle,
          memberIds: selectedIds,
        },
      );
      setGroups((previous) => {
        const remaining = previous.filter((group) => group.id !== response.conversation.id);
        return [response.conversation, ...remaining];
      });
      setModalOpen(false);
      resetCreateState();
    } catch {
      setCreateError('Could not create this group. Check the selected friends and try again.');
    } finally {
      setCreating(false);
    }
  }, [creating, resetCreateState, selectedIds, title]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>Group chats</Text>
          <Text style={styles.sectionBody}>Create a private group from your close friends.</Text>
        </View>
        <TouchableOpacity
          style={styles.newGroupButton}
          onPress={openModal}
          accessibilityRole="button"
          accessibilityLabel="Create group chat"
        >
          <Icon name="account-multiple-plus-outline" size={17} color={colors.onPrimary} />
          <Text style={styles.newGroupButtonText}>New group</Text>
        </TouchableOpacity>
      </View>

      {loadError ? (
        <TouchableOpacity style={styles.inlineNotice} onPress={() => void loadGroups()} accessibilityRole="button">
          <Icon name="refresh" size={16} color={colors.textSecondary} />
          <Text style={styles.inlineNoticeText}>Group chats did not refresh. Tap to retry.</Text>
        </TouchableOpacity>
      ) : null}

      {loading ? (
        <View style={styles.loadingRow} accessibilityRole="progressbar" accessibilityLabel="Loading group chats">
          <ActivityIndicator color={colors.actionPrimary} />
          <Text style={styles.loadingText}>Loading groups…</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyGroups}>
          <Icon name="account-group-outline" size={21} color={colors.textTertiary} />
          <Text style={styles.emptyGroupsText}>No groups yet. Start one with at least two close friends.</Text>
        </View>
      ) : (
        <View style={styles.groupsList}>
          {groups.map((group) => <GroupRow key={group.id} group={group} />)}
        </View>
      )}

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>New group</Text>
                <Text style={styles.modalSubtitle}>Choose 2–31 close friends. Group messaging stays isolated from DM live-location behavior.</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeModal}
                disabled={creating}
                accessibilityRole="button"
                accessibilityLabel="Close create group"
              >
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={updateTitle}
              placeholder="Group name"
              placeholderTextColor={colors.textTertiary}
              maxLength={80}
              editable={!creating}
              returnKeyType="done"
              accessibilityLabel="Group name"
            />

            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>Members</Text>
              <Text style={styles.selectionCount}>{selectedIds.length}/31 selected</Text>
            </View>

            <ScrollView style={styles.friendScroller} contentContainerStyle={styles.friendList} keyboardShouldPersistTaps="handled">
              {friendsLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.actionPrimary} />
                  <Text style={styles.loadingText}>Loading close friends…</Text>
                </View>
              ) : friendsError ? (
                <TouchableOpacity
                  style={styles.inlineNotice}
                  onPress={() => {
                    setFriendsLoading(true);
                    setFriendsError(false);
                    void loadAllFriends()
                      .then(setFriends)
                      .catch(() => setFriendsError(true))
                      .finally(() => setFriendsLoading(false));
                  }}
                  accessibilityRole="button"
                >
                  <Icon name="refresh" size={16} color={colors.textSecondary} />
                  <Text style={styles.inlineNoticeText}>Friends did not load. Tap to retry.</Text>
                </TouchableOpacity>
              ) : friends.length === 0 ? (
                <Text style={styles.noFriendsText}>You need at least two close friends before creating a group.</Text>
              ) : friends.map((friend) => {
                const selected = selectedIds.includes(friend.userId);
                const selectionBlocked = !selected && selectedIds.length >= 31;
                return (
                  <TouchableOpacity
                    key={friend.userId}
                    style={[styles.friendRow, selected && styles.friendRowSelected]}
                    onPress={() => toggleMember(friend.userId)}
                    disabled={creating || selectionBlocked}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected, disabled: creating || selectionBlocked }}
                    accessibilityLabel={`Add ${friend.displayName} to group`}
                  >
                    <Avatar uri={friend.avatarUrl} name={friend.displayName} size={40} />
                    <Text style={styles.friendName} numberOfLines={1}>{friend.displayName}</Text>
                    <Icon
                      name={selected ? 'check-circle' : 'checkbox-blank-circle-outline'}
                      size={22}
                      color={selected ? colors.actionPrimary : colors.textTertiary}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {createError ? <Text style={styles.createError}>{createError}</Text> : null}

            <TouchableOpacity
              style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
              onPress={() => void createGroup()}
              disabled={!canCreate}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canCreate, busy: creating }}
              accessibilityLabel="Create group"
            >
              {creating ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.createButtonText}>Create group</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfacePrimary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.actionBorderSoft,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    sectionHeaderCopy: { flex: 1, minWidth: 0 },
    sectionTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '800' },
    sectionBody: { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 17, marginTop: 2 },
    newGroupButton: {
      minHeight: 44,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.actionPrimary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    newGroupButtonText: { color: colors.onPrimary, fontSize: fontSize.xs, fontWeight: '800' },
    groupsList: { marginTop: spacing.md, gap: spacing.sm },
    groupRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    groupIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.actionSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.actionBorderSoft,
    },
    groupInfo: { flex: 1, minWidth: 0 },
    groupTitle: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '800' },
    groupMeta: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },
    groupPreview: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 3 },
    groupState: { alignItems: 'flex-end', gap: 6 },
    groupStateText: { color: colors.textTertiary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      backgroundColor: colors.actionPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadBadgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: '800' },
    emptyGroups: {
      marginTop: spacing.md,
      minHeight: 52,
      paddingHorizontal: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSecondary,
    },
    emptyGroupsText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 17 },
    inlineNotice: {
      marginTop: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    inlineNoticeText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.xs },
    loadingRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    loadingText: { color: colors.textSecondary, fontSize: fontSize.xs },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    modalCard: {
      maxHeight: '88%',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      backgroundColor: colors.canvas,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    modalHeaderCopy: { flex: 1, minWidth: 0 },
    modalTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '900' },
    modalSubtitle: { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 17, marginTop: 3 },
    closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    titleInput: {
      minHeight: 48,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
      color: colors.textPrimary,
      backgroundColor: colors.surfacePrimary,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      fontSize: fontSize.md,
    },
    selectionHeader: { marginTop: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectionTitle: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '800' },
    selectionCount: { color: colors.textTertiary, fontSize: fontSize.xs, fontWeight: '700' },
    friendScroller: { maxHeight: 360 },
    friendList: { gap: spacing.xs, paddingBottom: spacing.sm },
    friendRow: {
      minHeight: 56,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfacePrimary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    friendRowSelected: { backgroundColor: colors.actionSoft, borderColor: colors.actionBorderSoft },
    friendName: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
    noFriendsText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, paddingVertical: spacing.lg },
    createError: { color: colors.danger, fontSize: fontSize.xs, lineHeight: 17, marginTop: spacing.sm },
    createButton: {
      minHeight: 48,
      marginTop: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.actionPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createButtonDisabled: { opacity: 0.45 },
    createButtonText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '900' },
  });
}
