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
import { SUPPORT_EMAIL, APP_VERSION, TERMS_OF_SERVICE_URL } from '@/constants/app';
import { track } from '@/lib/analytics';
import { ListRow } from '@/components/ListRow';
import { colors, spacing, fontSize, useAppTheme } from '@/theme';
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
    a: 'Pulse is your local activity hub: nearby story rings plus waves, chats, and matches. Use the filter chips (All / Waves / Chats / Matches) and act from each card — Wave back, Message, or View. Trades and alerts still surface when they appear in your feed.',
  },
  {
    q: 'How do stories work?',
    a: 'Stories are visible to people nearby and disappear after 24 hours. You can post a photo or a short video. Posting needs a verified email and an account at least 24 hours old (phone-verified accounts can post sooner). Reactions on stories count like waves toward mutual interest.',
  },
  {
    q: 'What is the Interactions screen?',
    a: 'Interactions is a focused inbox for pending friend requests, recent followers, and related social notifications. Waves, chats, and matches also live on Pulse. Your Friends → Requests tab stays available for requests only.',
  },
  {
    q: 'How do friends and online status work?',
    a: 'Send or accept a friend request from a profile. Friends can appear with a distinct map style. Online status is shown only to friends, and only if you allow it in Settings → Friends can see when I’m online.',
  },
  {
    q: 'How does verification work?',
    a: 'Start with email, then phone, then optional ID review. Each step raises your trust level and unlocks more actions. Open Trust Center from Profile or Settings.',
  },
  {
    q: 'Can I delete my account?',
    a: 'Yes. Settings → Account → Delete account. This permanently removes your profile, listings, and messages after a short grace period.',
  },
];

function FaqItem({ q, a }: Faq): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      style={styles.faqCard}
      onPress={() => setOpen((v) => !v)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={q}
    >
      <View style={styles.faqHead}>
        <Text style={styles.faqQ}>{q}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </View>
      {open ? <Text style={styles.faqA}>{a}</Text> : null}
    </TouchableOpacity>
  );
}

export function HelpScreen(): React.JSX.Element {
  const { colors: themeColors } = useAppTheme();

  const navigation = useNavigation<Nav>();

  const emailSupport = async (): Promise<void> => {
    track('support_email_tapped');
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

  const openTerms = (): void => {
    void Linking.openURL(TERMS_OF_SERVICE_URL);
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
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
        <ListRow
          style={styles.rowSpaced}
          icon="file-document-outline"
          title="Terms of Service"
          subtitle="Rules for using G88"
          onPress={openTerms}
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
