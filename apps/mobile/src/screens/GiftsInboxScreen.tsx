import React, { useState } from 'react';
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

import type { ReceivedGift, SentGift } from '@g88/shared';
import { useGiftBalance, useReceivedGifts, useSentGifts } from '@/features/gifts/useGifts';

type Tab = 'received' | 'sent';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ReceivedRow({ g }: { g: ReceivedGift }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.emoji}>{g.emoji}</Text>
      <View style={styles.info}>
        <Text style={styles.rowTitle}>
          <Text style={styles.peer}>{g.sender.displayName}</Text> sent you a {g.label}
        </Text>
        {g.message ? <Text style={styles.message}>“{g.message}”</Text> : null}
        <Text style={styles.time}>{timeAgo(g.createdAt)}</Text>
      </View>
    </View>
  );
}

function SentRow({ g }: { g: SentGift }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.emoji}>{g.emoji}</Text>
      <View style={styles.info}>
        <Text style={styles.rowTitle}>
          You sent a {g.label} to <Text style={styles.peer}>{g.recipient.displayName}</Text>
        </Text>
        {g.message ? <Text style={styles.message}>“{g.message}”</Text> : null}
        <Text style={styles.time}>
          {g.costXp} XP · {timeAgo(g.createdAt)}
        </Text>
      </View>
    </View>
  );
}

export function GiftsInboxScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const [tab, setTab] = useState<Tab>('received');
  const { gifts: received, loading: loadingReceived, refresh: refreshReceived } = useReceivedGifts();
  const { gifts: sent, loading: loadingSent, refresh: refreshSent } = useSentGifts();
  const { spendableXp, refresh: refreshBalance } = useGiftBalance();

  const loading = tab === 'received' ? loadingReceived : loadingSent;
  const onRefresh = (): void => {
    refreshReceived();
    refreshSent();
    refreshBalance();
  };

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

      <View style={styles.tabs}>
        {(['received', 'sent'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'received' ? 'Received' : 'Sent'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'received' ? (
        received.length > 0 ? (
          received.map((g) => <ReceivedRow key={g.id} g={g} />)
        ) : loadingReceived ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#00d4ff" />
        ) : (
          <View style={styles.empty}>
            <Icon name="gift-outline" size={48} color="#333" />
            <Text style={styles.emptyText}>No gifts yet. Earn XP and send one!</Text>
          </View>
        )
      ) : sent.length > 0 ? (
        sent.map((g) => <SentRow key={g.id} g={g} />)
      ) : loadingSent ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#00d4ff" />
      ) : (
        <View style={styles.empty}>
          <Icon name="gift-outline" size={48} color="#333" />
          <Text style={styles.emptyText}>You haven't sent any gifts yet.</Text>
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
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#12121f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFD70033',
  },
  balanceValue: { color: '#FFD700', fontSize: 20, fontWeight: '800' },
  balanceLabel: { color: '#888', fontSize: 13 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 14, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#12121f',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f1f33',
  },
  tabActive: { backgroundColor: '#00d4ff18', borderColor: '#00d4ff' },
  tabText: { color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#00d4ff' },
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
  peer: { color: '#fff', fontWeight: '700' },
  message: { color: '#aaa', fontSize: 13, fontStyle: 'italic' },
  time: { color: '#666', fontSize: 11, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
