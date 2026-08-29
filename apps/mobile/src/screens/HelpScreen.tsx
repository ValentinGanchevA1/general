import React, { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { AccountStackParamList } from '@/navigation/stacks';
import { SUPPORT_EMAIL, APP_VERSION } from '@/constants/app';
import { track } from '@/lib/analytics';
import { colors, spacing, fontSize } from '@/theme';

type Nav = NativeStackNavigationProp<AccountStackParamList>;

type Faq = { q: string; a: string };

const FAQS: Faq[] = [
  {
    q: 'How does G88 know who is nearby?',
    a: 'While the app is open, your device shares an approximate location (coarsened to about a 120-meter area). We use it for the map, Pulse stories, and nearby activity. Your exact position is never stored.',
  },
  {
    q: 'How do I hide myself from the map?',
    a: 'Settings → Appear on map → turn it off. You stay logged in and can still browse; others will not see you in discovery.',
  },
  {
    q: 'What is Pulse?',
    a: 'Pulse is your local activity feed: trades, alerts, and nearby story rings. Post a story from the strip at the top. Chats, waves, and matches live in Interactions.',
  },
  {
    q: 'How do stories work?',
    a: 'Stories are visible to people nearby and disappear after 24 hours. Posting needs a verified email and an account at least 24 hours old (phone-verified accounts can post sooner). Reactions on stories count like waves toward mutual interest.',
  },
  {
    q: 'What is the Interactions screen?',
    a: 'Interactions is one inbox for chats, waves, pending friend requests, and recent followers. Open a chat from a conversation row, accept or decline friend requests, match a wave, or follow someone back. Your Friends → Requests tab stays available for requests only.',
  },
  {
    q: 'How do friends work?',
    a: 'Send or accept a friend request from a profile or from Interactions. Friends can see when you are online if you allow it in Settings. Unfriending removes the close-friend link but keeps mutual follows unless you unfollow separately.',
  },
  {
    q: 'Why can’t I message someone?',
    a: 'Chat unlocks after mutual interest — a mutual wave, a wave matched with a story reaction, or an existing relationship path. Friends and recent activity sort first. Send a wave or react first when you are still strangers.',
  },
  {
    q: 'What do verification badges mean?',
    a: 'They show progress on the trust ladder: email → phone → ID review. Optional, but they raise trust. Email verification also unlocks story posting. Start from Profile → Verification.',
  },
  {
    q: 'How does local trade work?',
    a: 'Create listings and negotiate in the app. Settlement is offline between you and the other person — G88 does not charge fees or process payments for local trade. Open a trade from Pulse to view details.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Settings → Delete account. Immediate and permanent: profile, photos, stories, messages, friends, and activity are removed.',
  },
  {
    q: 'I found a bug or something feels wrong.',
    a: 'Tap “Email support” below. Include the screen you were on and what you expected — that helps us fix it faster.',
  },
];

function FaqItem({ q, a }: Faq): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.faq}
      onPress={() => setOpen((v) => !v)}
    >
      <View style={styles.faqHead}>
        <Text style={styles.faqQ}>{q}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textFaint} />
      </View>
      {open ? <Text style={styles.faqA}>{a}</Text> : null}
    </TouchableOpacity>
  );
}

export function HelpScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();

  const emailSupport = async (): Promise<void> => {
    track('help_email_support');
    const subject = encodeURIComponent('G88 support request');
    const body = encodeURIComponent(
      `\n\n—\nApp version: ${APP_VERSION}\nPlease describe what happened above this line.`,
    );
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    const ok = await Linking.canOpenURL(url).catch(() => false);
    if (ok) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Email us', `Reach support at ${SUPPORT_EMAIL}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionTitle}>Frequently asked</Text>
        {FAQS.map((f) => (
          <FaqItem key={f.q} {...f} />
        ))}

        <Text style={[styles.sectionTitle, styles.sectionGap]}>Still need help?</Text>
        <TouchableOpacity style={styles.contactRow} onPress={emailSupport}>
          <Icon name="email-outline" size={22} color={colors.primary} />
          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>Email support</Text>
            <Text style={styles.contactSub}>{SUPPORT_EMAIL}</Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.borderStrong} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactRow}
          onPress={() => navigation.navigate('Privacy')}
        >
          <Icon name="shield-lock" size={22} color={colors.textMuted} />
          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>Privacy</Text>
            <Text style={styles.contactSub}>How your data, friends, and location are handled</Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.borderStrong} />
        </TouchableOpacity>
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
  sectionTitle: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  sectionGap: { marginTop: 28 },
  faq: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: spacing.lg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { color: colors.textPrimary, fontSize: 14, fontWeight: '500', flex: 1, marginRight: spacing.md },
  faqA: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19, marginTop: 10 },
  contactRow: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: spacing.lg,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  contactText: { flex: 1, marginLeft: spacing.md },
  contactLabel: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '500' },
  contactSub: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
});
