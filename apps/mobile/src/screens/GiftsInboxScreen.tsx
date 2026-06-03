import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ReceivedGift } from '@g88/shared';
import { useGiftBalance, useReceivedGifts } from '@/features/gifts/useGifts';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function GiftRow({ g }: { g: ReceivedGift }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.emoji}>{g.emoji}</Text>
      <View style={styles.info}>
        <Text style={styles.rowTitle}>
          <Text style={styles.sender}>{g.sender.displayName}</Text> sent you a {g.label}
        </Text>
        {g.message ? <Text style={styles.message}>“{g.message}”</Text> : null}
        <Text style={styles.time}>{timeAgo(g.createdAt)}</Text>
      </View>
    </View>
  );
}

export function GiftsInboxScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { gifts, loading, refresh } = useReceivedGifts();
  const { spendableXp, refresh: refreshBalance } = useGiftBalance();

  const onRefresh = (): void => { refresh(); refreshBalance(); };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#00d4ff" />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gifts</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.balanceCard}>
        <Icon name="star-four-points" size={20} color="#FFD700" />
        <Text style={styles.balanceValue}>{spendableXp.toLocaleString()} XP</Text>
        <Text style={styles.balanceLabel}>to spend on gifts</Text>
      </View>

      {gifts.length > 0 ? (
        gifts.map((g) => <GiftRow key={g.id} g={g} />)
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#00d4ff" />
      ) : (
        <View style={styles.empty}>
          <Icon name="gift-outline" size={48} color="#333" />
          <Text style={styles.emptyText}>No gifts yet. Earn XP and send one!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingTop: 56,
  },
  back: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#12121f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFD70033',
  },
  balanceValue: { color: '#FFD700', fontSize: 20, fontWeight: '800' },
  balanceLabel: { color: '#888', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    backgroundColor: '#12121f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f1f33',
    gap: 14,
  },
  emoji: { fontSize: 34 },
  info: { flex: 1, gap: 3 },
  rowTitle: { color: '#ddd', fontSize: 15 },
  sender: { color: '#fff', fontWeight: '700' },
  message: { color: '#aaa', fontSize: 13, fontStyle: 'italic' },
  time: { color: '#666', fontSize: 11, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
