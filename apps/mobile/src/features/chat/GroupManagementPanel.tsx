import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type {
  GroupConversationMember,
  GroupConversationSummary,
} from '@g88/shared';
import { deleteJson, getJson } from '@/api/client';
import { Avatar } from '@/components/Avatar';
import { useAppSelector } from '@/hooks/redux';
import { appAlert } from '@/ui/appAlert';
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';
import { resolveGroupMemberAction } from './groupMemberActions';

interface GroupManagementPanelProps {
  active: boolean;
}

interface MutationError {
  groupId: string;
  message: string;
}

function roleLabel(role: GroupConversationMember['role']): string {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Member';
}

export function GroupManagementPanel({ active }: GroupManagementPanelProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const viewerId = useAppSelector((state) => state.auth.user?.id ?? null);
  const [groups, setGroups] = useState<GroupConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<MutationError | null>(null);

  const loadGroups = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await getJson<GroupConversationSummary[]>('/conversations/groups');
      setGroups(result);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const frame = requestAnimationFrame(() => {
      void loadGroups();
    });
    return () => cancelAnimationFrame(frame);
  }, [active, loadGroups]);

  const removeMember = useCallback(async (
    group: GroupConversationSummary,
    member: GroupConversationMember,
  ): Promise<void> => {
    if (viewerId == null) return;
    const key = `${group.id}:${member.id}`;
    if (pendingKey != null) return;

    setPendingKey(key);
    setMutationError(null);
    try {
      await deleteJson<void>(
        `/conversations/groups/${encodeURIComponent(group.id)}/members/${encodeURIComponent(member.id)}`,
      );

      if (member.id === viewerId) {
        setGroups((previous) => previous.filter((item) => item.id !== group.id));
        setExpandedGroupId((current) => current === group.id ? null : current);
      } else {
        setGroups((previous) => previous.map((item) => item.id === group.id
          ? { ...item, members: item.members.filter((itemMember) => itemMember.id !== member.id) }
          : item));
      }
    } catch {
      setMutationError({
        groupId: group.id,
        message: 'Could not update this group. Refresh and try again.',
      });
    } finally {
      setPendingKey(null);
    }
  }, [pendingKey, viewerId]);

  const confirmAction = useCallback((
    group: GroupConversationSummary,
    member: GroupConversationMember,
  ): void => {
    if (viewerId == null) return;
    const viewer = group.members.find((candidate) => candidate.id === viewerId);
    if (viewer == null) return;
    const action = resolveGroupMemberAction(viewerId, viewer.role, member.id, member.role);
    if (action == null) return;

    const selfLeave = action === 'leave';
    appAlert(
      selfLeave ? `Leave ${group.title}?` : `Remove ${member.displayName}?`,
      selfLeave
        ? 'You will stop receiving messages from this group. Rejoining requires a new invitation.'
        : `${member.displayName} will lose access to this group and its future messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: selfLeave ? 'Leave' : 'Remove',
          style: 'destructive',
          onPress: () => { void removeMember(group, member); },
        },
      ],
    );
  }, [removeMember, viewerId]);

  if (viewerId == null) {
    return (
      <View style={styles.notice}>
        <Text style={styles.noticeText}>Sign in again to manage group membership.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Manage groups</Text>
          <Text style={styles.body}>
            Leave a group or manage members according to your current role. Server authorization remains authoritative.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void loadGroups()}
          disabled={loading || pendingKey != null}
          accessibilityRole="button"
          accessibilityLabel="Refresh group membership"
          accessibilityState={{ busy: loading, disabled: loading || pendingKey != null }}
        >
          <Icon name="refresh" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingRow} accessibilityRole="progressbar" accessibilityLabel="Loading group membership">
          <ActivityIndicator color={colors.actionPrimary} />
          <Text style={styles.loadingText}>Loading groups…</Text>
        </View>
      ) : loadError ? (
        <TouchableOpacity
          style={styles.notice}
          onPress={() => void loadGroups()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading groups"
        >
          <Icon name="refresh" size={18} color={colors.textSecondary} />
          <Text style={styles.noticeText}>Group membership did not load. Tap to retry.</Text>
        </TouchableOpacity>
      ) : groups.length === 0 ? (
        <View style={styles.notice}>
          <Icon name="account-group-outline" size={18} color={colors.textTertiary} />
          <Text style={styles.noticeText}>You are not currently in any groups.</Text>
        </View>
      ) : (
        <View style={styles.groupList}>
          {groups.map((group) => {
            const viewer = group.members.find((member) => member.id === viewerId);
            const expanded = expandedGroupId === group.id;
            const error = mutationError?.groupId === group.id ? mutationError.message : null;

            return (
              <View key={group.id} style={styles.groupCard}>
                <TouchableOpacity
                  style={styles.groupHeader}
                  onPress={() => {
                    setMutationError(null);
                    setExpandedGroupId((current) => current === group.id ? null : group.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${expanded ? 'Collapse' : 'Manage'} ${group.title}`}
                  accessibilityState={{ expanded }}
                >
                  <View style={styles.groupIcon}>
                    <Icon name="account-group-outline" size={20} color={colors.actionPrimary} />
                  </View>
                  <View style={styles.groupCopy}>
                    <Text style={styles.groupTitle} numberOfLines={1}>{group.title}</Text>
                    <Text style={styles.groupMeta}>
                      {group.members.length} members{viewer ? ` · You are ${roleLabel(viewer.role).toLowerCase()}` : ''}
                    </Text>
                  </View>
                  <Icon
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={21}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {expanded ? (
                  <View style={styles.memberList}>
                    {group.members.map((member) => {
                      const action = viewer == null
                        ? null
                        : resolveGroupMemberAction(viewerId, viewer.role, member.id, member.role);
                      const key = `${group.id}:${member.id}`;
                      const pending = pendingKey === key;
                      const disabled = pendingKey != null;

                      return (
                        <View key={member.id} style={styles.memberRow}>
                          <Avatar uri={member.avatarUrl} name={member.displayName} size={38} />
                          <View style={styles.memberCopy}>
                            <Text style={styles.memberName} numberOfLines={1}>
                              {member.displayName}{member.id === viewerId ? ' · You' : ''}
                            </Text>
                            <Text style={styles.memberRole}>{roleLabel(member.role)}</Text>
                          </View>
                          {action != null ? (
                            <TouchableOpacity
                              style={[styles.memberAction, action === 'leave' && styles.leaveAction]}
                              onPress={() => confirmAction(group, member)}
                              disabled={disabled}
                              accessibilityRole="button"
                              accessibilityLabel={action === 'leave'
                                ? `Leave ${group.title}`
                                : `Remove ${member.displayName} from ${group.title}`}
                              accessibilityState={{ busy: pending, disabled }}
                            >
                              {pending ? (
                                <ActivityIndicator size="small" color={colors.danger} />
                              ) : (
                                <Icon
                                  name={action === 'leave' ? 'exit-to-app' : 'account-remove-outline'}
                                  size={18}
                                  color={colors.danger}
                                />
                              )}
                              <Text style={styles.memberActionText}>
                                {action === 'leave' ? 'Leave' : 'Remove'}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      );
                    })}

                    {error ? (
                      <View style={styles.errorRow} accessibilityRole="alert">
                        <Icon name="alert-circle-outline" size={17} color={colors.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.xs,
      marginBottom: spacing.xl,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfacePrimary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerCopy: { flex: 1, minWidth: 0 },
    title: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '900' },
    body: { marginTop: 3, color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 17 },
    refreshButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    loadingRow: {
      minHeight: 60,
      marginTop: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    loadingText: { color: colors.textSecondary, fontSize: fontSize.sm },
    notice: {
      minHeight: 52,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceRaised,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    noticeText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 18 },
    groupList: { marginTop: spacing.md, gap: spacing.sm },
    groupCard: {
      borderRadius: radius.md,
      backgroundColor: colors.surfaceRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      overflow: 'hidden',
    },
    groupHeader: {
      minHeight: 64,
      paddingHorizontal: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    groupIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.actionGhost,
    },
    groupCopy: { flex: 1, minWidth: 0 },
    groupTitle: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '800' },
    groupMeta: { marginTop: 2, color: colors.textTertiary, fontSize: fontSize.xs },
    memberList: {
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSubtle,
    },
    memberRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSubtle,
    },
    memberCopy: { flex: 1, minWidth: 0 },
    memberName: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
    memberRole: { marginTop: 2, color: colors.textTertiary, fontSize: fontSize.xs },
    memberAction: {
      minHeight: 44,
      minWidth: 94,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.danger,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    leaveAction: { backgroundColor: colors.dangerSurface },
    memberActionText: { color: colors.danger, fontSize: fontSize.xs, fontWeight: '800' },
    errorRow: {
      marginTop: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.dangerSurface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: fontSize.xs, lineHeight: 17 },
  });
}
