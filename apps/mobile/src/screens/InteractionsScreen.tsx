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
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';
import { InteractionsScreen as ConnectionsBaseScreen } from './InteractionsScreenBase';

export function InteractionsScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [groupsOpen, setGroupsOpen] = useState(false);

  return (
    <View style={styles.root}>
      <ConnectionsBaseScreen />
      <TouchableOpacity
        style={styles.groupsButton}
        onPress={() => setGroupsOpen(true)}
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
        onRequestClose={() => setGroupsOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetTitle}>Group chats</Text>
                <Text style={styles.sheetSubtitle}>Private groups built on the new normalized membership model.</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setGroupsOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close group chats"
              >
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <GroupChatsPanel />
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
    closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    sheetContent: { paddingBottom: spacing.xl },
  });
}
