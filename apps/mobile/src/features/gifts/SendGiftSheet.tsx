// apps/mobile/src/features/gifts/SendGiftSheet.tsx
//
// Bottom-sheet (Modal) for sending a gift from a user's profile. Shows the
// caller's wallet balance, a catalog grid with unaffordable items disabled,
// an optional note, and a send button. Spends XP via POST /gifts/send.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ApiError, GiftCatalogItem } from '@g88/shared';
import { sendGift, useGiftBalance, useGiftCatalog } from './useGifts';

interface Props {
  visible: boolean;
  recipientId: string;
  recipientName: string;
  onClose: () => void;
  /** Called with the new wallet balance after a successful send. */
  onSent?: (spendableXp: number) => void;
}

export function SendGiftSheet({
  visible,
  recipientId,
  recipientName,
  onClose,
  onSent,
}: Props): React.JSX.Element {
  const { catalog } = useGiftCatalog();
  const { spendableXp, refresh } = useGiftBalance();
  const [selected, setSelected] = useState<GiftCatalogItem | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Re-check the balance each time the sheet opens.
  useEffect(() => { if (visible) refresh(); }, [visible, refresh]);

  const reset = (): void => { setSelected(null); setMessage(''); };
  const close = (): void => { reset(); onClose(); };

  const canAfford = (item: GiftCatalogItem): boolean => item.costXp <= spendableXp;

  const handleSend = async (): Promise<void> => {
    if (!selected || sending) return;
    setSending(true);
    try {
      const note = message.trim();
      const res = await sendGift({
        recipientId,
        giftId: selected.id,
        ...(note ? { message: note } : {}),
      });
      onSent?.(res.spendableXp);
      Alert.alert(`Gift sent ${selected.emoji}`, `You sent a ${selected.label} to ${recipientName}.`);
      close();
    } catch (err) {
      const e = err as ApiError;
      Alert.alert(
        e.code === 'gift.insufficient_xp' ? 'Not enough XP' : 'Could not send gift',
        e.message || 'Try again in a moment.',
      );
      if (e.code === 'gift.insufficient_xp') refresh();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        {/* Inner press is swallowed so taps inside the sheet don't close it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Send a gift</Text>
            <View style={styles.balancePill}>
              <Icon name="star-four-points" size={13} color="#FFD700" />
              <Text style={styles.balanceText}>{spendableXp} XP</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>to {recipientName}</Text>

          <View style={styles.grid}>
            {catalog.map((item) => {
              const affordable = canAfford(item);
              const isSelected = selected?.id === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.tile,
                    isSelected && styles.tileSelected,
                    !affordable && styles.tileDisabled,
                  ]}
                  disabled={!affordable}
                  onPress={() => setSelected(item)}
                  testID={`gift-tile-${item.id}`}
                >
                  <Text style={styles.tileEmoji}>{item.emoji}</Text>
                  <Text style={styles.tileLabel}>{item.label}</Text>
                  <Text style={[styles.tileCost, !affordable && styles.tileCostDisabled]}>
                    {item.costXp} XP
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.messageInput}
            placeholder="Add a note (optional)"
            placeholderTextColor="#555"
            value={message}
            onChangeText={setMessage}
            maxLength={200}
            multiline
          />

          <TouchableOpacity
            style={[styles.sendBtn, (!selected || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!selected || sending}
          >
            {sending ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.sendBtnText}>
                {selected ? `Send ${selected.label} · ${selected.costXp} XP` : 'Pick a gift'}
              </Text>
            )}
          </TouchableOpacity>
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
    gap: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#333' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD70018',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  balanceText: { color: '#FFD700', fontSize: 13, fontWeight: '700' },
  subtitle: { color: '#888', fontSize: 13, marginTop: -6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  tile: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    gap: 4,
  },
  tileSelected: { borderColor: '#00d4ff', backgroundColor: '#00d4ff12' },
  tileDisabled: { opacity: 0.35 },
  tileEmoji: { fontSize: 30 },
  tileLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tileCost: { color: '#FFD700', fontSize: 12, fontWeight: '700' },
  tileCostDisabled: { color: '#888' },
  messageInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
    maxHeight: 96,
  },
  sendBtn: { backgroundColor: '#00d4ff', borderRadius: 14, padding: 16, alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
