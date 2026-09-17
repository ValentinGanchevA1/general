import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { AccountStackParamList } from '@/navigation/stacks';
import { APP_VERSION } from '@/constants/app';
import { ListRow } from '@/components/ListRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, radius, spacing } from '@/theme';

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
            Map-first local social — meet people nearby, build trust through real interactions.
          </Text>
          <Text style={styles.version}>Version {APP_VERSION}</Text>
        </View>

        <Text style={styles.about}>
          G88 puts people, events, and listings on a live map around you. Wave or message,
          post stories, trade locally, and join events — without a global feed. Your exact
          GPS is never stored: positions are coarsened before anything is saved.
        </Text>

        <Text style={styles.sectionTitle}>What you can do</Text>
        <View style={styles.featureGroup}>
          <Feature
            icon="map"
            title="Map & discovery"
            body="Live map of people, events, and listings. Filters (for sale / wanted / friends), clusters, search, and presence while the app is open."
          />
          <Feature
            icon="pulse"
            title="Pulse"
            body="Local activity: trades, alerts, and nearby story rings. Chats, waves, and matches live in Interactions — not in Pulse."
          />
          <Feature
            icon="circle-outline"
            title="Stories"
            body="24-hour posts for people nearby. Photo or short video. Reactions count toward mutual interest."
          />
          <Feature
            icon="hand-wave"
            title="Waves, chat & Interactions"
            body="Lightweight signals first. Chat unlocks when interest is mutual. Interactions is one inbox for waves, chats, friend requests, and followers — with Map on inbound waves."
          />
          <Feature
            icon="account-group"
            title="Friends"
            body="Requests, suggestions, mutual friends, and optional online status for friends only. Unfriending keeps mutual follows unless you unfollow."
          />
          <Feature
            icon="calendar-star"
            title="Events"
            body="Create and discover local events from the map. Message the host when listed."
          />
          <Feature
            icon="storefront-outline"
            title="Local trade"
            body="Listings, wanted posts, offers and counters. Settlement stays offline — no in-app payments required."
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
