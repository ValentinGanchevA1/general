import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { IdVerificationStatus, UserProfile } from '@g88/shared';
import { colors, fontSize, radius, spacing } from '@/theme';

export type VerificationItemId = 'email' | 'phone' | 'id';

export interface VerificationItem {
  id: VerificationItemId;
  title: string;
  detail: string;
  status: 'success' | 'pending' | 'missing' | 'error';
  statusLabel: string;
}

function idMeta(status: IdVerificationStatus | undefined): {
  status: VerificationItem['status'];
  statusLabel: string;
  detail: string;
} {
  switch (status) {
    case 'verified':
      return { status: 'success', statusLabel: 'Verified', detail: 'Government ID approved' };
    case 'pending':
      return { status: 'pending', statusLabel: 'Under review', detail: 'Usually finishes within 24h' };
    case 'rejected':
      return { status: 'error', statusLabel: 'Rejected', detail: 'Resubmit a clearer ID photo' };
    default:
      return { status: 'missing', statusLabel: 'Not started', detail: 'Unlock higher trust' };
  }
}

/** Build sheet rows from the owner profile. */
export function buildVerificationItems(profile: UserProfile | null | undefined): VerificationItem[] {
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
        ? profile.phone ?? 'Verified'
        : profile.phone
          ? `${profile.phone} · not verified`
          : 'Add and verify your phone',
      status: phoneOk ? 'success' : 'missing',
      statusLabel: phoneOk ? 'Verified' : 'Not verified',
    },
    {
      id: 'id',
      title: 'ID verification',
      detail: id.detail,
      status: id.status,
      statusLabel: id.statusLabel,
    },
  ];
}

const STATUS_COLOR: Record<VerificationItem['status'], string> = {
  success: colors.success,
  pending: colors.warning,
  error: colors.danger,
  missing: colors.textMuted,
};

const STATUS_ICON: Record<VerificationItem['status'], string> = {
  success: 'check-circle',
  pending: 'clock-outline',
  error: 'alert-circle',
  missing: 'circle-outline',
};

interface VerificationStatusSheetProps {
  score: number;
  items: VerificationItem[];
  onItemPress: (id: VerificationItemId) => void;
}

export function VerificationStatusSheet({
  score,
  items,
  onItemPress,
}: VerificationStatusSheetProps): React.JSX.Element {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Verification</Text>
      <Text style={styles.subtitle}>
        {score}% trust · complete steps to unlock more reach
      </Text>

      <View style={styles.list}>
        {items.map((item) => {
          const color = STATUS_COLOR[item.status];
          return (
            <Pressable
              key={item.id}
              onPress={() => onItemPress(item.id)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.statusLabel}`}
            >
              <Icon name={STATUS_ICON[item.status]} size={22} color={color} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowDetail} numberOfLines={2}>
                  {item.detail}
                </Text>
              </View>
              <View style={styles.rowTrailing}>
                <Text style={[styles.statusLabel, { color }]}>{item.statusLabel}</Text>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
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
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  rowDetail: {
    color: colors.textSecondary,
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
