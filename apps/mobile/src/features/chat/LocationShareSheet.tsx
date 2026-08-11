import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { LocationShareDuration } from '@g88/shared';

interface Props {
  visible: boolean;
  starting?: boolean;
  onClose: () => void;
  onShare: (duration: LocationShareDuration) => void;
}

const OPTIONS: Array<{ value: LocationShareDuration; label: string; hint: string }> = [
  { value: '15m', label: '15 minutes', hint: 'Ends automatically' },
  { value: '60m', label: '1 hour', hint: 'Ends automatically' },
  { value: 'until_off', label: 'Until I turn it off', hint: 'You stop sharing' },
];

export function LocationShareSheet({
  visible,
  starting = false,
  onClose,
  onShare,
}: Props): React.JSX.Element {
  const [duration, setDuration] = useState<LocationShareDuration>('15m');

  const handleShare = (): void => {
    if (starting) return;
    onShare(duration);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Share live location</Text>
          <Text style={styles.subtitle}>
            They will see your exact location while sharing is on.
          </Text>

          <View style={styles.options}>
            {OPTIONS.map((opt) => {
              const selected = duration === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setDuration(opt.value)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.radio, selected && styles.radioOn]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                    <Text style={styles.optionHint}>{opt.hint}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={starting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.shareBtn, starting && styles.shareBtnDisabled]}
              onPress={handleShare}
              disabled={starting}
            >
              {starting ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.shareText}>Share</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#12121f',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#888', fontSize: 13, lineHeight: 18, marginTop: -6 },
  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  optionSelected: { borderColor: '#00d4ff', backgroundColor: '#00d4ff12' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: '#00d4ff' },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00d4ff',
  },
  optionText: { flex: 1 },
  optionLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  optionHint: { color: '#888', fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  cancelText: { color: '#ccc', fontWeight: '600', fontSize: 15 },
  shareBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#00d4ff',
    alignItems: 'center',
  },
  shareBtnDisabled: { opacity: 0.5 },
  shareText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
