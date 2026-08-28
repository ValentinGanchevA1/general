import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { AccountStackParamList } from '@/navigation/stacks';
import { PRIVACY_POLICY_URL } from '@/constants/app';
import { colors, spacing, fontSize } from '@/theme';

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
      <Icon name={icon} size={22} color={colors.primary} style={styles.pointIcon} />
      <View style={styles.pointText}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointBody}>{body}</Text>
      </View>
    </View>
  );
}

/**
 * Native summary of G88 privacy posture. Legal text of record remains the
 * hosted policy (PRIVACY_POLICY_URL) — this screen is product-aligned explainer only.
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
          <Icon name="chevron-left" size={28} color={colors.textPrimary} />
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
          body="Hide from discovery any time in Settings → Appear on map. Close friends’ online status is a separate toggle. You can also revoke OS location permission in device settings."
        />
        <Point
          icon="account-group"
          title="Friends stay intentional"
          body="Friend requests are explicit. Your friends list and online status for friends are not sold or used for ads. Unfriending does not automatically tear down public follows."
        />
        <Point
          icon="circle-outline"
          title="Stories stay local and temporary"
          body="Stories are visible to people nearby and expire after 24 hours. Posting requires a verified email and a minimum account age (phone-verified accounts can post sooner). Media is not kept as a permanent public archive."
        />
        <Point
          icon="hand-wave"
          title="Interactions are intentional"
          body="Waves, story reactions, and friend requests are first-class signals. Chat prioritizes people you already know; cold outreach stays lightweight until interest is mutual."
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
          <Icon name="cog" size={22} color={colors.textMuted} />
          <View style={styles.actionText}>
            <Text style={styles.actionLabel}>Visibility & account</Text>
            <Text style={styles.actionSub}>
              Map presence, friends online, blocked users, delete account
            </Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.borderStrong} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionRow, styles.actionRowSpaced]} onPress={openFullPolicy}>
          <Icon name="file-document-outline" size={22} color={colors.textMuted} />
          <View style={styles.actionText}>
            <Text style={styles.actionLabel}>Read the full policy</Text>
            <Text style={styles.actionSub}>Opens our complete privacy policy</Text>
          </View>
          <Icon name="open-in-new" size={20} color={colors.borderStrong} />
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Deleting your account (Settings → Delete account) is immediate and
          permanently removes your profile, photos, stories, messages, friends, and activity.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingTop: 56,
  },
  back: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  body: { padding: spacing.xxl, paddingBottom: 48 },
  intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: spacing.xxl },
  point: { flexDirection: 'row', marginBottom: 22 },
  pointIcon: { marginTop: 2, width: 30 },
  pointText: { flex: 1 },
  pointTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600', marginBottom: 4 },
  pointBody: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19 },
  divider: { height: 1, backgroundColor: colors.surfaceAlt, marginVertical: spacing.md },
  sectionTitle: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  actionRow: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  actionRowSpaced: { marginTop: spacing.md },
  actionText: { flex: 1, marginLeft: spacing.md },
  actionLabel: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '500' },
  actionSub: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
  footnote: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 18, marginTop: 20 },
});
