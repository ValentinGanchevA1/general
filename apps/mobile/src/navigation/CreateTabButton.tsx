// apps/mobile/src/navigation/CreateTabButton.tsx
// Center tab action: open Create nearby (no real screen).

import React from 'react';
import {
	StyleSheet,
	TouchableOpacity,
	View,
	type GestureResponderEvent,
} from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme } from '@/theme';
import { nexusVisual } from '@/theme/nexusVisual';
import { requestOpenCreateNearby } from '@/features/map/pendingCreateNearby';

/** Center “Create” tab control. */
export function CreateTabButton({
	accessibilityState,
	onPress,
	testID,
}: BottomTabBarButtonProps): React.JSX.Element {
	const { colors, mode, shadow } = useAppTheme();
	const focused = accessibilityState?.selected === true;
	const isNexus = mode === 'protos-nexus';

	const handlePress = (e: GestureResponderEvent): void => {
		requestOpenCreateNearby();
		onPress?.(e);
	};

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel="Create nearby"
			accessibilityState={accessibilityState}
			onPress={handlePress}
			activeOpacity={0.85}
			style={styles.wrap}
			testID={testID}
		>
			<View
				style={[
					styles.fab,
					{
						backgroundColor: colors.primary,
						borderWidth: isNexus ? nexusVisual.borderWidth : 0,
						borderColor: isNexus ? colors.primaryBorder : 'transparent',
					},
					shadow(isNexus ? nexusVisual.glow.shadowOpacity : 0.3),
					isNexus ? { elevation: nexusVisual.glow.elevation } : null,
					focused && styles.fabFocused,
				]}
			>
				<MCI name="plus" size={28} color={colors.onPrimary} />
			</View>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	wrap: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		top: -10,
	},
	fab: {
		width: 52,
		height: 52,
		borderRadius: 26,
		alignItems: 'center',
		justifyContent: 'center',
	},
	fabFocused: {
		opacity: 0.95,
	},
});
