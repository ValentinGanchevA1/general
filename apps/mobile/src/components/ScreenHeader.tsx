import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, fontSize, spacing } from '@/theme';

const BACK_SIZE = 48;

export interface ScreenHeaderProps {
  /** Plain title string. Ignored when `center` is provided. */
  title?: string;
  /** Custom center content (e.g. chat peer avatar + name). Takes priority over `title`. */
  center?: React.ReactNode;
  /** Override back handler (defaults to navigation.goBack). */
  onBack?: () => void;
  /** Hide the back button (e.g. root tab screens). Default false. */
  hideBack?: boolean;
  /** Optional right-side action slot (e.g. overflow menu). */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Extra bottom border. Default false. */
  bordered?: boolean;
  /** Transparent header over media (no solid bg). */
  transparent?: boolean;
}

/**
 * Shared screen header: safe-area top inset, 48dp back target + hitSlop,
 * accessibilityLabel="Go back", theme tokens. Replaces hand-rolled
 * paddingTop: 56 + chevron-left blocks across account/list screens.
 */
export function ScreenHeader({
  title,
  center,
  onBack,
  hideBack = false,
  right,
  style,
  bordered = false,
  transparent = false,
}: ScreenHeaderProps): React.JSX.Element {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handleBack = (): void => {
    if (onBack) {
      onBack();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + spacing.sm },
        transparent ? styles.transparent : null,
        bordered && styles.bordered,
        style,
      ]}
    >
      {hideBack ? (
        <View style={styles.side} />
      ) : (
        <TouchableOpacity
          onPress={handleBack}
          style={styles.back}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      {center != null ? (
        <View style={styles.center}>{center}</View>
      ) : (
        <Text style={styles.title} numberOfLines={1}>
          {title ?? ''}
        </Text>
      )}

      <View style={styles.side}>{right ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  bordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  back: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  side: {
    width: BACK_SIZE,
    minHeight: BACK_SIZE,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: BACK_SIZE,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
});
