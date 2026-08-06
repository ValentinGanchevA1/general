// apps/mobile/src/features/events/EventsRail.tsx
//
// Compact horizontal rail of nearby events on the map bottom edge.
// No section label — cards speak for themselves. Create lives on the FAB.
// Hidden when empty or while a map entity sheet is open (caller-gated).

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

/** Card row height + bottom inset — MapScreen lifts the FAB by this amount. */
export const EVENTS_RAIL_HEIGHT = 16 /* bottom */ + 72; /* compact horizontal card */

export function EventsRail({ location }: { location: LatLng | null }): React.JSX.Element | null {
  const navigation = useNavigation<Nav>();
  const { events } = useNearbyEvents(location);

  if (!location || events.length === 0) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
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
          <Icon name="calendar-star" size={18} color="#00d4ff" />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {formatEventDayShort(event.startsAt)}
          {' · '}
          {event.attendeeCount}
          {event.capacity != null ? `/${event.capacity}` : ''}
          {event.myRsvp === 'going' ? ' · going' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 16 },
  scroll: { paddingLeft: 12, paddingRight: 12 + 56 + 16, gap: 10 },
  card: {
    width: 168,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(18,18,31,0.95)',
    borderWidth: 1,
    borderColor: '#1f1f33',
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#1a1a2e',
  },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontSize: 13, fontWeight: '700' },
  meta: { color: '#999', fontSize: 11, marginTop: 3 },
});
