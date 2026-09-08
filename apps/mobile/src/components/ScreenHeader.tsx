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
  title?: string;
  center?: React.ReactNode;
  onBack?: () => void;
  hideBack?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  bordered?: boolean;
  transparent?: boolean;
}

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
    minWidth: BACK_SIZE,
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
