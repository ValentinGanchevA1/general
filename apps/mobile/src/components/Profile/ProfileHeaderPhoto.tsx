import React from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { fontSize, spacing, useAppTheme } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_HEIGHT = SCREEN_WIDTH * 1.05;

interface ProfileHeaderPhotoProps {
  photoUrl: string | null;
  coverUrl?: string | null;
  displayName: string;
  handle?: string | null;
  /** @deprecated Retained for compatibility. Numeric trust is not rendered. */
  verificationPercent?: number;
  idVerified?: boolean;
  isVisibleOnMap: boolean;
  isPaid?: boolean;
  tierLabel?: string;
  photoCount?: number;
  activePhotoIndex?: number;
  onPressPhoto?: () => void;
  onPressVerificationBadge?: () => void;
  onPressSettings?: () => void;
  onPressBack?: () => void;
  onSelectPhoto?: (index: number) => void;
  onPressVisibility?: () => void;
}

export function ProfileHeaderPhoto({
  photoUrl,
  coverUrl,
  displayName,
  handle,
  verificationPercent,
  idVerified,
  isVisibleOnMap,
  isPaid,
  tierLabel,
  photoCount = 1,
  activePhotoIndex = 0,
  onPressPhoto,
  onPressVerificationBadge,
  onPressSettings,
  onPressBack,
  onSelectPhoto,
  onPressVisibility,
}: ProfileHeaderPhotoProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, mode } = useAppTheme();
  const isProtosNexus = mode === 'protos-nexus';
  const backgroundUri = coverUrl || photoUrl;
  // Compatibility bridge for ProfileView while the legacy score field remains in
  // its view-model contract. The number itself is never rendered.
  const resolvedIdVerified =
    idVerified ??
    (typeof verificationPercent === 'number' &&
      Number.isFinite(verificationPercent) &&
      verificationPercent >= 100);

  return (
    <Pressable
      onPress={onPressPhoto}
      style={[
        styles.container,
        { backgroundColor: themeColors.surfaceRaised },
        isProtosNexus && {
          borderColor: themeColors.primaryBorder,
          shadowColor: themeColors.primary,
        },
      ]}
    >
      {backgroundUri ? (
        <Image source={{ uri: backgroundUri }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.placeholder, { backgroundColor: themeColors.surfaceRaised }]}>
          <Text style={[styles.placeholderInitials, { color: themeColors.actionPrimary }]}>
            {displayName
              .split(' ')
              .map((word) => word[0] ?? '')
              .join('')
              .toUpperCase()
              .slice(0, 2) || '?'}
          </Text>
        </View>
      )}

      <View style={[styles.topChrome, { top: insets.top + 6 }]} pointerEvents="box-none">
        <View style={styles.topLeft} pointerEvents="box-none">
          {onPressBack ? (
            <Pressable
              onPress={onPressBack}
              style={styles.chromeBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Icon name="arrow-left" size={22} color={themeColors.textPrimary} />
            </Pressable>
          ) : null}
          {isPaid && tierLabel ? (
            <View style={[styles.tierBadge, { backgroundColor: themeColors.premium }]}>
              <Icon name="crown" size={13} color={themeColors.onPrimary} />
              <Text style={[styles.tierBadgeText, { color: themeColors.onPrimary }]}>{tierLabel}</Text>
            </View>
          ) : null}
        </View>
        {onPressSettings ? (
          <Pressable
            onPress={onPressSettings}
            style={styles.chromeBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Icon name="cog" size={20} color={themeColors.textPrimary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.overlayContent} pointerEvents="box-none">
        {photoCount > 1 ? (
          <View style={styles.dots}>
            {Array.from({ length: photoCount }).map((_, index) => (
              <Pressable
                key={index}
                onPress={() => onSelectPhoto?.(index)}
                hitSlop={6}
                style={[
                  styles.dot,
                  index === activePhotoIndex && styles.dotActive,
                  index === activePhotoIndex && { backgroundColor: themeColors.textPrimary },
                ]}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.nameRow}>
          <View style={styles.leftInfo}>
            <View style={styles.displayNameRow}>
              <Text
                style={[styles.name, { color: isProtosNexus ? themeColors.primary : themeColors.textPrimary }]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {isProtosNexus ? (
                <View
                  style={[
                    styles.nexusBadge,
                    {
                      backgroundColor: themeColors.primarySoft,
                      borderColor: themeColors.primaryBorderSoft,
                    },
                  ]}
                  accessibilityLabel="PROTOS NEXUS appearance active"
                >
                  <Text style={[styles.nexusBadgeText, { color: themeColors.primary }]}>NEXUS ✦</Text>
                </View>
              ) : null}
            </View>
            {handle ? (
              <Text style={[styles.handle, { color: themeColors.textSecondary }]} numberOfLines={1}>
                @{handle}
              </Text>
            ) : null}
            <Pressable
              onPress={onPressVisibility}
              style={styles.visibilityRow}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isVisibleOnMap ? 'Visible on map' : 'Hidden from map'}
            >
              <View
                style={[
                  styles.visibilityDot,
                  { backgroundColor: isVisibleOnMap ? themeColors.success : themeColors.textMuted },
                ]}
              />
              <Text style={[styles.visibilityText, { color: themeColors.textPrimary }]}>
                {isVisibleOnMap ? 'Visible on map' : 'Hidden from map'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onPressVerificationBadge}
            style={[
              styles.verificationBadge,
              { borderColor: themeColors.actionBorderSoft },
              resolvedIdVerified && { borderColor: themeColors.discoveryBorder },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              resolvedIdVerified ? 'Identity verified' : 'Open identity verification'
            }
          >
            <Icon
              name={resolvedIdVerified ? 'shield-check' : 'shield-outline'}
              size={15}
              color={resolvedIdVerified ? themeColors.verified : themeColors.actionPrimary}
            />
            <Text
              style={[
                styles.verificationText,
                { color: resolvedIdVerified ? themeColors.verified : themeColors.textPrimary },
              ]}
            >
              {resolvedIdVerified ? 'Verified' : 'Verify'}
            </Text>
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
    borderBottomWidth: 1,
    borderColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 0,
  },
  photo: { width: '100%', height: '100%' },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderInitials: {
    fontSize: 64,
    fontWeight: '700',
  },
  topChrome: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chromeBtn: {
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
    borderRadius: 16,
    gap: 4,
  },
  tierBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  overlayContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: 56,
    backgroundColor: 'rgba(10,10,15,0.78)',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 18,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  leftInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  displayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    flexShrink: 1,
  },
  nexusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  nexusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  handle: {
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
    fontSize: 13,
    fontWeight: '500',
  },
  verificationBadge: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 17,
    borderWidth: 1,
  },
  verificationText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
