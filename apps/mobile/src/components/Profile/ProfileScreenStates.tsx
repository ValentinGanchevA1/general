import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing } from '@/theme';

export function ProfileLoadingState(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
    </View>
  );
}

interface ErrorProps {
  message?: string | null;
  onRetry: () => void;
  onLogout: () => void;
}

export function ProfileErrorState({ message, onRetry, onLogout }: ErrorProps): React.JSX.Element {
  return (
    <View style={[styles.container, styles.centerFill]}>
      <Icon name="alert-circle-outline" size={48} color={colors.textFaint} />
      <Text style={styles.errorTitle}>Couldn't load your profile</Text>
      <Text style={styles.errorMsg}>{message ?? 'Something went wrong. Please try again.'}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onLogout} style={{ marginTop: 8 }}>
        <Text style={styles.errorLogout}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerFill: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  errorTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 8 },
  errorMsg: { color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: colors.onPrimary, fontWeight: '700' },
  errorLogout: { color: colors.danger, fontWeight: '600' },
});
