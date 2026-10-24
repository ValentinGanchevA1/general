import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { fontSize, radius, spacing, useAppTheme } from '@/theme';
import {
  resolveNexaSpatialSheetVisual,
  type NexaSpatialSheetKind,
} from './nexaSpatialSheet';

export interface NexaSpatialMetaItem {
  id: string;
  label: string;
  icon?: string;
  emphasis?: boolean;
}

export interface NexaSpatialSheetScaffoldProps {
  kind: NexaSpatialSheetKind;
  title?: string;
  subtitle?: string | null;
  meta?: NexaSpatialMetaItem[];
  header?: ReactNode;
  headerTrailing?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
}

export interface NexaSpatialActionButtonProps {
  label: string;
  onPress: () => void;
  kind?: NexaSpatialSheetKind;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  flex?: boolean;
}

function entityTone(
  kind: NexaSpatialSheetKind,
  colors: ReturnType<typeof useAppTheme>['colors'],
): string {
  switch (kind) {
    case 'person':
      return colors.entityPerson;
    case 'event':
      return colors.entityEvent;
    case 'listing':
      return colors.entityListing;
    case 'opportunity':
      return colors.entityOpportunity;
  }
}

export function NexaSpatialSheetGlyph({
  kind,
  size = 36,
}: {
  kind: NexaSpatialSheetKind;
  size?: number;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const visual = resolveNexaSpatialSheetVisual(kind);
  const tone = entityTone(kind, colors);
  const diamondSide = Math.round(size * 0.72);

  const base: ViewStyle = {
    width: size,
    height: size,
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (visual.shape === 'star') {
    return (
      <View style={base} accessible={false}>
        <Icon name="star-four-points" size={size} color={colors.entityEvent} />
        <View style={styles.starInner} pointerEvents="none">
          <Icon name="star-four-points" size={Math.max(14, size - 8)} color={tone} />
        </View>
      </View>
    );
  }

  if (visual.shape === 'diamond') {
    return (
      <View style={base} accessible={false}>
        <View
          style={[
            styles.glyphCore,
            {
              width: diamondSide,
              height: diamondSide,
              borderRadius: Math.max(3, Math.round(diamondSide * 0.15)),
              borderColor: tone,
              backgroundColor: colors.actionSoft,
              transform: [{ rotate: '45deg' }],
            },
          ]}
        />
      </View>
    );
  }

  if (visual.shape === 'square') {
    const side = Math.round(size * 0.78);
    return (
      <View style={base} accessible={false}>
        <View
          style={[
            styles.glyphCore,
            {
              width: side,
              height: side,
              borderRadius: Math.max(4, Math.round(side * 0.14)),
              borderColor: tone,
              backgroundColor: colors.surfacePrimary,
            },
          ]}
        >
          <Icon name="tag-outline" size={14} color={tone} />
        </View>
      </View>
    );
  }

  return (
    <View style={base} accessible={false}>
      <View
        style={[
          styles.glyphCore,
          {
            width: size - 6,
            height: size - 6,
            borderRadius: (size - 6) / 2,
            borderColor: tone,
            backgroundColor: colors.actionSoft,
          },
        ]}
      >
        <Icon name="account" size={15} color={tone} />
      </View>
    </View>
  );
}

export function NexaSpatialKindHeader({
  kind,
  trailing,
}: {
  kind: NexaSpatialSheetKind;
  trailing?: ReactNode;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const visual = resolveNexaSpatialSheetVisual(kind);
  const tone = entityTone(kind, colors);

  return (
    <View style={styles.kindHeader}>
      <View style={styles.kindIdentity}>
        <NexaSpatialSheetGlyph kind={kind} size={34} />
        <View>
          <Text style={[styles.kindEyebrow, { color: tone }]}>{visual.label.toUpperCase()}</Text>
          <Text style={[styles.kindHint, { color: colors.textTertiary }]}>Nearby discovery</Text>
        </View>
      </View>
      {trailing}
    </View>
  );
}

export function NexaSpatialMetaRow({ items }: { items: NexaSpatialMetaItem[] }): React.JSX.Element | null {
  const { colors } = useAppTheme();
  if (items.length === 0) return null;

  return (
    <View style={styles.metaRow}>
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 ? (
            <Text style={[styles.metaDot, { color: colors.textDisabled }]}>·</Text>
          ) : null}
          <View style={styles.metaItem}>
            {item.icon ? (
              <Icon
                name={item.icon}
                size={13}
                color={item.emphasis ? colors.discovery : colors.textTertiary}
              />
            ) : null}
            <Text
              style={[
                styles.metaText,
                { color: item.emphasis ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              {item.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

export function NexaSpatialActionBar({ children }: { children: ReactNode }): React.JSX.Element {
  return <View style={styles.actionBar}>{children}</View>;
}

export function NexaSpatialActionButton({
  label,
  onPress,
  kind = 'person',
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  accessibilityLabel,
  testID,
  flex = false,
}: NexaSpatialActionButtonProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const tone = entityTone(kind, colors);

  const backgroundColor =
    variant === 'primary'
      ? kind === 'listing'
        ? colors.actionPrimary
        : tone
      : variant === 'danger'
        ? colors.dangerSurface
        : variant === 'secondary'
          ? colors.surfaceTertiary
          : 'transparent';
  const borderColor =
    variant === 'primary'
      ? backgroundColor
      : variant === 'danger'
        ? colors.dangerBorder
        : variant === 'secondary'
          ? colors.borderDefault
          : 'transparent';
  const textColor =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'danger'
        ? colors.danger
        : variant === 'quiet'
          ? tone
          : colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.actionButton,
        flex && styles.actionFlex,
        { backgroundColor, borderColor },
        pressed && !disabled && !loading ? styles.actionPressed : null,
        disabled || loading ? styles.actionDisabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={17} color={textColor} /> : null}
          <Text style={[styles.actionText, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function NexaSpatialSheetScaffold({
  kind,
  title,
  subtitle,
  meta = [],
  header,
  headerTrailing,
  children,
  actions,
  accessibilityLabel,
  testID,
}: NexaSpatialSheetScaffoldProps): React.JSX.Element {
  const { colors } = useAppTheme();

  return (
    <View
      style={styles.sheet}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel ?? title ?? `${kind} details`}
      testID={testID}
    >
      <NexaSpatialKindHeader kind={kind} trailing={headerTrailing} />
      {header ??
        (title ? (
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={3}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null)}
      <NexaSpatialMetaRow items={meta} />
      {children}
      {actions ? <View style={styles.actionsSlot}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  kindHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  kindIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  kindEyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  kindHint: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    marginTop: 1,
  },
  glyphCore: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    gap: 5,
  },
  title: {
    fontSize: fontSize.lg,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  metaRow: {
    minHeight: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  metaDot: {
    fontSize: 12,
  },
  actionsSlot: {
    marginTop: 2,
  },
  actionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    minHeight: 46,
    minWidth: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionFlex: {
    flexGrow: 1,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  actionDisabled: {
    opacity: 0.48,
  },
});
