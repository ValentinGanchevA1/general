// apps/mobile/src/features/events/EventsRail.tsx
//
// "Events near you" — a compact horizontal rail overlaid on the bottom of the
// map. Always shows a "New" card (so the create flow is reachable even with
// zero nearby events — helps cold-start density, ROADMAP R-P3-1), then the
// nearby events. Hidden by the caller while a map entity sheet is open.

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

export function EventsRail({ location }: { location: LatLng | null }): React.JSX.Element | null {
  const navigation = useNavigation<Nav>();
  const { events } = useNearbyEvents(location);

  if (!location) return null;

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
        <TouchableOpacity
          style={[styles.card, styles.newCard]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('EventCreate')}
        >
          <Icon name="plus-circle" size={26} color="#00d4ff" />
          <Text style={styles.newText}>New event</Text>
        </TouchableOpacity>

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
  event, onPress,
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
      <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
      <View style={styles.metaRow}>
        <Icon name="clock-outline" size={12} color="#888" />
        <Text style={styles.meta}>{formatEventDayShort(event.startsAt)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Icon name="account-group" size={12} color="#888" />
        <Text style={styles.meta}>
          {event.attendeeCount}{event.capacity != null ? `/${event.capacity}` : ''}
          {event.myRsvp === 'going' ? ' · going' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 24 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 8 },
  label: { color: '#00d4ff', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  scroll: { paddingHorizontal: 16, gap: 12 },
  card: {
    width: 150,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(18,18,31,0.95)',
    borderWidth: 1,
    borderColor: '#1f1f33',
  },
  newCard: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  newText: { color: '#00d4ff', fontSize: 14, fontWeight: '700' },
  cover: { width: '100%', height: 70, borderRadius: 10, backgroundColor: '#1a1a2e', marginBottom: 8 },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  meta: { color: '#999', fontSize: 12 },
});
