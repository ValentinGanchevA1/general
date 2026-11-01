import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { FriendCard, GroupConversationSummary } from '@g88/shared';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SkeletonListRow } from '@/components/Skeleton';
import { SoftErrorBanner } from '@/components/SoftErrorBanner';
import { createGroupClientRequestId } from '@/features/chat/groupClientRequestId';
import {
  clearGroupCreateError,
  createGroupConversation,
  fetchGroupConversations,
} from '@/features/chat/groupChatSlice';
import { fetchFriendsTab } from '@/features/friends/friendsSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';

const MIN_INVITEES = 2;
const MAX_INVITEES = 31;
const MAX_TITLE_LENGTH = 80;

function groupRoleLabel(group: GroupConversationSummary, userId: string): string {
  const role = group.members.find((member) => member.id === userId)?.role;
  if (role === 'owner') return 'You own this group';
  if (role === 'admin') return 'You are an admin';
  return 'You are a member';
}

function groupActivityLabel(group: GroupConversationSummary, userId: string): string {
  const last = group.lastMessage;
  if (last == null) return 'Messaging activation follows';
  const prefix = last.senderId === userId ? 'You: ' : '';
  return `${prefix}${last.body}`;
}

function GroupRow({
  group,
  userId,
}: {
  group: GroupConversationSummary;
  userId: string;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const memberCount = group.members.length;
  const unread = Math.max(0, group.unreadCount);

  return (
    <View
      style={styles.groupRow}
      accessible
      accessibilityLabel={`${group.title}, ${memberCount} members, ${groupRoleLabel(group, userId)}. Group messaging is not active on mobile yet.`}
    >
      <View style={styles.groupIcon}>
        <Icon name="account-group-outline" size={24} color={colors.actionPrimary} />
      </View>
      <View style={styles.groupInfo}>
        <View style={styles.groupTitleRow}>
          <Text style={styles.groupTitle} numberOfLines={1}>{group.title}</Text>
          {unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.groupMeta} numberOfLines={1}>
          {memberCount} member{memberCount === 1 ? '' : 's'} · {groupRoleLabel(group, userId)}
        </Text>
        <Text style={styles.groupPreview} numberOfLines={1}>{groupActivityLabel(group, userId)}</Text>
      </View>
      <View style={styles.lockedCapability} accessibilityLabel="Messaging activation follows">
        <Icon name="message-lock-outline" size={18} color={colors.textTertiary} />
      </View>
    </View>
  );
}

function FriendPickerRow({
  friend,
  selected,
  disabled,
  onToggle,
}: {
  friend: FriendCard;
  selected: boolean;
  disabled: boolean;
  onToggle: (userId: string) => void;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[styles.friendRow, disabled && !selected ? styles.friendRowDisabled : null]}
      onPress={() => onToggle(friend.userId)}
      disabled={disabled && !selected}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: disabled && !selected }}
      accessibilityLabel={`Invite ${friend.displayName}`}
    >
      <Avatar uri={friend.avatarUrl} name={friend.displayName} size={42} />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName} numberOfLines={1}>{friend.displayName}</Text>
        <Text style={styles.friendMeta}>
          {friend.online === true ? 'Online' : 'Close friend'}
        </Text>
      </View>
      <Icon
        name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
        size={24}
        color={selected ? colors.actionPrimary : colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

export function GroupConversationsScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id ?? '');
  const { groups, loading, error, creating, createError } = useAppSelector((state) => state.groupChat);
  const friends = useAppSelector((state) => state.friends.friends);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const requestIdRef = useRef<string | null>(null);

  const refreshGroups = useCallback((): void => {
    void dispatch(fetchGroupConversations());
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      refreshGroups();
    }, [refreshGroups]),
  );

  const openCreate = useCallback((): void => {
    dispatch(clearGroupCreateError());
    setTitle('');
    setSelectedIds([]);
    requestIdRef.current = createGroupClientRequestId();
    setCreateOpen(true);
    void dispatch(fetchFriendsTab({ tab: 'friends' }));
  }, [dispatch]);

  const closeCreate = useCallback((): void => {
    if (creating) return;
    setCreateOpen(false);
    requestIdRef.current = null;
    dispatch(clearGroupCreateError());
  }, [creating, dispatch]);

  const toggleMember = useCallback((memberId: string): void => {
    setSelectedIds((current) => {
      if (current.includes(memberId)) {
        return current.filter((id) => id !== memberId);
      }
      if (current.length >= MAX_INVITEES) return current;
      return [...current, memberId];
    });
  }, []);

  const trimmedTitle = title.trim();
  const canCreate =
    !creating &&
    trimmedTitle.length > 0 &&
    trimmedTitle.length <= MAX_TITLE_LENGTH &&
    selectedIds.length >= MIN_INVITEES &&
    selectedIds.length <= MAX_INVITEES;

  const submitCreate = useCallback(async (): Promise<void> => {
    if (!canCreate) return;
    const clientRequestId = requestIdRef.current;
    if (clientRequestId == null) return;

    const result = await dispatch(createGroupConversation({
      clientRequestId,
      title: trimmedTitle,
      memberIds: selectedIds,
    }));

    if (!createGroupConversation.fulfilled.match(result)) return;

    setCreateOpen(false);
    setTitle('');
    setSelectedIds([]);
    requestIdRef.current = null;
  }, [canCreate, dispatch, selectedIds, trimmedTitle]);

  const loadMoreFriends = useCallback((): void => {
    if (
      friends.nextCursor == null ||
      friends.loading ||
      friends.loadingMore ||
      selectedIds.length >= MAX_INVITEES
    ) {
      return;
    }
    void dispatch(fetchFriendsTab({ tab: 'friends', cursor: friends.nextCursor }));
  }, [dispatch, friends.loading, friends.loadingMore, friends.nextCursor, selectedIds.length]);

  const headerAction = (
    <TouchableOpacity
      style={styles.headerAction}
      onPress={openCreate}
      accessibilityRole="button"
      accessibilityLabel="Create group"
      hitSlop={8}
    >
      <Icon name="account-multiple-plus-outline" size={23} color={colors.actionPrimary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="Groups" right={headerAction} bordered />

      <View style={styles.infoCard}>
        <Icon name="shield-account-outline" size={22} color={colors.actionPrimary} />
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>Create with close friends</Text>
          <Text style={styles.infoBody}>
            Groups can be created and reviewed now. Realtime group messaging and live location are not active in this slice.
          </Text>
        </View>
      </View>

      {error != null && groups.length > 0 ? (
        <SoftErrorBanner
          message="Couldn't refresh groups — showing the last known list"
          onRetry={refreshGroups}
        />
      ) : null}

      {loading && groups.length === 0 ? (
        <View style={styles.list} accessibilityRole="progressbar" accessibilityLabel="Loading groups">
          <SkeletonListRow /><SkeletonListRow /><SkeletonListRow />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(group) => group.id}
          renderItem={({ item }) => <GroupRow group={item} userId={userId} />}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refreshGroups}
              tintColor={colors.actionPrimary}
              colors={[colors.actionPrimary]}
              progressBackgroundColor={colors.surfacePrimary}
            />
          }
          contentContainerStyle={groups.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            error != null ? (
              <EmptyState
                variant="plain"
                icon="cloud-alert-outline"
                title="Groups didn't refresh"
                body="Your memberships are unchanged. Try again."
                actionLabel="Retry"
                onAction={refreshGroups}
              />
            ) : (
              <EmptyState
                variant="plain"
                icon="account-group-outline"
                title="No groups yet"
                body="Create a private group with at least two close friends."
                actionLabel="Create group"
                onAction={openCreate}
              />
            )
          }
        />
      )}

      <Modal
        visible={createOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeCreate}
      >
        <View style={styles.modalRoot}>
          <ScreenHeader
            title="New group"
            onBack={closeCreate}
            right={
              <TouchableOpacity
                style={styles.createAction}
                onPress={() => void submitCreate()}
                disabled={!canCreate}
                accessibilityRole="button"
                accessibilityLabel="Create group"
                accessibilityState={{ disabled: !canCreate, busy: creating }}
              >
                {creating ? (
                  <ActivityIndicator size="small" color={colors.actionPrimary} />
                ) : (
                  <Text style={[styles.createActionText, !canCreate ? styles.createActionTextDisabled : null]}>
                    Create
                  </Text>
                )}
              </TouchableOpacity>
            }
            bordered
          />

          <View style={styles.draftHeader}>
            <Text style={styles.fieldLabel}>Group name</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={MAX_TITLE_LENGTH}
              editable={!creating}
              placeholder="Weekend crew"
              placeholderTextColor={colors.textTertiary}
              style={styles.titleInput}
              accessibilityLabel="Group name"
              autoCorrect
              returnKeyType="done"
            />
            <View style={styles.draftMetaRow}>
              <Text style={styles.helperText}>
                Select {MIN_INVITEES}–{MAX_INVITEES} close friends
              </Text>
              <Text style={styles.counterText}>{selectedIds.length}/{MAX_INVITEES}</Text>
            </View>
            {createError != null ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Icon name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{createError}</Text>
              </View>
            ) : null}
          </View>

          {friends.error != null && friends.items.length > 0 ? (
            <SoftErrorBanner
              message="Couldn't refresh friends — showing the last known list"
              onRetry={() => void dispatch(fetchFriendsTab({ tab: 'friends' }))}
            />
          ) : null}

          {friends.loading && friends.items.length === 0 ? (
            <View style={styles.list} accessibilityRole="progressbar" accessibilityLabel="Loading close friends">
              <SkeletonListRow /><SkeletonListRow /><SkeletonListRow />
            </View>
          ) : (
            <FlatList
              data={friends.items}
              keyExtractor={(friend) => friend.userId}
              renderItem={({ item }) => (
                <FriendPickerRow
                  friend={item}
                  selected={selectedIds.includes(item.userId)}
                  disabled={creating || selectedIds.length >= MAX_INVITEES}
                  onToggle={toggleMember}
                />
              )}
              onEndReached={loadMoreFriends}
              onEndReachedThreshold={0.4}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={friends.items.length === 0 ? styles.emptyContainer : styles.friendList}
              ListFooterComponent={friends.loadingMore ? (
                <ActivityIndicator style={styles.moreSpinner} color={colors.actionPrimary} />
              ) : null}
              ListEmptyComponent={
                friends.error != null ? (
                  <EmptyState
                    variant="plain"
                    icon="cloud-alert-outline"
                    title="Friends didn't refresh"
                    body="Close friends are required before a group can be created."
                    actionLabel="Retry"
                    onAction={() => void dispatch(fetchFriendsTab({ tab: 'friends' }))}
                  />
                ) : (
                  <EmptyState
                    variant="plain"
                    icon="account-multiple-outline"
                    title="Not enough close friends"
                    body="You need at least two close friends before creating a group."
                  />
                )
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    modalRoot: { flex: 1, backgroundColor: colors.canvas },
    headerAction: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoCard: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
      flexDirection: 'row',
      gap: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfacePrimary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.actionBorderSoft,
    },
    infoCopy: { flex: 1 },
    infoTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '800' },
    infoBody: { marginTop: 4, color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 18 },
    list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    friendList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    emptyContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
    groupRow: {
      minHeight: 78,
      marginBottom: spacing.sm,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfacePrimary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    groupIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.actionSoft,
    },
    groupInfo: { flex: 1, minWidth: 0 },
    groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    groupTitle: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '800' },
    groupMeta: { marginTop: 3, color: colors.textSecondary, fontSize: fontSize.sm },
    groupPreview: { marginTop: 3, color: colors.textTertiary, fontSize: fontSize.sm },
    lockedCapability: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.actionPrimary,
    },
    unreadBadgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800' },
    createAction: {
      minWidth: 56,
      minHeight: 44,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    createActionText: { color: colors.actionPrimary, fontSize: fontSize.md, fontWeight: '800' },
    createActionTextDisabled: { color: colors.textTertiary },
    draftHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
    fieldLabel: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '800' },
    titleInput: {
      minHeight: 48,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfacePrimary,
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
    draftMetaRow: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.md,
    },
    helperText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm },
    counterText: { color: colors.textTertiary, fontSize: fontSize.sm, fontWeight: '700' },
    errorBox: {
      marginTop: spacing.sm,
      padding: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfacePrimary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.danger,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: fontSize.sm, lineHeight: 18 },
    friendRow: {
      minHeight: 64,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSubtle,
    },
    friendRowDisabled: { opacity: 0.45 },
    friendInfo: { flex: 1, minWidth: 0 },
    friendName: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
    friendMeta: { marginTop: 2, color: colors.textSecondary, fontSize: fontSize.sm },
    moreSpinner: { marginVertical: spacing.md },
  });
}
