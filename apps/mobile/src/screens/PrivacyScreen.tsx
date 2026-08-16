import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { AccountStackParamList } from '@/navigation/stacks';
import { PRIVACY_POLICY_URL } from '@/constants/app';

type Nav = NativeStackNavigationProp<AccountStackParamList>;

function Point({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}): React.JSX.Element {
  return (
    <View style={styles.point}>
      <Icon name={icon} size={22} color="#00d4ff" style={styles.pointIcon} />
      <View style={styles.pointText}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointBody}>{body}</Text>
      </View>
    </View>
  );
}

/**
 * Native summary of G88's privacy posture aligned with current product:
 * map discovery, Pulse, stories, soft post gates, offline trade.
 */
export function PrivacyScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();

  const openFullPolicy = (): void => {
    void Linking.openURL(PRIVACY_POLICY_URL);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro}>
          Privacy is a core design constraint of G88. Here is what that means with
          the features we ship today.
        </Text>

        <Point
          icon="map-marker-off"
          title="Your exact location is never stored"
          body="Precise GPS is coarsened to roughly a 120-meter area before anything is saved. Other users only ever see that coarsened neighborhood — never a point on your doorstep."
        />
        <Point
          icon="map-clock"
          title="Foreground only"
          body="Location is used only while the app is open (map, Pulse stories, nearby feed). G88 does not track you in the background."
        />
        <Point
          icon="eye-off"
          title="You control who sees you"
          body="Hide from discovery any time in Settings → Appear on map. You can also revoke OS location permission in device settings."
        />
        <Point
          icon="circle-outline"
          title="Stories stay local and temporary"
          body="Stories are visible to people nearby and expire after 24 hours. Posting requires a verified email and a minimum account age (or phone+). Media is not kept as a permanent public archive."
        />
        <Point
          icon="hand-wave"
          title="Interactions are intentional"
          body="Waves and story reactions are first-class signals. Chat unlocks only after mutual interest — not cold outreach from strangers."
        />
        <Point
          icon="account-eye"
          title="What others can see"
          body="Display name, photos, bio, interests, badges, coarsened location, and public storyline — never your email, phone number, or precise position."
        />
        <Point
          icon="storefront-outline"
          title="Trading stays offline"
          body="Listings and offers are free. Settlement happens between people offline — we do not process payments or store card data for local trade."
        />
        <Point
          icon="shield-lock"
          title="Encrypted and minimized"
          body="Data is encrypted in transit. Passwords are salted hashes only. Sign-in tokens stay in your device keystore. Diagnostics are scrubbed of location and tokens."
        />
        <Point
          icon="cancel"
          title="No selling, no ads"
          body="We do not sell your personal data and we do not show third-party advertising."
        />

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Manage your data</Text>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => navigation.navigate('Settings')}
        >
          <Icon name="cog" size={22} color="#888" />
          <View style={styles.actionText}>
            <Text style={styles.actionLabel}>Visibility & account</Text>
            <Text style={styles.actionSub}>
              Appear on map, blocked users, delete account
            </Text>
          </View>
          <Icon name="chevron-right" size={24} color="#444" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionRow, styles.actionRowSpaced]} onPress={openFullPolicy}>
          <Icon name="file-document-outline" size={22} color="#888" />
          <View style={styles.actionText}>
            <Text style={styles.actionLabel}>Read the full policy</Text>
            <Text style={styles.actionSub}>Opens our complete privacy policy</Text>
          </View>
          <Icon name="open-in-new" size={20} color="#444" />
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Deleting your account (Settings → Delete account) is immediate and
          permanently removes your profile, photos, stories, messages, and activity.
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
  intro: { color: '#aaa', fontSize: 14, lineHeight: 21, marginBottom: 24 },
  point: { flexDirection: 'row', marginBottom: 22 },
  pointIcon: { marginTop: 2, width: 30 },
  pointText: { flex: 1 },
  pointTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  pointBody: { color: '#888', fontSize: 13, lineHeight: 19 },
  divider: { height: 1, backgroundColor: '#1a1a2e', marginVertical: 12 },
  sectionTitle: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  actionRow: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  actionRowSpaced: { marginTop: 12 },
  actionText: { flex: 1, marginLeft: 12 },
  actionLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  actionSub: { color: '#666', fontSize: 12, marginTop: 2 },
  footnote: { color: '#555', fontSize: 12, lineHeight: 18, marginTop: 20 },
});
