// apps/mobile/src/screens/EventDetailScreen.tsx
//
// P3.5 event detail: RSVP + attendee list + live polls + Q&A. Reads via
// useEvent (detail + polls + questions) and mutates through the events API
// helpers, refreshing the affected slice after each write.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { colors } from '@/theme';

import { EVENT_LIMITS, RSVP_STATUSES, type PollResult, type RsvpStatus } from '@g88/shared';
import type { EventsStackParamList } from '@/navigation/stacks';
import { useAppSelector } from '@/hooks/redux';
import {
  askQuestion,
  createPoll,
  rsvpToEvent,
  upvoteQuestion,
  useEvent,
  votePoll,
} from '@/features/events/useEvents';
import { formatEventWhen } from '@/features/events/eventFormat';
import { openRootScreen, openViaRef } from '@/navigation/openRootScreen';

type R = RouteProp<EventsStackParamList, 'EventDetail'>;

const RSVP_META: Record<RsvpStatus, { label: string; icon: string }> = {
  going: { label: 'Going', icon: 'check-circle' },
  maybe: { label: 'Maybe', icon: 'help-circle' },
  declined: { label: "Can't go", icon: 'close-circle' },
};

export function EventDetailScreen(): React.JSX.Element {
  const route = useRoute<R>();
  const navigation = useNavigation<NativeStackNavigationProp<EventsStackParamList>>();
  const { eventId } = route.params;
  const myId = useAppSelector((s) => s.auth.user?.id);

  const {
    event, polls, questions, loading, refresh, refreshPolls, refreshQuestions,
  } = useEvent(eventId);
  const [rsvpBusy, setRsvpBusy] = useState(false);

  const onRsvp = useCallback(
    async (status: RsvpStatus) => {
      setRsvpBusy(true);
      try {
        await rsvpToEvent(eventId, status);
        refresh();
      } catch {
        /* surfaced via no-op; detail refresh keeps state truthful */
      } finally {
        setRsvpBusy(false);
      }
    },
    [eventId, refresh],
  );

  if (!event) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Event" />
        <View style={[styles.container, styles.center]}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <EmptyState
              variant="plain"
              icon="calendar-remove"
              title="Event not found"
              body="This event may have been removed or the link is invalid."
            />
          )}
        </View>
      </View>
    );
  }

  const isHost = event.hostId === myId;
  const full = event.capacity != null && event.attendeeCount >= event.capacity;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <ScreenHeader title="Event" />

      {event.coverUrl ? (
        <Image source={{ uri: event.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Icon name="calendar-star" size={40} color={colors.primary} />
        </View>
      )}

      <Text style={styles.title}>{event.title}</Text>

      <View style={styles.metaRow}>
        <Icon name="clock-outline" size={16} color={colors.primary} />
        <Text style={styles.metaText}>{formatEventWhen(event.startsAt, event.endsAt)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Icon name="account-group" size={16} color={colors.primary} />
        <Text style={styles.metaText}>
          {event.attendeeCount} going{event.capacity != null ? ` · ${event.capacity} cap` : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.metaRow}
        onPress={() => openRootScreen(navigation, 'UserProfile', { userId: event.hostId })}
        activeOpacity={0.7}
      >
        <Icon name="account" size={16} color={colors.textMuted} />
        <Text style={styles.metaSubtle}>Hosted by {event.hostDisplayName}</Text>
        <Icon name="chevron-right" size={18} color={colors.textFaint} />
      </TouchableOpacity>

      {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

      <Text style={styles.sectionTitle}>Your RSVP</Text>
      <View style={styles.rsvpRow}>
        {RSVP_STATUSES.map((status) => {
          const active = event.myRsvp === status;
          const disabled = rsvpBusy || (status === 'going' && full && !active);
          const meta = RSVP_META[status];
          return (
            <TouchableOpacity
              key={status}
              style={[styles.rsvpBtn, active && styles.rsvpBtnActive, disabled && styles.rsvpBtnDisabled]}
              disabled={disabled}
              onPress={() => void onRsvp(status)}
            >
              <Icon name={meta.icon} size={18} color={active ? colors.bg : colors.textSecondary} />
              <Text style={[styles.rsvpText, active && styles.rsvpTextActive]}>{meta.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {full && event.myRsvp !== 'going' ? (
        <Text style={styles.fullNote}>This event is at capacity.</Text>
      ) : null}

      {event.attendees.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Going ({event.attendeeCount})</Text>
          {event.attendees.map((a) => (
            <TouchableOpacity
              key={a.userId}
              style={styles.attendeeRow}
              activeOpacity={0.7}
              onPress={() => openRootScreen(navigation, 'UserProfile', { userId: a.userId })}
            >
              {a.avatarUrl ? (
                <Image source={{ uri: a.avatarUrl }} style={styles.attendeeAvatar} />
              ) : (
                <View style={[styles.attendeeAvatar, styles.attendeeAvatarPlaceholder]}>
                  <Text style={styles.attendeeInitial}>{a.displayName[0]?.toUpperCase() ?? '?'}</Text>
                </View>
              )}
              <Text style={styles.attendeeName}>{a.displayName}</Text>
              <Icon name="chevron-right" size={20} color={colors.textFaint} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      <PollsSection polls={polls} isHost={isHost} eventId={eventId} onChanged={refreshPolls} />
      <QuestionsSection eventId={eventId} questions={questions} onChanged={refreshQuestions} />
    </ScrollView>
  );
}

// NOTE: remainder of file restored in follow-up if truncated — full file on disk
