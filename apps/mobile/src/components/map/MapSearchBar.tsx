// Map chrome: search bar — client-side filter on current viewport points only.

import React from 'react';
import {
	Pressable,
	StyleSheet,
	TextInput,
	View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { fontSize, radius, spacing, useAppTheme } from '@/theme';

export const MAP_SEARCH_BAR_HEIGHT = 44;

export interface MapSearchBarProps {
	value: string;
	onChangeText: (text: string) => void;
	/** Absolute top from safe-area stack (mapChromeLayout). */
	top: number;
	placeholder?: string;
}

export function MapSearchBar({
	value,
	onChangeText,
	top,
	placeholder = 'Search people, places, events, listings…',
}: MapSearchBarProps): React.JSX.Element {
	const { colors, shadow } = useAppTheme();

	return (
		<View style={[styles.wrap, { top }]} pointerEvents="box-none">
			<View
				style={[
					styles.bar,
					{
						backgroundColor: colors.surface,
						borderColor: colors.borderStrong,
					},
					shadow(0.12),
				]}
			>
				<Icon
					name="magnify"
					size={20}
					color={colors.textMuted}
					style={styles.icon}
				/>
				<TextInput
					value={value}
					onChangeText={onChangeText}
					placeholder={placeholder}
					placeholderTextColor={colors.textFaint}
					style={[styles.input, { color: colors.textPrimary }]}
					returnKeyType="search"
					autoCorrect={false}
					autoCapitalize="none"
					clearButtonMode="never"
					accessibilityLabel="Search nearby people, events, and listings"
				/>
				{value.length > 0 ? (
					<Pressable
						onPress={() => onChangeText('')}
						hitSlop={10}
						accessibilityRole="button"
						accessibilityLabel="Clear search"
						style={styles.clear}
					>
						<Icon name="close-circle" size={18} color={colors.textMuted} />
					</Pressable>
				) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		left: spacing.lg,
		right: spacing.lg,
		zIndex: 19,
	},
	bar: {
		height: MAP_SEARCH_BAR_HEIGHT,
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: radius.pill,
		paddingHorizontal: spacing.md,
	},
	icon: { marginRight: spacing.xs },
	input: {
		flex: 1,
		fontSize: fontSize.md,
		paddingVertical: 0,
	},
	clear: {
		padding: 4,
		minWidth: 32,
		minHeight: 32,
		alignItems: 'center',
		justifyContent: 'center',
	},
});
