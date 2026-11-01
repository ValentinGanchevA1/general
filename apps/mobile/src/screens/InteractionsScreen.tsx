import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { GroupChatsPanel } from '@/features/chat/GroupChatsPanel';
import { GroupManagementPanel } from '@/features/chat/GroupManagementPanel';
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';
import { InteractionsScreen as ConnectionsBaseScreen } from './InteractionsScreenBase';

type GroupsMode = 'chats' | 'manage';

export function InteractionsScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [groupsMode, setGroupsMode] = useState<GroupsMode>('chats');

  const closeGroups = (): void => {
    setGroupsOpen(false);
    setGroupsMode('chats');
  };

  const managementMode = groupsMode === 'manage';

  return (
    <View style={styles.root}>
      <ConnectionsBaseScreen />
      <TouchableOpacity
        style={styles.groupsButton}
        onPress={() => {
          setGroupsMode('chats');
          setGroupsOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Open group chats"
      >
        <Icon name="account-group-outline" size={18} color={colors.onPrimary} />
        <Text style={styles.groupsButtonText}>Groups</Text>
      </TouchableOpacity>

      <Modal
        visible={groupsOpen}
        transparent
        animationType="slide"
        onRequestClose={closeGroups}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetTitle}>
                  {managementMode ? 'Manage groups' : 'Group chats'}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {managementMode
                    ? 'Leave groups or manage members according to your role.'
                    : 'Private groups built on the normalized membership model.'}
                </Text>
              </View>
              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={[styles.headerAction, managementMode && styles.headerActionActive]}
                  onPress={() => setGroupsMode(managementMode ? 'chats' : 'manage')}
                  accessibilityRole="button"
                  accessibilityLabel={managementMode ? 'Back to group chats' : 'Manage group membership'}
                  accessibilityState={{ selected: managementMode }}
                >
                  <Icon
                    name={managementMode ? 'message-text-outline' : 'account-cog-outline'}
                    size={20}
                    color={managementMode ? colors.actionPrimary : colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeGroups}
                  accessibilityRole="button"
                  accessibilityLabel="Close groups"
                >
                  <Icon name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              {managementMode ? (
                <GroupManagementPanel active={groupsOpen} />
              ) : (
                <GroupChatsPanel />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, position: 'relative' },
    groupsButton: {
      position: 'absolute',
      right: spacing.lg,
      bottom: 18,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.actionPrimary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.actionBorderSoft,
    },
    groupsButtonText: { color: colors.onPrimary, fontSize: fontSize.xs, fontWeight: '900' },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.58)',
    },
    sheet: {
      maxHeight: '88%',
      paddingTop: spacing.md,
      backgroundColor: colors.canvas,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    sheetHeader: {
      minHeight: 56,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    sheetHeaderCopy: { flex: 1, minWidth: 0 },
    sheetTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '900' },
    sheetSubtitle: { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 17, marginTop: 2 },
    sheetActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    headerAction: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    headerActionActive: {
      backgroundColor: colors.actionGhost,
      borderColor: colors.actionBorderSoft,
    },
    closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    sheetContent: { paddingBottom: spacing.xl },
  });
}
