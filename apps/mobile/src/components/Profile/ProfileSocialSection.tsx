import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { UserProfile } from '@g88/shared';
import { SOCIAL_PROVIDER_CONFIG } from '@/features/profile/socialConfig';
import { colors, spacing, radius } from '@/theme';

type SocialLink = NonNullable<UserProfile['socialLinks']>[number];

interface Props {
  links: SocialLink[];
  onManage: () => void;
}

export function ProfileSocialSection({ links, onManage }: Props): React.JSX.Element {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Connected accounts</Text>
        <TouchableOpacity onPress={onManage}>
          <Text style={styles.sectionAction}>Manage</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.infoCard}>
        {links.length > 0 ? (
          links.map((link, index) => {
            const cfg = SOCIAL_PROVIDER_CONFIG[link.provider];
            const last = index === links.length - 1;
            return (
              <View
                key={`${link.provider}:${link.username ?? index}`}
                style={[styles.socialLinkItem, last && styles.infoRowLast]}
              >
                <View style={[styles.socialIcon, { backgroundColor: cfg.color }]}>
                  <Icon name={cfg.icon} size={18} color={colors.textPrimary} />
                </View>
                <View style={styles.socialLinkInfo}>
                  <Text style={styles.socialLinkName}>{cfg.label}</Text>
                  {link.username ? (
                    <Text style={styles.socialLinkUsername}>@{link.username}</Text>
                  ) : null}
                </View>
                {link.verified ? <Icon name="check-circle" size={18} color={colors.success} /> : null}
              </View>
            );
          })
        ) : (
          <TouchableOpacity style={styles.connectSocialButton} onPress={onManage}>
            <Icon name="link-plus" size={22} color={colors.primary} />
            <Text style={styles.connectSocialText}>Connect social accounts</Text>
            <Text style={styles.connectSocialSubtext}>Boost trust score</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  sectionAction: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  infoCard: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  socialLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoRowLast: { borderBottomWidth: 0 },
  socialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  socialLinkInfo: { flex: 1 },
  socialLinkName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  socialLinkUsername: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  connectSocialButton: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  connectSocialText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  connectSocialSubtext: { color: colors.textMuted, fontSize: 12 },
});
