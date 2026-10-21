import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DiscoverTone = 'discovery' | 'action' | 'neutral';

interface DiscoverLane {
  id: 'people' | 'events' | 'marketplace' | 'suggestions';
  title: string;
  detail: string;
  action: string;
  icon: string;
  tone: DiscoverTone;
}

const LANES: readonly DiscoverLane[] = [
  {
    id: 'people',
    title: 'Nearby people',
    detail: 'Return to the map and discover people in the current area.',
    action: 'Open map',
    icon: 'account-group-outline',
    tone: 'action',
  },
  {
    id: 'events',
    title: 'Local events',
    detail: 'See event signals and activity without leaving local context.',
    action: 'Explore events',
    icon: 'calendar-star',
    tone: 'discovery',
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    detail: 'Browse nearby listings and wanted posts.',
    action: 'Browse listings',
    icon: 'tag-outline',
    tone: 'neutral',
  },
  {
    id: 'suggestions',
    title: 'People you may know',
    detail: 'Explore connection suggestions based on your existing graph.',
    action: 'See suggestions',
    icon: 'account-search-outline',
    tone: 'action',
  },
] as const;

export function DiscoverScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();

  const openLane = useCallback((lane: DiscoverLane['id']): void => {
    if (lane === 'people') {
      navigation.navigate('Main', { screen: 'Map' });
      return;
    }
    if (lane === 'events') {
      navigation.navigate('Main', { screen: 'Pulse', params: { filter: 'events' } });
      return;
    }
    if (lane === 'marketplace') {
      openRootScreen(navigation, 'Marketplace');
      return;
    }
    openRootScreen(navigation, 'Suggestions');
  }, [navigation]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Discover" bordered />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero} accessibilityRole="summary">
          <View style={styles.heroGlyph}>
            <MaterialCommunityIcons name="compass-outline" size={24} color={colors.discovery} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>NEXA DISCOVERY</Text>
            <Text style={styles.heroTitle}>Choose a local discovery lane</Text>
            <Text style={styles.heroBody}>
              The map stays home. Discover gives you focused paths into people, events and local activity.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Explore nearby</Text>
        <View style={styles.grid}>
          {LANES.map((lane) => {
            const accent = lane.tone === 'discovery'
              ? colors.discovery
              : lane.tone === 'action'
                ? colors.actionPrimary
                : colors.textSecondary;
            const surface = lane.tone === 'discovery'
              ? colors.discoverySoft
              : lane.tone === 'action'
                ? colors.actionSoft
                : colors.surfaceSecondary;
            const border = lane.tone === 'discovery'
              ? colors.discoveryBorderSoft
              : lane.tone === 'action'
                ? colors.actionBorderSoft
                : colors.borderSubtle;

            return (
              <Pressable
                key={lane.id}
                accessibilityRole="button"
                accessibilityLabel={`${lane.title}. ${lane.action}`}
                onPress={() => openLane(lane.id)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.surfacePrimary, borderColor: border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.cardGlyph, { backgroundColor: surface, borderColor: border }]}>
                  <MaterialCommunityIcons name={lane.icon} size={22} color={accent} />
                </View>
                <Text style={styles.cardTitle}>{lane.title}</Text>
                <Text style={styles.cardBody}>{lane.detail}</Text>
                <View style={styles.cardActionRow}>
                  <Text style={[styles.cardAction, { color: accent }]}>{lane.action}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={17} color={accent} />
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.note}>
          <MaterialCommunityIcons name="map-marker-radius-outline" size={20} color={colors.discovery} />
          <Text style={styles.noteText}>
            Nearby ranking and location privacy still come from the existing map and discovery systems. This hub does not request or store new location data.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
    hero: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.discoveryBorderSoft,
      backgroundColor: colors.surfacePrimary,
    },
    heroGlyph: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.discoverySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.discoveryBorderSoft,
    },
    heroCopy: { flex: 1, minWidth: 0 },
    eyebrow: { color: colors.discovery, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
    heroTitle: { color: colors.textPrimary, fontSize: fontSize.lg, lineHeight: 24, fontWeight: '800', marginTop: 3 },
    heroBody: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 19, marginTop: 5 },
    sectionTitle: { color: colors.textTertiary, fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
    grid: { gap: spacing.sm },
    card: {
      minHeight: 132,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.lg,
    },
    cardGlyph: { width: 42, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '800', marginTop: spacing.sm },
    cardBody: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 19, marginTop: 4 },
    cardActionRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm, alignSelf: 'flex-start' },
    cardAction: { fontSize: fontSize.sm, fontWeight: '800' },
    note: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
    noteText: { flex: 1, color: colors.textTertiary, fontSize: fontSize.xs, lineHeight: 17 },
    pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  });
}
