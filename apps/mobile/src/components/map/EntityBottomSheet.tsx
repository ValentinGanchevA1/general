import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { EntityPoint } from '@g88/shared';

interface Props {
  point: EntityPoint;
  waving: boolean;
  onClose: () => void;
  onWave?: () => void;
}

export function EntityBottomSheet({ point, waving, onClose, onWave }: Props): React.JSX.Element {
  const title =
    point.kind === 'user'
      ? point.meta.displayName
      : point.kind === 'event'
        ? point.meta.title
        : point.meta.title;

  const subtitle =
    point.kind === 'user'
      ? `Verification: ${point.meta.verification}`
      : point.kind === 'event'
        ? `Starts: ${new Date(point.meta.startsAt).toLocaleString()}`
        : `$${(point.meta.priceCents / 100).toFixed(2)} ${point.meta.currency}`;

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {onWave && (
        <TouchableOpacity
          style={[styles.waveBtn, waving && styles.waveBtnDisabled]}
          onPress={onWave}
          disabled={waving}
        >
          {waving ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.waveBtnText}>👋 Wave</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleGroup: { flex: 1 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#aaa', fontSize: 13, marginTop: 2 },
  closeBtn: { padding: 4 },
  closeText: { color: '#aaa', fontSize: 16 },
  waveBtn: {
    backgroundColor: '#00d4ff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  waveBtnDisabled: { opacity: 0.6 },
  waveBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
