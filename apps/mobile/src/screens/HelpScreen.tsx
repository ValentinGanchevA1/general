import React, { useMemo, useState } from 'react';
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
import { spacing, fontSize, useAppTheme, type ThemeColors } from '@/theme';
import { ScreenHeader } from '@/components/ScreenHeader';
import { NEXA_HELP_FAQS, type HelpFaq } from './helpFaqs';

type Nav = NativeStackNavigationProp<AccountStackParamList>;

function FaqItem({ q, a }: HelpFaq): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();

  const emailSupport = async (): Promise<void> => {
    track('help.email_support');
    const subject = encodeURIComponent('NEXA support');
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
    <View style={styles.container}>
      <ScreenHeader title="Help & Support" />

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionTitle}>Frequently asked</Text>
        {NEXA_HELP_FAQS.map((f) => (
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
          subtitle="Rules for using NEXA"
          onPress={openTerms}
        />
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
}
