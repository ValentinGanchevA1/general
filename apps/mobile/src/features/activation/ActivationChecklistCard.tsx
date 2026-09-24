import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';

import type { ActivationStep } from './activationChecklist';

interface Props {
	steps: ActivationStep[];
	incompleteCount: number;
	onStepPress: (step: ActivationStep) => void;
	onDismiss: () => void;
}

/**
 * Compact first-session checklist — bottom of map, above events rail.
 * One primary incomplete step CTA; remaining rows are status only.
 */
export function ActivationChecklistCard({
	steps,
	incompleteCount,
	onStepPress,
	onDismiss,
}: Props): React.JSX.Element {
	const insets = useSafeAreaInsets();
	const primary = steps.find((s) => !s.done) ?? null;

	return (
		<View
			style={[styles.wrap, { bottom: Math.max(insets.bottom, spacing.md) + 72 }]}
			pointerEvents="box-none"
		>
			<View style={styles.card} accessibilityRole="summary">
				<View style={styles.header}>
					<Text style={styles.title}>
						Get started · {incompleteCount} left
					</Text>
					<TouchableOpacity
						hitSlop={10}
						onPress={onDismiss}
						accessibilityRole="button"
						accessibilityLabel="Dismiss checklist"
					>
						<Icon name="close" size={16} color={colors.textMuted} />
					</TouchableOpacity>
				</View>

				{steps.map((step) => {
					const isPrimary = primary?.id === step.id;
					return (
						<TouchableOpacity
							key={step.id}
							style={styles.row}
							onPress={() => {
								if (!step.done) onStepPress(step);
							}}
							disabled={step.done}
							accessibilityRole="button"
							accessibilityState={{ disabled: step.done, checked: step.done }}
							accessibilityLabel={`${step.label}${step.done ? ', done' : ''}`}
						>
							<Icon
								name={step.done ? 'check-circle' : 'circle-outline'}
								size={18}
								color={step.done ? colors.success : colors.textMuted}
							/>
							<Text
								style={[styles.rowLabel, step.done && styles.rowLabelDone]}
								numberOfLines={1}
							>
								{step.label}
							</Text>
							{isPrimary ? (
								<View style={styles.cta}>
									<Text style={styles.ctaText}>Go</Text>
								</View>
							) : null}
						</TouchableOpacity>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		left: spacing.lg,
		right: spacing.lg,
		zIndex: 24,
	},
	card: {
		paddingVertical: 12,
		paddingHorizontal: 14,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		gap: 8,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 2,
	},
	title: {
		color: colors.textPrimary,
		fontSize: 13,
		fontWeight: '700',
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		minHeight: 32,
	},
	rowLabel: {
		flex: 1,
		color: colors.textPrimary,
		fontSize: 13,
	},
	rowLabelDone: {
		color: colors.textMuted,
		textDecorationLine: 'line-through',
	},
	cta: {
		backgroundColor: colors.primary,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: radius.pill,
	},
	ctaText: {
		color: colors.onPrimary,
		fontSize: 12,
		fontWeight: '700',
	},
});
