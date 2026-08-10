import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, radius, fontSize } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_HEIGHT = SCREEN_WIDTH * 1.15;

interface ProfileHeaderPhotoProps {
  photoUrl: string | null;
  displayName: string;
  handle?: string | null;
  verificationPercent: number;
  isVisibleOnMap: boolean;
  isPaid?: boolean;
  tierLabel?: string;
  onPressPhoto?: () => void;
  onPressVerificationBadge?: () => void;
}

export function ProfileHeaderPhoto({
  photoUrl,
  displayName,
  handle,
  verificationPercent,
  isVisibleOnMap,
  isPaid,
  tierLabel,
  onPressPhoto,
  onPressVerificationBadge,
}: ProfileHeaderPhotoProps): React.JSX.Element {
  return (
    <Pressable onPress={onPressPhoto} style={styles.container}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.placeholder]}>
          <Text style={styles.placeholderInitials}>
            {displayName
              .split(' ')
              .map((w) => w[0] ?? '')
              .join('')
              .toUpperCase()
              .slice(0, 2) || '?'}
          </Text>
        </View>
      )}

      {/* Bottom overlay for readability */}
      <View style={styles.overlay} />

      <View style={styles.overlayContent}>
        <View style={styles.leftInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {handle ? <Text style={styles.handle}>@{handle}</Text> : null}
          <View style={styles.visibilityRow}>
            <View
              style={[
                styles.visibilityDot,
                { backgroundColor: isVisibleOnMap ? colors.success : colors.textFaint },
              ]}
            />
            <Text style={styles.visibilityText}>
              {isVisibleOnMap ? 'Visible on map' : 'Hidden from map'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onPressVerificationBadge}
          style={styles.percentBadge}
          hitSlop={8}
        >
          <Text style={styles.percentText}>{verificationPercent}%</Text>
        </Pressable>
      </View>

      {isPaid && tierLabel ? (
        <View style={styles.tierBadge}>
          <Icon name="crown" size={14} color="#fff" />
          <Text style={styles.tierBadgeText}>{tierLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderInitials: {
    color: colors.primary,
    fontSize: 72,
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    top: '45%',
    backgroundColor: 'transparent',
    // Approximate gradient with stacked opacity layers would be better,
    // but a solid bottom fade is reliable without extra deps.
  },
  overlayContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: 48,
    backgroundColor: 'rgba(10,10,15,0.72)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  leftInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  name: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  handle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginTop: 2,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  visibilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  visibilityText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  percentBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  percentText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  tierBadge: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFD700',
    gap: 4,
  },
  tierBadgeText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 12,
  },
});
