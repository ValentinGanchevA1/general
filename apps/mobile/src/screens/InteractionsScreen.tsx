import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { fetchInteractions } from '../store/interactionsSlice';
import { useInteractionsRealtime } from '../hooks/useInteractionsRealtime';
import { InteractionRow } from '../components/interactions/InteractionRow';
import type { RootState, AppDispatch } from '../store';
import type { Interaction } from '@shared/types/interaction';

export function InteractionsScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const { items, loading, loadingMore, nextCursor } = useSelector(
    (s: RootState) => s.interactions
  );

  useInteractionsRealtime();

  useEffect(() => {
    dispatch(fetchInteractions());
  }, [dispatch]);

  const onRefresh = useCallback(() => {
    dispatch(fetchInteractions());
  }, [dispatch]);

  const onEndReached = useCallback(() => {
    if (nextCursor && !loadingMore) {
      dispatch(fetchInteractions(nextCursor));
    }
  }, [dispatch, nextCursor, loadingMore]);

  const renderItem = useCallback(
    ({ item }: { item: Interaction }) => (
      <InteractionRow
        item={item}
        onPress={() => {
          if (item.type === 'chat') {
            navigation.navigate('Chat', { chatId: (item as any).chatId });
          } else {
            navigation.navigate('Profile', { userId: item.userId });
          }
        }}
        onMatchPress={() => {
          navigation.navigate('MatchFlow', { userId: item.userId, from: 'wave' });
        }}
      />
    ),
    [navigation]
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={items}
        renderItem={renderItem}
        estimatedItemSize={76}
        keyExtractor={(item) => item.id}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#00C853" />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>No interactions yet</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color="#00C853" /> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0F' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#888', fontSize: 16 },
});
