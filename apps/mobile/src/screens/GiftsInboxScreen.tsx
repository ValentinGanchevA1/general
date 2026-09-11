import React, { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ReceivedGift, SentGift } from '@g88/shared';
import { useGiftBalance, useReceivedGifts, useSentGifts } from '@/features/gifts/useGifts';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonListRow } from '@/components/Skeleton';
import { colors } from '@/theme';

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
    <View style={styles.container}>
      <ScreenHeader title="Gifts" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.balanceCard}>
          <Icon name="star-four-points" size={20} color={colors.premium} />
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
            <>
              <SkeletonListRow />
              <SkeletonListRow />
              <SkeletonListRow />
            </>
          ) : (
            <EmptyState
              variant="plain"
              icon="gift-outline"
              title="No gifts yet"
              body="Earn XP and send one to a friend nearby."
            />
          )
        ) : sent.length > 0 ? (
          sent.map((g) => <SentRow key={g.id} g={g} />)
        ) : loadingSent ? (
          <>
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
          </>
        ) : (
          <EmptyState
            variant="plain"
            icon="gift-outline"
            title="No gifts sent"
            body="You haven't sent any gifts yet."
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.premiumBorderSoft,
  },
  balanceValue: { color: colors.premium, fontSize: 20, fontWeight: '800' },
  balanceLabel: { color: colors.textMuted, fontSize: 13 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 14, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primaryMutedBg, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  emoji: { fontSize: 34 },
  info: { flex: 1, gap: 3 },
  rowTitle: { color: colors.textSecondary, fontSize: 15 },
  peer: { color: colors.textPrimary, fontWeight: '700' },
  message: { color: colors.textSecondary, fontSize: 13, fontStyle: 'italic' },
  time: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
});
