import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { ListRow } from '@/components/ListRow';
import { APP_VERSION } from '@/constants/app';
import { colors, spacing, radius, fontSize } from '@/theme';

/** Logical menu destinations — resolved via openRootScreen → Account stack. */
type MenuRoute = 'Settings' | 'Privacy' | 'Help' | 'About' | 'Subscription';

interface Props {
  isPaid: boolean;
  onNavigate: (route: MenuRoute) => void;
  onLogout: () => void;
}

const MENU: { label: string; icon: string; route: MenuRoute }[] = [
  { label: 'Settings', icon: 'cog', route: 'Settings' },
  { label: 'Privacy', icon: 'shield-lock', route: 'Privacy' },
  { label: 'Help & Support', icon: 'help-circle', route: 'Help' },
  { label: 'About', icon: 'information', route: 'About' },
];

export function ProfileMenuSection({ isPaid, onNavigate, onLogout }: Props): React.JSX.Element {
  return (
    <>
      {!isPaid ? (
        <TouchableOpacity style={styles.upgradeCard} onPress={() => onNavigate('Subscription')}>
          <View style={styles.upgradeContent}>
            <Icon name="crown" size={26} color={colors.premium} />
            <View style={styles.upgradeText}>
              <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
              <Text style={styles.upgradeSubtitle}>More reach · who viewed you</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.menuSection}>
        {MENU.map((item, index) => (
          <ListRow
            key={item.route}
            variant="inset"
            last={index === MENU.length - 1}
            icon={item.icon}
            title={item.label}
            onPress={() => onNavigate(item.route)}
            accessibilityLabel={item.label}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Icon name="logout" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version {APP_VERSION}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.premiumBorder,
  },
  upgradeContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  upgradeText: { flex: 1 },
  upgradeTitle: { color: colors.premium, fontWeight: '700', fontSize: 15 },
  upgradeSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  menuSection: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: 14,
    backgroundColor: 'rgba(255, 68, 68, 0.12)',
    borderRadius: radius.md,
  },
  logoutText: { color: colors.danger, fontWeight: '600', fontSize: 15 },
  version: {
    textAlign: 'center',
    color: colors.textFaint,
    marginVertical: spacing.xl,
    fontSize: fontSize.xs,
  },
});
