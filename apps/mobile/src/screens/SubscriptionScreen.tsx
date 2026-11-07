import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { spacing, useAppTheme, type ThemeColors } from '@/theme';

/**
 * First Google Play release is entirely free. Keep the historical navigation
 * route safe for deep links; do not render prices, Stripe links or checkout CTAs.
 * A future billing rollout requires a separate Play Billing / policy review.
 */
export function SubscriptionScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.root}>
      <ScreenHeader title="NEXUS Early Access" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Free during early access</Text>
        <Text style={styles.body}>
          NEXUS is currently free. Paid plans and in-app purchases are not available
          in this version. You can keep discovering and connecting without payment.
        </Text>
      </ScrollView>
    </View>
  );
}
function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xxl, gap: spacing.lg },
    title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
    body: { color: colors.textSecondary, fontSize: 15, lineHeight: 23 },
  });
}
