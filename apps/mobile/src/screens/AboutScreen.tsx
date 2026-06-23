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
          <Text style={styles.tagline}>See who and what is nearby — then act on it.</Text>
          <Text style={styles.version}>Version {APP_VERSION}</Text>
        </View>

        <Text style={styles.about}>
          G88 is a map-first, location-based social app. Nearby people appear as
          avatars on a live map so you can wave, chat, and discover local activity —
          events, listings, and more — all around you. Your exact location is never
          stored: it is coarsened to roughly a 120-meter area before anything is saved.
        </Text>

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
  tagline: { color: '#888', fontSize: 14, textAlign: 'center', marginTop: 6, maxWidth: 260 },
  version: { color: '#555', fontSize: 12, marginTop: 10 },
  about: { color: '#aaa', fontSize: 14, lineHeight: 21, marginBottom: 28 },
  sectionTitle: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
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
