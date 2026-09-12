// Map chrome: search bar — client-side filter on current viewport points only.

import React from 'react';
import {
	Pressable,
	StyleSheet,
	TextInput,
	View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, fontSize, radius, spacing } from '@/theme';

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
	placeholder = 'Search nearby…',
}: MapSearchBarProps): React.JSX.Element {
	return (
		<View style={[styles.wrap, { top }]} pointerEvents="box-none">
			<View style={styles.bar}>
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
					placeholderTextColor={colors.textMuted}
					style={styles.input}
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
		backgroundColor: 'rgba(18,18,31,0.94)',
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.pill,
		paddingHorizontal: 12,
	},
	icon: {
		marginRight: 8,
	},
	input: {
		flex: 1,
		color: colors.textPrimary,
		fontSize: fontSize.sm,
		paddingVertical: 0,
		includeFontPadding: false,
	},
	clear: {
		marginLeft: 6,
		padding: 2,
	},
});
