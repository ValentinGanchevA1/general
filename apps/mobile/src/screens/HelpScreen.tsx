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

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { SUPPORT_EMAIL, APP_VERSION } from '@/constants/app';
import { track } from '@/lib/analytics';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
    a: 'Pulse is your activity hub: chats, waves, trades, alerts, matches, and nearby story rings. Post a story from the strip at the top of Pulse.',
  },
  {
    q: 'How do stories work?',
    a: 'Stories are visible to people nearby and disappear after 24 hours. Posting needs a verified email and an account at least 24 hours old (phone-verified accounts can post sooner). Reactions on stories count like waves.',
  },
  {
    q: 'Why can’t I message someone?',
    a: 'Chat unlocks after mutual interest — a mutual wave, or a wave matched with a story reaction. Send a wave or react first; when they reciprocate, the chat opens.',
  },
  {
    q: 'What do verification badges mean?',
    a: 'They show confirmed email, phone, or ID review. Optional, but they raise trust. Start from Profile → Verification. Email verification also unlocks story posting.',
  },
  {
    q: 'How does local trade work?',
    a: 'Create listings and negotiate in the app. Settlement is offline between you and the other person — G88 does not charge fees or process payments for local trade.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Settings → Delete account. Immediate and permanent: profile, photos, stories, messages, and activity are removed.',
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
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} color="#666" />
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
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help &amp; Support</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionTitle}>Frequently asked</Text>
        {FAQS.map((f) => (
          <FaqItem key={f.q} {...f} />
        ))}

        <Text style={[styles.sectionTitle, styles.sectionGap]}>Still need help?</Text>
        <TouchableOpacity style={styles.contactRow} onPress={emailSupport}>
          <Icon name="email-outline" size={22} color="#00d4ff" />
          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>Email support</Text>
            <Text style={styles.contactSub}>{SUPPORT_EMAIL}</Text>
          </View>
          <Icon name="chevron-right" size={24} color="#444" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactRow}
          onPress={() => navigation.navigate('Privacy')}
        >
          <Icon name="shield-lock" size={22} color="#888" />
          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>Privacy</Text>
            <Text style={styles.contactSub}>How your data and location are handled</Text>
          </View>
          <Icon name="chevron-right" size={24} color="#444" />
        </TouchableOpacity>
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
  sectionTitle: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  sectionGap: { marginTop: 28 },
  faq: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { color: '#fff', fontSize: 14, fontWeight: '500', flex: 1, marginRight: 12 },
  faqA: { color: '#888', fontSize: 13, lineHeight: 19, marginTop: 10 },
  contactRow: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  contactText: { flex: 1, marginLeft: 12 },
  contactLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  contactSub: { color: '#666', fontSize: 12, marginTop: 2 },
});
