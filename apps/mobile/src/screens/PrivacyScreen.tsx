import React, { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { AccountStackParamList } from '@/navigation/stacks';
import { PRIVACY_POLICY_URL } from '@/constants/app';
import { ListRow } from '@/components/ListRow';
import { spacing, fontSize, useAppTheme, type ThemeColors } from '@/theme';
import { ScreenHeader } from '@/components/ScreenHeader';

type Nav = NativeStackNavigationProp<AccountStackParamList>;

type PrivacyStyles = ReturnType<typeof createStyles>;

function Point({
  icon,
  title,
  body,
  colors,
  styles,
}: {
  icon: string;
  title: string;
  body: string;
  colors: ThemeColors;
  styles: PrivacyStyles;
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
 * Native summary of NEXA privacy posture. Legal text of record remains the
 * hosted policy (PRIVACY_POLICY_URL) — this screen is product-aligned explainer only.
 */
export function PrivacyScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();

  const openFullPolicy = (): void => {
    void Linking.openURL(PRIVACY_POLICY_URL);
  };

  const point = (icon: string, title: string, body: string): React.JSX.Element => (
    <Point icon={icon} title={title} body={body} colors={colors} styles={styles} />
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Privacy" />

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro}>
          Privacy is a core design constraint of NEXA. Here is what that means with
          the features we ship today.
        </Text>

        {point('map-marker-off', 'Your exact location is never stored', 'Precise GPS is coarsened to roughly a 120-meter area before anything is saved. Other users only ever see that coarsened neighborhood — never a point on your doorstep.')}
        {point('map-clock', 'Foreground only', 'Location is used only while the app is open (map, Pulse stories, nearby feed). NEXA does not track you in the background.')}
        {point('eye-off', 'You control who sees you', 'Hide from discovery any time in Settings → Appear on map. You stay logged in and can still browse; others will not see you in discovery.')}
        {point('account-group', 'Friends stay intentional', 'Friend requests are explicit. Online presence is shown only to friends, and only if you allow it in Settings → Friends can see when I’m online. Your friends list is not sold or used for ads. Unfriending does not automatically tear down public follows.')}
        {point('circle-outline', 'Stories stay local and temporary', 'Stories are visible to people nearby and expire after 24 hours. Posting requires a verified email and a minimum account age (phone-verified accounts can post sooner). Media is not kept as a permanent public archive.')}
        {point('hand-wave', 'Interactions are intentional', 'Waves, story reactions, and friend requests are first-class signals. Chat prioritizes people you already know; cold outreach stays lightweight until interest is mutual. Inbound waves can open a map pin only when the sender has a public coarsened location.')}
        {point('card-account-details-outline', 'ID verification is assist-only', 'If you submit ID, automated face checks help reviewers — a human always decides. Selfie and ID images are used for verification only, not for advertising or sale.')}
        {point('account-eye', 'What others can see', 'Display name, photos, bio, interests, badges, coarsened location, and public storyline — never your email, phone number, or precise position.')}
        {point('storefront-outline', 'Trading stays offline', 'Listings and offers are free. Settlement happens between people offline — we do not process payments or store card data for local trade.')}
        {point('shield-lock', 'Encrypted and minimized', 'Data is encrypted in transit. Passwords are salted hashes only. Sign-in tokens stay in your device keystore. Diagnostics are scrubbed of location and tokens.')}
        {point('cancel', 'No selling, no ads', 'We do not sell your personal data and we do not show third-party advertising.')}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Manage your data</Text>
        <ListRow
          icon="cog"
          title="Visibility & account"
          subtitle="Map presence, friends online, blocked users, delete account"
          onPress={() => navigation.navigate('Settings')}
        />
        <ListRow
          style={styles.rowSpaced}
          icon="file-document-outline"
          title="Read the full policy"
          subtitle="Opens our complete privacy policy"
          onPress={openFullPolicy}
          trailing={<Icon name="open-in-new" size={20} color={colors.textFaint} />}
        />

        <Text style={styles.footnote}>
          Deleting your account (Settings → Delete account) is immediate and
          permanently removes your profile, photos, stories, messages, friends, and activity.
        </Text>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    body: { padding: spacing.xxl, paddingBottom: 48 },
    intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: spacing.xxl },
    point: { flexDirection: 'row', marginBottom: 22 },
    pointIcon: { marginTop: 2, width: 30 },
    pointText: { flex: 1 },
    pointTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600', marginBottom: 4 },
    pointBody: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
    sectionTitle: {
      color: colors.textFaint,
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.md,
      marginTop: spacing.sm,
    },
    rowSpaced: { marginTop: spacing.md },
    footnote: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 18, marginTop: 20 },
  });
}
