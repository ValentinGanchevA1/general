import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { AccountStackParamList } from '@/navigation/stacks';
import { APP_VERSION } from '@/constants/app';
import { ListRow } from '@/components/ListRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontSize, radius, spacing } from '@/theme';

type Nav = NativeStackNavigationProp<AccountStackParamList>;

function Feature({ icon, title, body }: { icon: string; title: string; body: string }): React.JSX.Element {
  return (
    <View style={styles.feature}>
      <Icon name={icon} size={20} color={colors.primary} style={styles.featureIcon} />
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureBody}>{body}</Text>
      </View>
    </View>
  );
}

export function AboutScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();

  return (
    <View style={styles.container}>
      <ScreenHeader title="About" />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Icon name="map-marker-radius" size={44} color={colors.primary} />
          </View>
          <Text style={styles.appName}>G88</Text>
          <Text style={styles.tagline}>
            Map-first local social — meet people nearby, build status through real interactions.
          </Text>
          <Text style={styles.version}>Version {APP_VERSION}</Text>
        </View>

        <Text style={styles.about}>
          G88 puts nearby people and activity on a live map. Wave, react to stories,
          chat after mutual interest, trade locally, and join events — all around you.
          Your exact GPS is never stored: positions are coarsened before anything is saved.
        </Text>

        <Text style={styles.sectionTitle}>What you can do</Text>
        <View style={styles.featureGroup}>
          <Feature
            icon="map"
            title="Map & discovery"
            body="Live map of people and places nearby. Filters, clusters, and presence while the app is open."
          />
          <Feature
            icon="pulse"
            title="Pulse"
            body="Activity feed of chats, waves, trades, alerts, and matches — plus nearby story rings."
          />
          <Feature
            icon="circle-outline"
            title="Stories"
            body="24-hour posts visible to people nearby. Reactions count like waves for mutual unlock."
          />
          <Feature
            icon="hand-wave"
            title="Waves & chat"
            body="Lightweight signals first. Chat unlocks when interest is mutual (wave or story reaction)."
          />
          <Feature
            icon="storefront-outline"
            title="Local trade"
            body="Listings and offers stay free and settle offline — no in-app payments required."
          />
          <Feature
            icon="shield-check"
            title="Trust ladder"
            body="Email → phone → ID review builds verification. Soft gates protect the network without blocking exploration."
          />
        </View>

        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.group}>
          <ListRow
            variant="inset"
            icon="shield-lock"
            title="Privacy"
            onPress={() => navigation.navigate('Privacy')}
          />
          <ListRow
            variant="inset"
            last
            icon="help-circle"
            title="Help & Support"
            onPress={() => navigation.navigate('Help')}
          />
        </View>

        <Text style={styles.copyright}>
          © {new Date().getFullYear()} G88. All rights reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.xxl, paddingBottom: 48 },
  brand: { alignItems: 'center', marginTop: spacing.md, marginBottom: 28 },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 22,
    backgroundColor: 'rgba(0,212,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
  },
  appName: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginTop: spacing.lg,
    letterSpacing: 1,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
    lineHeight: 20,
  },
  version: { color: colors.textFaint, fontSize: 12, marginTop: 10 },
  about: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  featureGroup: { marginBottom: 28 },
  feature: { flexDirection: 'row', marginBottom: spacing.lg },
  featureIcon: { marginTop: 2, width: 28 },
  featureText: { flex: 1 },
  featureTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  group: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  copyright: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
