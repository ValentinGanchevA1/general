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
import { colors, spacing, fontSize } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_HEIGHT = SCREEN_WIDTH * 1.05;

interface ProfileHeaderPhotoProps {
  photoUrl: string | null;
  displayName: string;
  handle?: string | null;
  verificationPercent: number;
  isVisibleOnMap: boolean;
  isPaid?: boolean;
  tierLabel?: string;
  photoCount?: number;
  activePhotoIndex?: number;
  onPressPhoto?: () => void;
  onPressVerificationBadge?: () => void;
  onPressSettings?: () => void;
  onSelectPhoto?: (index: number) => void;
  /** Opens map visibility sheet (How others see you). */
  onPressVisibility?: () => void;
}

export function ProfileHeaderPhoto({
  photoUrl,
  displayName,
  handle,
  verificationPercent,
  isVisibleOnMap,
  isPaid,
  tierLabel,
  photoCount = 1,
  activePhotoIndex = 0,
  onPressPhoto,
  onPressVerificationBadge,
  onPressSettings,
  onSelectPhoto,
  onPressVisibility,
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

      {/* Top chrome */}
      <View style={styles.topChrome} pointerEvents="box-none">
        {isPaid && tierLabel ? (
          <View style={styles.tierBadge}>
            <Icon name="crown" size={13} color="#000" />
            <Text style={styles.tierBadgeText}>{tierLabel}</Text>
          </View>
        ) : (
          <View />
        )}
        {onPressSettings ? (
          <Pressable
            onPress={onPressSettings}
            style={styles.settingsBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Icon name="cog" size={20} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>

      {/* Bottom readability + identity */}
      <View style={styles.overlayContent}>
        {photoCount > 1 ? (
          <View style={styles.dots}>
            {Array.from({ length: photoCount }).map((_, index) => (
              <Pressable
                key={index}
                onPress={() => onSelectPhoto?.(index)}
                style={[styles.dot, index === activePhotoIndex && styles.dotActive]}
                hitSlop={6}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.nameRow}>
          <View style={styles.leftInfo}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {handle ? <Text style={styles.handle}>@{handle}</Text> : null}
            <Pressable
              onPress={onPressVisibility}
              disabled={!onPressVisibility}
              style={styles.visibilityRow}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                isVisibleOnMap
                  ? 'Visible on map. Tap to change how others see you.'
                  : 'Hidden from map. Tap to change how others see you.'
              }
            >
              <View
                style={[
                  styles.visibilityDot,
                  { backgroundColor: isVisibleOnMap ? colors.success : colors.textFaint },
                ]}
              />
              <Text style={styles.visibilityText}>
                {isVisibleOnMap ? 'Visible on map' : 'Hidden from map'}
              </Text>
              {onPressVisibility ? (
                <Icon name="chevron-down" size={14} color={colors.textMuted} />
              ) : null}
            </Pressable>
          </View>

          <Pressable
            onPress={onPressVerificationBadge}
            style={styles.percentBadge}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${verificationPercent} percent verified`}
          >
            <Text style={styles.percentText}>{verificationPercent}%</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
    position: 'relative',
    backgroundColor: colors.surfaceRaised,
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
    fontSize: 64,
    fontWeight: '700',
  },
  topChrome: {
    position: 'absolute',
    top: 52,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    gap: 4,
  },
  tierBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  overlayContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: 40,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  leftInfo: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  handle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  visibilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  visibilityText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  percentBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
