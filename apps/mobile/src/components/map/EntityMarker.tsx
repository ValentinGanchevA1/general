import React, { useState } from 'react';
import { useCachedImageUri } from '@/hooks/useCachedImageUri';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { EntityPoint } from '@g88/shared';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors } from '@/theme';

import { entityVisualKey } from './markerVisualKeys';

const KIND_COLOR: Record<EntityPoint['kind'], string> = {
  user: colors.entityUser,
  event: colors.entityEvent,
  listing: colors.entityListing,
};

const KIND_ICON: Record<EntityPoint['kind'], string> = {
  user: '👤',
  event: '📅',
  listing: '🛍',
};

const MARKER_SIZE = 40;

/** Soft friend-pin fill derived from entityFriend (no hard-coded cyan). */
const FRIEND_BUBBLE_BG = 'rgba(46,230,197,0.12)';

interface Props {
  point: EntityPoint;
  onVisualSettled?: () => void;
}

function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Compact event time for pin badge — Today / Tomorrow / weekday + HH:mm. */
function formatEventBadge(startsAt: string): string {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return 'Event';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEvent = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startOfEvent.getTime() - startOfToday.getTime()) / 86_400_000,
  );
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;
  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Tmrw ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    const wd = d.toLocaleDateString(undefined, { weekday: 'short' });
    return `${wd} ${time}`;
  }
  const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${md}`;
}

/** Compact listing price for pin badge. EUR-first (product default). */
function formatListingBadge(
  priceCents: number,
  currency: string,
  mode: string | undefined,
): string {
  if (mode === 'buy') return 'Wanted';
  const code = (currency || 'EUR').toUpperCase();
  const amount = priceCents / 100;
  if (code === 'EUR') {
    if (amount >= 1000) return `€${Math.round(amount / 100) / 10}k`;
    if (Number.isInteger(amount)) return `€${amount}`;
    return `€${amount.toFixed(2)}`;
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${code} ${amount}`;
  }
}

function EntityMarkerImpl({ point, onVisualSettled }: Props): React.JSX.Element {
  const isFriend = point.kind === 'user' && point.meta.isFriend === true;
  const isBuyListing = point.kind === 'listing' && point.meta.mode === 'buy';
  const color = isFriend
    ? colors.entityFriend
    : isBuyListing
      ? colors.entityWanted
      : KIND_COLOR[point.kind];

  const label =
    point.kind === 'user'
      ? point.meta.displayName.slice(0, 8)
      : point.meta.title.slice(0, 10);

  const badge =
    point.kind === 'event'
      ? formatEventBadge(point.meta.startsAt)
      : point.kind === 'listing'
        ? formatListingBadge(
            point.meta.priceCents,
            point.meta.currency,
            point.meta.mode,
          )
        : null;

  const isVerified =
    point.kind === 'user' &&
    (point.meta.verifiedBadge === true || point.meta.verification === 'id');
  /** Backend already gates online via friendship + friends_see_online_status. */
  const isOnline = point.kind === 'user' && point.meta.online === true;

  const remoteAvatar = point.kind === 'user' ? point.meta.avatarUrl : null;
  const cachedAvatar = useCachedImageUri(remoteAvatar);
  const coverUri = point.kind === 'event' ? point.meta.coverUrl : null;
  const thumbUri = point.kind === 'listing' ? point.meta.thumbnailUrl : null;
  const cachedCover = useCachedImageUri(coverUri);
  const cachedThumb = useCachedImageUri(thumbUri);
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(cachedAvatar) && !imgFailed;

  const settle = (): void => {
    onVisualSettled?.();
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.bubble, { borderColor: color }, isFriend && styles.friendBubble]}>
        {point.kind === 'user' && showPhoto ? (
          <Image
            key={cachedAvatar ?? 'none'}
            source={{ uri: cachedAvatar as string }}
            style={styles.photo}
            onLoad={settle}
            onError={() => {
              setImgFailed(true);
              settle();
            }}
            accessibilityLabel={`${point.meta.displayName} avatar`}
          />
        ) : point.kind === 'user' ? (
          <Text style={[styles.initials, { color }]} onLayout={settle}>
            {initialsFromName(point.meta.displayName) || '?'}
          </Text>
        ) : point.kind === 'event' && cachedCover ? (
          <Image
            key={cachedCover}
            source={{ uri: cachedCover }}
            style={styles.photo}
            onLoad={settle}
            onError={settle}
          />
        ) : point.kind === 'listing' && cachedThumb ? (
          <Image
            key={cachedThumb}
            source={{ uri: cachedThumb }}
            style={styles.photo}
            onLoad={settle}
            onError={settle}
          />
        ) : (
          <Text style={styles.icon} onLayout={settle}>
            {isBuyListing ? '🔍' : KIND_ICON[point.kind]}
          </Text>
        )}
        {isVerified ? (
          <View style={styles.verifiedBadge}>
            <Icon name="check-decagram" size={12} color={colors.accent} />
          </View>
        ) : null}
        {isOnline ? (
          <View
            style={styles.onlineDot}
            accessibilityLabel="Online"
            accessibilityRole="image"
          />
        ) : null}
      </View>
      {badge ? (
        <View style={[styles.badge, { borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
            {badge}
          </Text>
        </View>
      ) : (
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </View>
  );
}

function entityMarkerPropsEqual(prev: Props, next: Props): boolean {
  return (
    entityVisualKey(prev.point) === entityVisualKey(next.point) &&
    prev.point.lat === next.point.lat &&
    prev.point.lng === next.point.lng &&
    prev.onVisualSettled === next.onVisualSettled
  );
}

export const EntityMarker = React.memo(EntityMarkerImpl, entityMarkerPropsEqual);

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 2 },
  bubble: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 2.5,
    backgroundColor: 'rgba(10,10,15,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendBubble: {
    borderWidth: 3,
    backgroundColor: FRIEND_BUBBLE_BG,
  },
  photo: {
    width: MARKER_SIZE - 5,
    height: MARKER_SIZE - 5,
    borderRadius: (MARKER_SIZE - 5) / 2,
  },
  initials: {
    fontSize: 14,
    fontWeight: '700',
  },
  icon: { fontSize: 16 },
  label: { fontSize: 10, fontWeight: '600', maxWidth: 72 },
  badge: {
    maxWidth: 72,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,15,0.92)',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: 'rgba(10,10,15,0.9)',
    borderRadius: 8,
    padding: 1,
  },
  /** Top-right presence pip — only when server said online (privacy already applied). */
  onlineDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: 'rgba(10,10,15,0.95)',
  },
});
