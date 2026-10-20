import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { resolveTrustNextStep } from '@g88/shared';
import { NexaTrustMark } from '@/components/Profile/NexaTrustMark';
import {
  buildVerificationItems,
  type VerificationItem,
  type VerificationItemId,
} from '@/components/Profile/VerificationStatusSheet';
import { resolveNexaTrustVisualFromProfile } from '@/components/Profile/nexaTrustVisuals';
import { ScreenHeader } from '@/components/ScreenHeader';
import { fetchProfile } from '@/features/profile/profileSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import type { AccountStackParamList } from '@/navigation/stacks';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

type Nav = NativeStackNavigationProp<AccountStackParamList>;
type Route = RouteProp<AccountStackParamList, 'TrustCenter'>;

const STATUS_ICON: Record<VerificationItem['status'], string> = {
  success: 'check-circle',
  pending: 'clock-outline',
  error: 'alert-circle',
  missing: 'circle-outline',
};

interface PrimaryAction {
  id: VerificationItemId;
  label: string;
}

export function TrustCenterScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.profile.profile);
  const loading = useAppSelector((state) => state.profile.loading);

  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchProfile());
    }, [dispatch]),
  );

  const coreNext = useMemo(
    () =>
      resolveTrustNextStep({
        emailVerified: profile?.badges?.email === true,
        phoneVerified: profile?.badges?.phone === true,
        ...(profile?.idVerificationStatus != null
          ? { idStatus: profile.idVerificationStatus }
          : {}),
      }),
    [profile],
  );
  const trust = useMemo(() => resolveNexaTrustVisualFromProfile(profile), [profile]);
  const items = useMemo(() => buildVerificationItems(profile), [profile]);
  const focusStep = route.params?.focusStep;

  const openStep = useCallback(
    (id: VerificationItemId): void => {
      if (id === 'email') {
        navigation.navigate('EmailVerification');
        return;
      }
      if (id === 'phone') {
        const phone = profile?.phone;
        if (phone != null && phone !== '') {
          navigation.navigate('Verification', { initialPhone: phone });
        } else {
          navigation.navigate('Verification');
        }
        return;
      }
      if (id === 'social') {
        navigation.navigate('SocialLinking');
        return;
      }
      navigation.navigate('VerificationId');
    },
    [navigation, profile?.phone],
  );

  const primaryAction = useMemo<PrimaryAction | null>(() => {
    if (coreNext.kind === 'actionable' && coreNext.step != null && coreNext.ctaLabel) {
      return { id: coreNext.step, label: coreNext.ctaLabel };
    }
    if (coreNext.kind === 'done' && !trust.socialConnected) {
      return { id: 'social', label: 'Connect a profile' };
    }
    return null;
  }, [coreNext, trust.socialConnected]);

  const statusColor: Record<VerificationItem['status'], string> = {
    success: colors.verified,
    pending: colors.warning,
    error: colors.danger,
    missing: colors.textTertiary,
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScreenHeader title="Trust & verification" />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={loading && profile != null}
            onRefresh={() => void dispatch(fetchProfile())}
            tintColor={colors.discovery}
          />
        }
      >
        <View
          style={[
            styles.summary,
            {
              backgroundColor: colors.surfacePrimary,
              borderColor: trust.identityVerified
                ? colors.discoveryBorder
                : colors.borderDefault,
            },
          ]}
          accessibilityRole="summary"
        >
          <NexaTrustMark
            level={trust.level}
            accessibilityLabel={`${trust.label}. ${trust.detail}`}
          />
          <View style={styles.summaryBody}>
            <Text style={[styles.eyebrow, { color: colors.discovery }]}>NEXA IDENTITY</Text>
            <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>
              {trust.label}
            </Text>
            <Text style={[styles.summaryDetail, { color: colors.textSecondary }]}>
              {trust.detail}
            </Text>
            {coreNext.kind === 'pending' ? (
              <View style={styles.inlineState}>
                <Icon name="clock-outline" size={15} color={colors.warning} />
                <Text style={[styles.inlineStateText, { color: colors.warning }]}>
                  Identity review in progress
                </Text>
              </View>
            ) : trust.identityVerified ? (
              <View style={styles.inlineState}>
                <Icon name="check-decagram" size={15} color={colors.verified} />
                <Text style={[styles.inlineStateText, { color: colors.verified }]}>
                  Government ID verified
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {primaryAction ? (
          <Pressable
            style={({ pressed }) => [
              styles.primaryCta,
              { backgroundColor: colors.actionPrimary },
              pressed && styles.pressed,
            ]}
            onPress={() => openStep(primaryAction.id)}
            accessibilityRole="button"
            accessibilityLabel={primaryAction.label}
          >
            <Text style={[styles.primaryCtaText, { color: colors.onPrimary }]}>
              {primaryAction.label}
            </Text>
            <Icon name="chevron-right" size={20} color={colors.onPrimary} />
          </Pressable>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Identity signals</Text>
        <View style={styles.list}>
          {items.map((item) => {
            const color = statusColor[item.status];
            const focused = focusStep === item.id;
            const pendingId = item.id === 'id' && item.status === 'pending';
            const completedLocked = item.status === 'success' && item.id !== 'social';
            const tappable = !pendingId && !completedLocked;

            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (tappable) openStep(item.id);
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: focused ? colors.actionPrimary : colors.borderSubtle,
                  },
                  pressed && tappable && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${item.statusLabel}`}
                accessibilityState={{ disabled: !tappable }}
              >
                <Icon name={STATUS_ICON[item.status]} size={22} color={color} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTitleLine}>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                      {item.title}
                    </Text>
                    {item.optional ? (
                      <Text style={[styles.optionalLabel, { color: colors.textTertiary }]}>Optional</Text>
                    ) : null}
                  </View>
                  <Text
                    style={[styles.rowDetail, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {item.detail}
                  </Text>
                </View>
                <View style={styles.rowTrailing}>
                  <Text style={[styles.statusLabel, { color }]}>{item.statusLabel}</Text>
                  {tappable ? (
                    <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.explainer,
            {
              backgroundColor: colors.discoverySoft,
              borderColor: colors.discoveryBorderSoft,
            },
          ]}
        >
          <Icon name="shield-account-outline" size={22} color={colors.discovery} />
          <View style={styles.explainerBody}>
            <Text style={[styles.explainerTitle, { color: colors.textPrimary }]}>What verification means</Text>
            <Text style={[styles.explainerText, { color: colors.textSecondary }]}> 
              NEXA confirms specific identity signals. A verified or trusted profile is not a guarantee of a person’s behavior or safety.
            </Text>
          </View>
        </View>

        <Text style={[styles.footnote, { color: colors.textTertiary }]}> 
          Verification status is shown as clear states, not a public numeric trust score.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  summaryBody: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  summaryDetail: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: 4,
  },
  inlineState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  inlineStateText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  primaryCta: {
    minHeight: 48,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  primaryCtaText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  list: { gap: spacing.xs },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  optionalLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowDetail: {
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginTop: 2,
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  explainer: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  explainerBody: { flex: 1 },
  explainerTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  explainerText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: 4,
  },
  footnote: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
