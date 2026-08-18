import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors } from '@/theme';

export function ProfileLoadingState(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
    </View>
  );
}

export function ProfileErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" size={40} color={colors.danger} />
        <Text style={styles.errorText}>{message}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: colors.onPrimary, fontWeight: '700' },
});
