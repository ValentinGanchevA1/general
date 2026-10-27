import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { VerificationLevel } from '@g88/shared';
import { Avatar, type AvatarRing } from '@/components/Avatar';
import { VerificationBadge } from '@/components/VerificationBadge';
import { spacing, useAppTheme, type ThemeColors } from '@/theme';

export interface IdentityBlockProps {
  name: string;
  avatarUrl?: string | null;
  verification?: VerificationLevel;
  idVerified?: boolean;
  online?: boolean;
  /** Shown under name when set (e.g. "24 · Sofia, BG"). */
  subtitle?: string | null;
  /** Avatar ring style. Default brand when interactive. */
  ringVariant?: AvatarRing;
  size?: number;
  onPress?: () => void;
  /** Override default "Open profile for {name}" when interactive. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  layout?: 'row' | 'centered';
}

/** Shared identity row: avatar + name + verification + optional subtitle/online. */
export function IdentityBlock({
  name,
  avatarUrl,
  verification = 'none',
  idVerified = false,
  online,
  subtitle,
  ringVariant = 'brand',
  size = 56,
  onPress,
  accessibilityLabel,
  style,
  layout = 'row',
}: IdentityBlockProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const content = (
    <View style={[styles.row, layout === 'centered' && styles.centered, style]}>
      <Avatar uri={avatarUrl ?? null} name={name} size={size} ringVariant={ringVariant} online={online === true} />
      <View style={[styles.textCol, layout === 'centered' && styles.centeredText]}>
        <View style={[styles.nameRow, layout === 'centered' && styles.centeredNameRow]}>
          <Text style={[styles.name, layout === 'centered' && styles.centeredName]} numberOfLines={layout === 'centered' ? 2 : 1}>{name}</Text>
          <VerificationBadge verification={verification} idVerified={idVerified} size={16} />
        </View>
        {subtitle ? <Text style={[styles.subtitle, layout === 'centered' && styles.centeredSubtitle]} numberOfLines={layout === 'centered' ? 2 : 1}>{subtitle}</Text> : null}
        {online === true ? <Text style={styles.online}>Online</Text> : online === false ? <Text style={styles.offline}>Offline</Text> : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `Open profile for ${name}`}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    centered: { flexDirection: 'column', gap: spacing.sm },
    centeredText: { flex: 0, alignItems: 'center', alignSelf: 'stretch' },
    centeredNameRow: { justifyContent: 'center' },
    centeredName: { textAlign: 'center', fontSize: 22 },
    centeredSubtitle: { textAlign: 'center' },
    textCol: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', flexShrink: 1 },
    subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    online: { color: colors.success, fontSize: 12, marginTop: 2 },
    offline: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  });
}
