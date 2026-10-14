// apps/mobile/src/features/pulse/components/ActivityCard.tsx
//
// Pulse feed row — matches screenshot: avatar, title, meta, type CTA on right
// (Wave back / Message / View).

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import type { ActivityItem, ActivityType } from '@g88/shared';
import { colors, spacing, useAppTheme } from '@/theme';

const ICON_BY_TYPE: Record<ActivityType, string> = {
  chat: 'message-text-outline',
  wave: 'hand-wave',
  listing: 'tag-outline',
  alert: 'calendar-clock',
  match: 'heart',
};

const ACCENT_BY_TYPE: Record<ActivityType, string> = {
  chat: colors.primary,
  wave: colors.primary,
  listing: colors.action,
  alert: colors.action,
  match: colors.danger,
};

interface Props {
  item: ActivityItem;
  onPress: () => void;
  busy?: boolean;
  onWaveBack?: () => void;
  onMessage?: () => void;
  onView?: () => void;
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function resolveCta(
  item: ActivityItem,
  handlers: {
    onWaveBack?: () => void;
    onMessage?: () => void;
    onView?: () => void;
  },
): { label: string; onPress: () => void; tone: 'wave' | 'message' | 'view' } | null {
  if (item.type === 'wave' && handlers.onWaveBack) {
    return { label: 'Wave back', onPress: handlers.onWaveBack, tone: 'wave' };
  }
  if ((item.type === 'match' || item.type === 'chat') && handlers.onMessage) {
    return { label: 'Message', onPress: handlers.onMessage, tone: 'message' };
  }
  if ((item.type === 'listing' || item.type === 'alert') && handlers.onView) {
    return { label: 'View', onPress: handlers.onView, tone: 'view' };
  }
  return null;
}

export function ActivityCard({
  item,
  onPress,
  busy,
  onWaveBack,
  onMessage,
  onView,
}: Props): React.JSX.Element {
  const { colors: themeColors } = useAppTheme();

  const initials = (item.actorName ?? '?')
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const distance =
    item.distanceM != null ? formatDistance(item.distanceM) : null;
  const metaParts = [relTime(item.createdAt), distance].filter(Boolean);
  const meta = metaParts.join(' · ');

  const handlers: {
    onWaveBack?: () => void;
    onMessage?: () => void;
    onView?: () => void;
  } = {};
  if (onWaveBack) handlers.onWaveBack = onWaveBack;
  if (onMessage) handlers.onMessage = onMessage;
  if (onView) handlers.onView = onView;
  const cta = resolveCta(item, handlers);

  return (
    <Pressable
      style={({ pressed }) => [
        S.card,
        { backgroundColor: themeColors.surfaceAlt },
        pressed && S.cardPressed,
      ]}
      onPress={onPress}
      testID={`activity-card-${item.id}`}
    >
      <View style={S.row}>
        <View style={[S.avatar, { borderColor: ACCENT_BY_TYPE[item.type] }]}>
          {item.type === 'match' ? (
            <MCI name="heart" size={18} color={colors.danger} />
          ) : (
            <Text style={S.avatarText}>{initials}</Text>
          )}
        </View>

        <View style={S.body}>
          <Text
            style={[S.title, item.unread && S.titleUnread]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {!!item.preview && (
            <Text style={S.preview} numberOfLines={1}>
              {item.preview}
            </Text>
          )}
          {!!meta && <Text style={S.meta}>{meta}</Text>}
        </View>

        {cta ? (
          <Pressable
            style={[S.cta, cta.tone === 'wave' && S.ctaWave, cta.tone === 'message' && S.ctaMessage]}
            onPress={(e) => {
              e.stopPropagation?.();
              if (!busy) cta.onPress();
            }}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityLabel={cta.label}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text
                style={[
                  S.ctaText,
                  cta.tone === 'wave' && S.ctaTextWave,
                  cta.tone === 'view' && S.ctaTextView,
                ]}
              >
                {cta.label}
              </Text>
            )}
          </Pressable>
        ) : (
          <MCI name="chevron-right" size={20} color={colors.textMuted} />
        )}
      </View>
    </Pressable>
  );
}

const S = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  cardPressed: { opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  body: { flex: 1, minWidth: 0 },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  titleUnread: { fontWeight: '700' },
  preview: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  cta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 36,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.action,
  },
  ctaWave: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  ctaMessage: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  ctaText: { fontSize: 13, fontWeight: '700', color: colors.onPrimary },
  ctaTextWave: { color: colors.onPrimary },
  ctaTextView: { color: colors.primary },
});
