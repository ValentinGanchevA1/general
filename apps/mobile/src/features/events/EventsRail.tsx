// apps/mobile/src/features/events/EventsRail.tsx
//
// "Events near you" — compact horizontal rail on the bottom of the map.
// Shows only real nearby events (create lives on the Contextual FAB).
// Hidden entirely when there are none, and by the caller while a sheet is open.

import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { EventSummary, LatLng } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useNearbyEvents } from './useEvents';
import { formatEventDayShort } from './eventFormat';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Rendered height of the rail (label row + one row of fixed-height cards),
 * used by MapScreen to lift ContextualFab clear of this overlay.
 */
export const EVENTS_RAIL_HEIGHT = 24 /* wrap.bottom */ + 22 /* labelRow */ + 178; /* card */

export function EventsRail({ location }: { location: LatLng | null }): React.JSX.Element | null {
  const navigation = useNavigation<Nav>();
  const { events } = useNearbyEvents(location);

  if (!location || events.length === 0) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.labelRow}>
        <Icon name="calendar-star" size={14} color="#00d4ff" />
        <Text style={styles.label}>Events near you</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {events.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            onPress={() => navigation.navigate('EventDetail', { eventId: e.id })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function EventCard({
  event,
  onPress,
}: {
  event: EventSummary;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      {event.coverUrl ? (
        <Image source={{ uri: event.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Icon name="calendar-star" size={22} color="#00d4ff" />
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>
      <View style={styles.metaRow}>
        <Icon name="clock-outline" size={12} color="#888" />
        <Text style={styles.meta}>{formatEventDayShort(event.startsAt)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Icon name="account-group" size={12} color="#888" />
        <Text style={styles.meta}>
          {event.attendeeCount}
          {event.capacity != null ? `/${event.capacity}` : ''}
          {event.myRsvp === 'going' ? ' · going' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 24 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  label: { color: '#00d4ff', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  scroll: { paddingLeft: 16, paddingRight: 16 + 56 /* FAB */ + 24, gap: 12 },
  card: {
    width: 150,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(18,18,31,0.95)',
    borderWidth: 1,
    borderColor: '#1f1f33',
  },
  cover: {
    width: '100%',
    height: 70,
    borderRadius: 10,
    backgroundColor: '#1a1a2e',
    marginBottom: 8,
  },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  meta: { color: '#999', fontSize: 12 },
});
