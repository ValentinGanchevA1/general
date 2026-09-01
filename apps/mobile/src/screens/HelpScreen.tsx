import React, { useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
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
    a: 'Send or accept a friend request from a profile. Friends can see when you are online (if you allow it in Settings), and chat sorts friends first. Unfriending does not remove mutual follows.',
  },
  {
    q: 'What do the verification badges mean?',
    a: 'They show progress on the trust ladder: email → phone → ID review. Optional, but they raise trust. Email verification also unlocks story posting. Start from Profile → Verification.',
  },
  {
    q: 'How does local trade work?',
    a: 'Create a listing from the map or Marketplace. Nearby people can wave, chat, or make an offer. Meet in public places; G88 does not process payments yet.',
  },
  {
    q: 'I found a bug or something feels wrong.',
    a: 'Use Email support below with what you were doing and a screenshot if you can. We read every report.',
  },
];

function FaqItem({ q, a }: Faq): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      style={styles.faqCard}
      onPress={() => setOpen((v) => !v)}
      activeOpacity={0.85}
    >
      <View style={styles.faqHead}>
        <Text style={styles.faqQ}>{q}</Text>
        <Icon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={colors.textMuted}
        />
      </View>
      {open ? <Text style={styles.faqA}>{a}</Text> : null}
    </TouchableOpacity>
  );
}

export function HelpScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();

  const emailSupport = async () => {
    track('help.email_support');
    const subject = encodeURIComponent('G88 support');
    const body = encodeURIComponent(
      `App version: ${APP_VERSION}\n\nPlease describe what happened above this line.`,
    );
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    const ok = await Linking.canOpenURL(url).catch(() => false);
    if (ok) {
      await Linking.openURL(url);
    } else {
      appAlert('Email us', `Reach support at ${SUPPORT_EMAIL}`);
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

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Still need help?</Text>
        <TouchableOpacity style={styles.row} onPress={() => void emailSupport()} activeOpacity={0.85}>
          <Icon name="email-outline" size={22} color={colors.primary} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Email support</Text>
            <Text style={styles.rowSub}>{SUPPORT_EMAIL}</Text>
          </View>
          <Icon name="chevron-right" size={22} color={colors.textFaint} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('Privacy')}
          activeOpacity={0.85}
        >
          <Icon name="shield-lock-outline" size={22} color={colors.primary} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Privacy</Text>
            <Text style={styles.rowSub}>How your data, friends, and location are handled</Text>
          </View>
          <Icon name="chevron-right" size={22} color={colors.textFaint} />
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
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  body: { padding: spacing.lg, paddingBottom: 48 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  faqCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  faqQ: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  faqA: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  rowText: { flex: 1 },
  rowTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
});
