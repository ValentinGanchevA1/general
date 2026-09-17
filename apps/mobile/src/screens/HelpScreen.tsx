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
import { ListRow } from '@/components/ListRow';
import { colors, spacing, fontSize } from '@/theme';
import { ScreenHeader } from '@/components/ScreenHeader';

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
    a: 'Pulse is your local activity feed: trades, alerts, and nearby story rings. Post a story from the strip at the top. Chats, waves, and friend activity live in Interactions — not in Pulse.',
  },
  {
    q: 'How do stories work?',
    a: 'Stories are visible to people nearby and disappear after 24 hours. You can post a photo or a short video. Posting needs a verified email and an account at least 24 hours old (phone-verified accounts can post sooner). Reactions on stories count like waves toward mutual interest.',
  },
  {
    q: 'What is the Interactions screen?',
    a: 'Interactions is one inbox for chats, inbound waves, pending friend requests, and recent followers. On a wave you can Match or open Map to see their pin when they have one. Your Friends → Requests tab stays available for requests only.',
  },
  {
    q: 'How do friends and online status work?',
    a: 'Send or accept a friend request from a profile. Friends can appear with a distinct map style. Online status is shown only to friends, and only if you allow it in Settings → Friends can see when I’m online. Unfriending does not remove mutual follows.',
  },
  {
    q: 'How do I find someone on the map?',
    a: 'From a profile use View on map when they have a public pin. From Interactions, use Map on an inbound wave. The map centers on their coarsened pin and opens their card when available.',
  },
  {
    q: 'What do the verification badges mean?',
    a: 'They show progress on the trust ladder: email → phone → ID review. Optional, but they raise trust. Email verification unlocks story posting. Start from Settings → Verification. ID review is assisted by automated face checks and always finished by a human.',
  },
  {
    q: 'How does local trade work?',
    a: 'Create a listing (for sale or wanted) from the map or Marketplace. Nearby people can message the seller, wave, or make an offer and counter. Meet in public places; G88 does not process payments.',
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
      <ScreenHeader title="Help & Support" />

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionTitle}>Frequently asked</Text>
        {FAQS.map((f) => (
          <FaqItem key={f.q} {...f} />
        ))}

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Still need help?</Text>
        <ListRow
          icon="email-outline"
          title="Email support"
          subtitle={SUPPORT_EMAIL}
          onPress={() => void emailSupport()}
        />
        <ListRow
          style={styles.rowSpaced}
          icon="shield-lock-outline"
          title="Privacy"
          subtitle="How your data, friends, and location are handled"
          onPress={() => navigation.navigate('Privacy')}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
  faqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  faqQ: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  faqA: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.md },
  rowSpaced: { marginTop: spacing.sm },
});
