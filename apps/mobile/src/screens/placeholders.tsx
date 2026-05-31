// Placeholder destinations for ProfileScreen links whose real implementations
// land in later slices:
//   Verification → G2 · Subscription → G3 · SocialLinking → G4
//   Achievements / Leaderboard / Challenges → G5
// Privacy / Help / About are static informational screens (low priority).
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

function ComingSoon({ title, icon, blurb }: { title: string; icon: string; blurb: string }): React.JSX.Element {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.back} />
      </View>
      <View style={styles.body}>
        <Icon name={icon} size={56} color="#00d4ff" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.blurb}>{blurb}</Text>
        <View style={styles.soonPill}>
          <Text style={styles.soonText}>Coming soon</Text>
        </View>
      </View>
    </View>
  );
}

export const ChallengesScreen = (): React.JSX.Element => (
  <ComingSoon title="Challenges" icon="checkbox-marked-circle-outline" blurb="Complete daily challenges to earn bonus XP." />
);
export const PrivacyScreen = (): React.JSX.Element => (
  <ComingSoon title="Privacy" icon="shield-lock" blurb="Control who can see you and how your data is used." />
);
export const HelpScreen = (): React.JSX.Element => (
  <ComingSoon title="Help & Support" icon="help-circle" blurb="Find answers or get in touch with the G88 team." />
);
export const AboutScreen = (): React.JSX.Element => (
  <ComingSoon title="About" icon="information" blurb="G88 — see who and what is nearby, then act on it." />
);

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
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 8 },
  blurb: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  soonPill: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#00d4ff20',
    borderRadius: 16,
  },
  soonText: { color: '#00d4ff', fontWeight: '600', fontSize: 12 },
});
