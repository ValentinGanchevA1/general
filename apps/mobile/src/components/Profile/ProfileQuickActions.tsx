import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, radius } from '@/theme';

interface Props {
  onEdit: () => void;
  onPhotos: () => void;
  onTrust: () => void;
}

export function ProfileQuickActions({ onEdit, onPhotos, onTrust }: Props): React.JSX.Element {
  return (
    <View style={styles.actionsRow}>
      <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
        <Icon name="pencil" size={18} color={colors.textPrimary} />
        <Text style={styles.actionButtonText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButton} onPress={onPhotos}>
        <Icon name="image-multiple" size={18} color={colors.textPrimary} />
        <Text style={styles.actionButtonText}>Photos</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButton} onPress={onTrust}>
        <Icon name="shield-check" size={18} color={colors.textPrimary} />
        <Text style={styles.actionButtonText}>Trust</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceRaised,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  actionButtonText: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
});
