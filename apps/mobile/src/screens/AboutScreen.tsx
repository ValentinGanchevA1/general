import React, { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { AccountStackParamList } from '@/navigation/stacks';
import { APP_VERSION, TERMS_OF_SERVICE_URL } from '@/constants/app';
import { NexaWordmark } from '@/components/Brand/NexaWordmark';
import {
  NexaEntityGlyph,
  type NexaEntityGlyphKind,
} from '@/components/Brand/NexaEntityGlyph';
import { ListRow } from '@/components/ListRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { radius, spacing, useAppTheme, type ThemeColors } from '@/theme';

type Nav = NativeStackNavigationProp<AccountStackParamList>;
type Styles = ReturnType<typeof createStyles>;

type FeatureVisual =
  | { icon: string; entityGlyph?: never }
  | { icon?: never; entityGlyph: NexaEntityGlyphKind };

type FeatureProps = FeatureVisual & {
  title: string;
  body: string;
  styles: Styles;
  colors: ThemeColors;
};

function featureGlyphColor(kind: NexaEntityGlyphKind, colors: ThemeColors): string {
  if (kind === 'event') return colors.entityEvent;
  if (kind === 'listing') return colors.entityListing;
  if (kind === 'person') return colors.entityPerson;
  return colors.actionPrimary;
}

function Feature({ icon, entityGlyph, title, body, styles, colors }: FeatureProps): React.JSX.Element {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIconSlot}>
        {entityGlyph ? (
          <NexaEntityGlyph
            kind={entityGlyph}
            size={20}
            color={featureGlyphColor(entityGlyph, colors)}
          />
        ) : icon ? (
          <Icon name={icon} size={20} color={colors.primary} />
        ) : null}
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureBody}>{body}</Text>
      </View>
    </View>
  );
}

export function AboutScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();

  const openTerms = (): void => {
    void Linking.openURL(TERMS_OF_SERVICE_URL);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="About" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.brand}>
          <View style={styles.wordmark}>
            <NexaWordmark />
          </View>
          <Text style={styles.tagline}>a gateway to your local world.</Text>
          <Text style={styles.version}>Version {APP_VERSION}</Text>
        </View>

        <Text style={styles.about}>
          NEXA brings nearby people, events, stories, and local listings into one live map.
          Discover what is happening around you, then interact directly through waves, messages,
          RSVPs, and offers — without a global feed. Precise GPS is used for nearby discovery but
          is coarsened before persistence, and other users never receive your exact coordinates.
        </Text>

        <Text style={styles.sectionTitle}>What you can do</Text>
        <View style={styles.featureGroup}>
          <Feature
            styles={styles}
            colors={colors}
            icon="map"
            title="Map & discovery"
            body="Explore nearby people, events, stories, and listings from a live map with filters, clustering, search, and presence controls."
          />
          <Feature
            styles={styles}
            colors={colors}
            icon="pulse"
            title="Pulse"
            body="See local activity as it happens and act directly from each card — wave back, message, view, RSVP, or open the map context."
          />
          <Feature
            styles={styles}
            colors={colors}
            icon="circle-outline"
            title="Stories"
            body="Share temporary photo or short-video updates with people nearby and react without turning NEXA into a global follower feed."
          />
          <Feature
            styles={styles}
            colors={colors}
            icon="hand-wave"
            title="Waves & chat"
            body="Start with lightweight signals, then move into 1:1 chat when the interaction makes sense. Blocking, rate limits, and safety controls protect the flow."
          />
          <Feature
            styles={styles}
            colors={colors}
            icon="account-group"
            title="Friends & connections"
            body="Manage requests, suggestions, mutual friends, and optional friends-only online presence without exposing private contact details."
          />
          <Feature
            styles={styles}
            colors={colors}
            entityGlyph="event"
            title="Events"
            body="Create, discover, join, and follow nearby events from the map, with RSVP and host interaction built into the local flow."
          />
          <Feature
            styles={styles}
            colors={colors}
            entityGlyph="listing"
            title="Marketplace"
            body="Post local listings, wanted requests, offers, and counters. User-to-user settlement remains outside the app unless a future flow explicitly says otherwise."
          />
          <Feature
            styles={styles}
            colors={colors}
            icon="shield-check"
            title="Verification & trust"
            body="Progressive checks — email, phone, selfie, and optional ID review — add context to interactions without treating a badge as a guarantee of safety."
          />
          <Feature
            styles={styles}
            colors={colors}
            icon="map-marker-radius-outline"
            title="Privacy by design"
            body="Your precise location is never shown to other users. Map presence is privacy-coarsened before storage and can be turned off from Settings."
          />
        </View>

        <Text style={styles.sectionTitle}>Legal & support</Text>
        <View style={styles.group}>
          <ListRow
            variant="inset"
            icon="file-document-outline"
            title="Terms of Service"
            onPress={openTerms}
            trailing={<Icon name="open-in-new" size={18} color={colors.textFaint} />}
          />
          <ListRow
            variant="inset"
            icon="shield-lock"
            title="Privacy Policy"
            onPress={() => navigation.navigate('Privacy')}
          />
          <ListRow
            variant="inset"
            last
            icon="help-circle"
            title="Help & Support"
            onPress={() => navigation.navigate('Help')}
          />
        </View>

        <Text style={styles.copyright}>© {new Date().getFullYear()} NEXA. All rights reserved.</Text>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    body: { padding: spacing.xxl, paddingBottom: 48 },
    brand: {
      width: '100%',
      alignItems: 'center',
      marginTop: spacing.md,
      marginBottom: 28,
    },
    wordmark: { width: '100%', alignItems: 'center', justifyContent: 'center' },
    tagline: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginTop: spacing.md,
      maxWidth: 280,
      lineHeight: 20,
      letterSpacing: 1.1,
    },
    version: { color: colors.textFaint, fontSize: 12, marginTop: 10 },
    about: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: spacing.xxl },
    sectionTitle: {
      color: colors.textFaint,
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.md,
    },
    featureGroup: { marginBottom: 28 },
    feature: { flexDirection: 'row', marginBottom: spacing.lg },
    featureIconSlot: { marginTop: 2, width: 28, alignItems: 'flex-start' },
    featureText: { flex: 1 },
    featureTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
    featureBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    group: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      overflow: 'hidden',
    },
    copyright: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: spacing.xxl },
  });
}
