import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { APP_VERSION } from '@/constants/app';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.linkRow} onPress={onPress}>
      <Icon name={icon} size={22} color="#888" />
      <Text style={styles.linkLabel}>{label}</Text>
      <Icon name="chevron-right" size={24} color="#444" />
    </TouchableOpacity>
  );
}

function Feature({ icon, title, body }: { icon: string; title: string; body: string }): React.JSX.Element {
  return (
    <View style={styles.feature}>
      <Icon name={icon} size={20} color="#00d4ff" style={styles.featureIcon} />
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Icon name="map-marker-radius" size={44} color="#00d4ff" />
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
          <LinkRow
            icon="shield-lock"
            label="Privacy"
            onPress={() => navigation.navigate('Privacy')}
          />
          <LinkRow
            icon="help-circle"
            label="Help & Support"
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
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingTop: 56,
  },
  back: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { padding: 24, paddingBottom: 48 },
  brand: { alignItems: 'center', marginTop: 12, marginBottom: 28 },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 22,
    backgroundColor: '#00d4ff15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00d4ff33',
  },
  appName: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 16, letterSpacing: 1 },
  tagline: { color: '#888', fontSize: 14, textAlign: 'center', marginTop: 6, maxWidth: 280, lineHeight: 20 },
  version: { color: '#555', fontSize: 12, marginTop: 10 },
  about: { color: '#aaa', fontSize: 14, lineHeight: 21, marginBottom: 24 },
  sectionTitle: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  featureGroup: { marginBottom: 28 },
  feature: { flexDirection: 'row', marginBottom: 16 },
  featureIcon: { marginTop: 2, width: 28 },
  featureText: { flex: 1 },
  featureTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  featureBody: { color: '#888', fontSize: 13, lineHeight: 18 },
  group: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a4a',
  },
  linkLabel: { color: '#fff', fontSize: 15, fontWeight: '500', flex: 1, marginLeft: 12 },
  copyright: { color: '#444', fontSize: 12, textAlign: 'center', marginTop: 32 },
});
