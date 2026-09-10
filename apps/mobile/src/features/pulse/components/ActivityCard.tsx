// apps/mobile/src/features/pulse/components/ActivityCard.tsx
//
// Single row in the Pulse feed — Nextdoor-style card with type-coloured left
// border, avatar, timestamp, distance pill, title + preview.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import type { ActivityItem, ActivityType } from '@g88/shared';
import { colors } from '@/theme';

const BORDER_BY_TYPE: Record<ActivityType, string> = {
  chat: colors.primary,
  wave: colors.entityUser,
  listing: colors.entityListing,
  alert: colors.entityEvent,
  match: colors.entityUser,
};

const ICON_BY_TYPE: Record<ActivityType, string> = {
  chat: 'message-text',
  wave: 'hand-wave',
  listing: 'tag',
  alert: 'bullhorn',
  match: 'heart',
};

interface Props {
  item: ActivityItem;
  onPress: () => void;
}

export function ActivityCard({ item, onPress }: Props): React.JSX.Element {
  const initials = (item.actorName ?? '?')
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const distance = item.distanceM != null ? formatDistance(item.distanceM) : null;

  return (
    <Pressable
      style={({ pressed }) => [
        S.card,
        { borderLeftColor: BORDER_BY_TYPE[item.type] },
        pressed && S.cardPressed,
      ]}
      onPress={onPress}
      testID={`activity-card-${item.id}`}
    >
      <View style={S.header}>
        {item.unread && <View style={S.unreadDot} />}
        <View style={S.avatar}>
          <Text style={S.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[S.author, item.unread && S.authorUnread]} numberOfLines={1}>
            {item.actorName ?? 'Someone'}
          </Text>
          <View style={S.meta}>
            <Text style={S.metaText}>{relTime(item.createdAt)}</Text>
            {distance && (
              <View style={S.distancePill}>
                <Text style={S.distanceText}>{distance}</Text>
              </View>
            )}
          </View>
        </View>
        <MCI name={ICON_BY_TYPE[item.type]} size={18} color={colors.textFaint} />
      </View>

      <Text style={S.title} numberOfLines={1}>
        {item.title}
      </Text>
      {!!item.preview && (
        <Text style={S.preview} numberOfLines={2}>
          {item.preview}
        </Text>
      )}
    </Pressable>
  );
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const S = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  cardPressed: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  author: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  authorUnread: { color: colors.textPrimary, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  metaText: { color: colors.textFaint, fontSize: 11 },
  distancePill: {
    backgroundColor: colors.bg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  distanceText: { color: colors.primary, fontSize: 10, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  preview: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
});
