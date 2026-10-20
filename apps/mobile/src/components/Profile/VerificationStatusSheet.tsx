import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { IdVerificationStatus, UserProfile } from '@g88/shared';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

export type VerificationItemId = 'email' | 'phone' | 'id' | 'social';

export interface VerificationItem {
  id: VerificationItemId;
  title: string;
  detail: string;
  status: 'success' | 'pending' | 'missing' | 'error';
  statusLabel: string;
  optional?: boolean;
}

function idMeta(status: IdVerificationStatus | undefined): {
  status: VerificationItem['status'];
  statusLabel: string;
  detail: string;
} {
  switch (status) {
    case 'verified':
      return {
        status: 'success',
        statusLabel: 'Verified',
        detail: 'Government ID approved',
      };
    case 'pending':
      return {
        status: 'pending',
        statusLabel: 'Under review',
        detail: 'Identity review is in progress',
      };
    case 'rejected':
      return {
        status: 'error',
        statusLabel: 'Needs attention',
        detail: 'Review the requirements and submit again',
      };
    default:
      return {
        status: 'missing',
        statusLabel: 'Not started',
        detail: 'Verify your identity with a government ID',
      };
  }
}

/** Build owner-only verification rows without exposing a public numeric trust score. */
export function buildVerificationItems(
  profile: UserProfile | null | undefined,
): VerificationItem[] {
  if (!profile) return [];

  const badges = profile.badges ?? {
    email: false,
    phone: false,
    photo: false,
    id: false,
    social: false,
    premium: false,
    verified: false,
  };

  const emailOk = badges.email === true;
  const phoneOk = badges.phone === true;
  const id = idMeta(profile.idVerificationStatus);
  const socialCount = profile.socialLinks?.length ?? 0;
  const socialOk = badges.social === true || socialCount > 0;

  return [
    {
      id: 'email',
      title: 'Email',
      detail: emailOk
        ? profile.email
        : profile.email
          ? `${profile.email} · not verified`
          : 'Add and verify your email',
      status: emailOk ? 'success' : 'missing',
      statusLabel: emailOk ? 'Verified' : 'Not verified',
    },
    {
      id: 'phone',
      title: 'Phone',
      detail: phoneOk
        ? profile.phone ?? 'Verified phone'
        : profile.phone
          ? `${profile.phone} · not verified`
          : 'Add and verify your phone',
      status: phoneOk ? 'success' : 'missing',
      statusLabel: phoneOk ? 'Verified' : 'Not verified',
    },
    {
      id: 'id',
      title: 'Government ID',
      detail: id.detail,
      status: id.status,
      statusLabel: id.statusLabel,
    },
    {
      id: 'social',
      title: 'Connected profiles',
      detail: socialOk
        ? `${Math.max(1, socialCount)} supporting profile${Math.max(1, socialCount) === 1 ? '' : 's'} connected`
        : 'Optional supporting identity signal',
      status: socialOk ? 'success' : 'missing',
      statusLabel: socialOk ? 'Connected' : 'Optional',
      optional: true,
    },
  ];
}

interface VerificationStatusSheetProps {
  items: VerificationItem[];
  onItemPress: (id: VerificationItemId) => void;
  levelLabel?: string;
  /** @deprecated Kept only for source compatibility. Numeric trust is intentionally not rendered. */
  score?: number;
}

export function VerificationStatusSheet({
  items,
  onItemPress,
  levelLabel,
}: VerificationStatusSheetProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const statusColor: Record<VerificationItem['status'], string> = {
    success: colors.verified,
    pending: colors.warning,
    error: colors.danger,
    missing: colors.textTertiary,
  };
  const statusIcon: Record<VerificationItem['status'], string> = {
    success: 'check-circle',
    pending: 'clock-outline',
    error: 'alert-circle',
    missing: 'circle-outline',
  };

  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Verification</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}> 
        {levelLabel
          ? `${levelLabel} · review the identity signals attached to your profile.`
          : 'Review the identity signals attached to your profile.'}
      </Text>

      <View style={styles.list}>
        {items.map((item) => {
          const color = statusColor[item.status];
          return (
            <Pressable
              key={item.id}
              onPress={() => onItemPress(item.id)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.borderSubtle,
                },
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.statusLabel}`}
            >
              <Icon name={statusIcon[item.status]} size={22} color={color} />
              <View style={styles.rowBody}>
                <View style={styles.titleRow}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                    {item.title}
                  </Text>
                  {item.optional ? (
                    <Text style={[styles.optional, { color: colors.textTertiary }]}>Optional</Text>
                  ) : null}
                </View>
                <Text
                  style={[styles.rowDetail, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {item.detail}
                </Text>
              </View>
              <View style={styles.rowTrailing}>
                <Text style={[styles.statusLabel, { color }]}>{item.statusLabel}</Text>
                <Icon name="chevron-right" size={18} color={colors.textTertiary} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.xs,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    opacity: 0.78,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  optional: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowDetail: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
