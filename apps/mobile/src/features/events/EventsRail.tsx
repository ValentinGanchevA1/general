// apps/mobile/src/features/events/EventsRail.tsx
//
// Compact horizontal rail of nearby events on the map bottom edge.
// No section label — cards speak for themselves.
// Hidden when empty or while a map entity sheet is open.
// Bottom offset is owned by mapChromeLayout (safe-area aware).

import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { EventSummary, LatLng } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import {
  EVENTS_RAIL_CARD_HEIGHT,
  EVENTS_RAIL_HEIGHT as LAYOUT_RAIL_HEIGHT,
  mapEventsRailBottom,
} from '@/components/map/mapChromeLayout';
import { useNearbyEvents } from './useEvents';
import { formatEventDayShort } from './eventFormat';
import { colors, spacing } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** @deprecated Prefer EVENTS_RAIL_HEIGHT from mapChromeLayout. */
export const EVENTS_RAIL_HEIGHT = LAYOUT_RAIL_HEIGHT;

interface Props {
  location: LatLng | null;
  /** When true (entity sheet open), hide so cards do not fight the sheet. */
  sheetOpen?: boolean;
}

export function EventsRail({ location, sheetOpen = false }: Props): React.JSX.Element | null {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { events } = useNearbyEvents(location);
  const bottom = mapEventsRailBottom(insets.bottom);

  if (sheetOpen || !location || events.length === 0) return null;

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {events.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            onPress={() => openRootScreen(navigation, 'EventDetail', { eventId: e.id })}
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
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${formatEventDayShort(event.startsAt)}`}
    >
      {event.coverUrl ? (
        <Image source={{ uri: event.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Icon name="calendar-star" size={18} color={colors.primary} />
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
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 18,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  card: {
    width: 168,
    height: EVENTS_RAIL_CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  meta: { color: colors.textFaint, fontSize: 11, marginTop: 3 },
});
