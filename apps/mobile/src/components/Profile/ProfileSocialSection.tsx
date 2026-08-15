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
              <View key={index} style={[styles.socialLinkItem, last && styles.infoRowLast]}>
                <View style={[styles.socialIcon, { backgroundColor: cfg.color }]}>
                  <Icon name={cfg.icon} size={18} color="#fff" />
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
            <Text style={styles.connectSocialSubtext}>Boost your trust score</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  sectionAction: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  infoCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  socialLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  infoRowLast: { borderBottomWidth: 0 },
  socialIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  socialLinkInfo: { flex: 1, marginLeft: 12 },
  socialLinkName: { color: colors.textPrimary, fontWeight: '600' },
  socialLinkUsername: { color: colors.textMuted, fontSize: 12 },
  connectSocialButton: { alignItems: 'center', padding: 20, gap: 6 },
  connectSocialText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  connectSocialSubtext: { color: colors.textMuted, fontSize: 12 },
});
