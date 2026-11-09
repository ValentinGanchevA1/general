import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { ContentReportTarget } from '@g88/shared';
import { useAppDispatch } from '@/hooks/redux';
import { useAppTheme } from '@/theme';
import { showContentReportPrompt } from './reportPrompt';

interface Props {
  targetType: ContentReportTarget;
  targetId: string;
  label?: string;
}

/** Authenticated, persisted report action. Never reports the profile by implication. */
export function ReportContentButton({ targetType, targetId, label = 'Report' }: Props): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Report ${targetType.replace('_', ' ')}`}
      onPress={() => showContentReportPrompt(dispatch, targetType, targetId)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 10 }}
      hitSlop={8}
    >
      <Icon name="flag-outline" size={18} color={colors.danger} />
      <Text style={{ fontSize: 12, color: colors.danger, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}
