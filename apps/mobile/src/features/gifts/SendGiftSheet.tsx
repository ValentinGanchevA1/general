// apps/mobile/src/features/gifts/SendGiftSheet.tsx
//
// Bottom-sheet (Modal) for sending a gift from a user's profile. Shows the
// caller's wallet balance, a catalog grid with unaffordable items disabled,
// an optional note, and a send button. Spends XP via POST /gifts/send.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
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
      appAlert(`Gift sent ${selected.emoji}`, `You sent a ${selected.label} to ${recipientName}.`);
      close();
    } catch (err) {
      const e = err as ApiError;
      appAlert(
        e.code === 'gift.insufficient_xp'
          ? 'Not enough XP'
          : e.code === 'gift.blocked'
            ? 'Blocked'
            : 'Could not send gift',
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
                    styles.giftCell,
                    isSelected && styles.giftCellSelected,
                    !affordable && styles.giftCellDisabled,
                  ]}
                  disabled={!affordable || sending}
                  onPress={() => setSelected(item)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.giftEmoji}>{item.emoji}</Text>
                  <Text style={styles.giftLabel}>{item.label}</Text>
                  <Text style={[styles.giftCost, !affordable && styles.giftCostDisabled]}>
                    {item.costXp} XP
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.note}
            placeholder="Add a note (optional)"
            placeholderTextColor="#555"
            value={message}
            onChangeText={setMessage}
            maxLength={120}
          />

          <TouchableOpacity
            style={[styles.sendBtn, (!selected || sending) && styles.sendBtnDisabled]}
            disabled={!selected || sending}
            onPress={() => void handleSend()}
            activeOpacity={0.9}
          >
            {sending ? (
              <ActivityIndicator color="#0a0a0f" />
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#12121f',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  balanceText: { color: '#FFD700', fontSize: 13, fontWeight: '700' },
  subtitle: { color: '#888', fontSize: 13, marginTop: 4, marginBottom: 16 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  giftCell: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    paddingVertical: 12,
    alignItems: 'center',
  },
  giftCellSelected: {
    borderColor: '#00d4ff',
  },
  giftCellDisabled: {
    opacity: 0.4,
  },
  giftEmoji: { fontSize: 28 },
  giftLabel: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 },
  giftCost: { color: '#FFD700', fontSize: 11, marginTop: 2 },
  giftCostDisabled: { color: '#666' },
  note: {
    marginTop: 14,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendBtn: {
    marginTop: 14,
    backgroundColor: '#00d4ff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    color: '#0a0a0f',
    fontSize: 15,
    fontWeight: '700',
  },
});
