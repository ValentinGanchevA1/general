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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { EVENT_LIMITS, RSVP_STATUSES, type PollResult, type RsvpStatus } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
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

type R = RouteProp<RootStackParamList, 'EventDetail'>;

const RSVP_META: Record<RsvpStatus, { label: string; icon: string }> = {
  going: { label: 'Going', icon: 'check-circle' },
  maybe: { label: 'Maybe', icon: 'help-circle' },
  declined: { label: "Can't go", icon: 'close-circle' },
};

export function EventDetailScreen(): React.JSX.Element {
  const route = useRoute<R>();
  const navigation = useNavigation();
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
      <View style={[styles.container, styles.center]}>
        {loading ? (
          <ActivityIndicator color="#00d4ff" />
        ) : (
          <>
            <Icon name="calendar-remove" size={48} color="#555" />
            <Text style={styles.emptyText}>Event not found.</Text>
          </>
        )}
      </View>
    );
  }

  const isHost = event.hostId === myId;
  const full = event.capacity != null && event.attendeeCount >= event.capacity;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#00d4ff" />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Event</Text>
        <View style={{ width: 28 }} />
      </View>

      {event.coverUrl ? (
        <Image source={{ uri: event.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Icon name="calendar-star" size={40} color="#00d4ff" />
        </View>
      )}

      <Text style={styles.title}>{event.title}</Text>

      <View style={styles.metaRow}>
        <Icon name="clock-outline" size={16} color="#00d4ff" />
        <Text style={styles.metaText}>{formatEventWhen(event.startsAt, event.endsAt)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Icon name="account-group" size={16} color="#00d4ff" />
        <Text style={styles.metaText}>
          {event.attendeeCount} going{event.capacity != null ? ` · ${event.capacity} cap` : ''}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Icon name="account" size={16} color="#888" />
        <Text style={styles.metaSubtle}>Hosted by {event.hostDisplayName}</Text>
      </View>

      {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

      {/* ─── RSVP ─────────────────────────────────────────────────────── */}
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
              <Icon name={meta.icon} size={18} color={active ? '#0a0a0f' : '#aaa'} />
              <Text style={[styles.rsvpText, active && styles.rsvpTextActive]}>{meta.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {full && event.myRsvp !== 'going' ? (
        <Text style={styles.fullNote}>This event is at capacity.</Text>
      ) : null}

      {/* ─── Attendees ────────────────────────────────────────────────── */}
      {event.attendees.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Going ({event.attendeeCount})</Text>
          {event.attendees.map((a) => (
            <View key={a.userId} style={styles.attendeeRow}>
              {a.avatarUrl ? (
                <Image source={{ uri: a.avatarUrl }} style={styles.attendeeAvatar} />
              ) : (
                <View style={[styles.attendeeAvatar, styles.attendeeAvatarPlaceholder]}>
                  <Text style={styles.attendeeInitial}>{a.displayName[0]?.toUpperCase() ?? '?'}</Text>
                </View>
              )}
              <Text style={styles.attendeeName}>{a.displayName}</Text>
            </View>
          ))}
        </>
      ) : null}

      {/* ─── Polls ────────────────────────────────────────────────────── */}
      <PollsSection polls={polls} isHost={isHost} eventId={eventId} onChanged={refreshPolls} />

      {/* ─── Q&A ──────────────────────────────────────────────────────── */}
      <QuestionsSection eventId={eventId} questions={questions} onChanged={refreshQuestions} />
    </ScrollView>
  );
}

// ─── Polls ────────────────────────────────────────────────────────────────────

function PollsSection({
  polls, isHost, eventId, onChanged,
}: {
  polls: PollResult[];
  isHost: boolean;
  eventId: string;
  onChanged: () => void;
}): React.JSX.Element {
  const [composing, setComposing] = useState(false);

  const onVote = useCallback(
    async (pollId: string, optionId: string) => {
      try {
        await votePoll(pollId, optionId);
        onChanged();
      } catch {
        /* keep current tally */
      }
    },
    [onChanged],
  );

  return (
    <View>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Polls</Text>
        {isHost ? (
          <TouchableOpacity onPress={() => setComposing((v) => !v)} hitSlop={8}>
            <Icon name={composing ? 'close-circle' : 'plus-circle'} size={22} color="#00d4ff" />
          </TouchableOpacity>
        ) : null}
      </View>
      {composing ? (
        <PollComposer
          eventId={eventId}
          onCreated={() => { setComposing(false); onChanged(); }}
        />
      ) : null}
      {polls.length === 0 && !composing ? (
        <Text style={styles.emptyHint}>No polls yet.</Text>
      ) : (
        polls.map((poll) => (
          <View key={poll.id} style={styles.card}>
            <Text style={styles.pollQuestion}>{poll.question}</Text>
            {poll.options.map((opt) => {
              const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
              const mine = poll.myVote === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={styles.pollOption}
                  disabled={!!poll.closedAt}
                  onPress={() => void onVote(poll.id, opt.id)}
                >
                  <View style={[styles.pollOptionFill, { width: `${pct}%` }, mine && styles.pollOptionFillMine]} />
                  <View style={styles.pollOptionContent}>
                    <Text style={styles.pollOptionLabel}>
                      {mine ? '● ' : ''}{opt.label}
                    </Text>
                    <Text style={styles.pollOptionPct}>{pct}%</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <Text style={styles.pollTotal}>
              {poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}
              {poll.closedAt ? ' · closed' : ''}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function PollComposer({
  eventId, onCreated,
}: {
  eventId: string;
  onCreated: () => void;
}): React.JSX.Element {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [submitting, setSubmitting] = useState(false);

  const setOption = (i: number, val: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  const addOption = () =>
    setOptions((prev) => (prev.length < EVENT_LIMITS.pollOptionsMax ? [...prev, ''] : prev));
  const removeOption = (i: number) =>
    setOptions((prev) => (prev.length > EVENT_LIMITS.pollOptionsMin ? prev.filter((_, idx) => idx !== i) : prev));

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const canSubmit =
    question.trim().length > 0 && filled.length >= EVENT_LIMITS.pollOptionsMin && !submitting;

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createPoll(eventId, { question: question.trim(), options: filled });
      onCreated();
    } catch {
      /* leave the form so the host can retry */
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, eventId, question, filled, onCreated]);

  return (
    <View style={styles.card}>
      <TextInput
        style={styles.composerInput}
        placeholder="Poll question"
        placeholderTextColor="#555"
        value={question}
        onChangeText={setQuestion}
        maxLength={EVENT_LIMITS.pollQuestionMax}
      />
      {options.map((opt, i) => (
        <View key={i} style={styles.composerOptionRow}>
          <TextInput
            style={[styles.composerInput, { flex: 1 }]}
            placeholder={`Option ${i + 1}`}
            placeholderTextColor="#555"
            value={opt}
            onChangeText={(v) => setOption(i, v)}
            maxLength={EVENT_LIMITS.pollOptionMax}
          />
          {options.length > EVENT_LIMITS.pollOptionsMin ? (
            <TouchableOpacity onPress={() => removeOption(i)} hitSlop={8}>
              <Icon name="minus-circle-outline" size={22} color="#888" />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
      {options.length < EVENT_LIMITS.pollOptionsMax ? (
        <TouchableOpacity style={styles.composerAdd} onPress={addOption}>
          <Icon name="plus" size={16} color="#00d4ff" />
          <Text style={styles.composerAddText}>Add option</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={[styles.composerSubmit, !canSubmit && styles.askBtnDisabled]}
        disabled={!canSubmit}
        onPress={() => void onSubmit()}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#0a0a0f" />
        ) : (
          <Text style={styles.composerSubmitText}>Create poll</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Q&A ──────────────────────────────────────────────────────────────────────

function QuestionsSection({
  eventId, questions, onChanged,
}: {
  eventId: string;
  questions: ReturnType<typeof useEvent>['questions'];
  onChanged: () => void;
}): React.JSX.Element {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onAsk = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await askQuestion(eventId, { body: trimmed });
      setBody('');
      onChanged();
    } catch {
      /* leave the text in place so the user can retry */
    } finally {
      setSubmitting(false);
    }
  }, [body, submitting, eventId, onChanged]);

  const onUpvote = useCallback(
    async (questionId: string) => {
      try {
        await upvoteQuestion(questionId);
        onChanged();
      } catch {
        /* keep current count */
      }
    },
    [onChanged],
  );

  return (
    <View>
      <Text style={styles.sectionTitle}>Q&amp;A</Text>
      <View style={styles.askRow}>
        <TextInput
          style={styles.askInput}
          placeholder="Ask the host a question…"
          placeholderTextColor="#555"
          value={body}
          onChangeText={setBody}
          multiline
        />
        <TouchableOpacity
          style={[styles.askBtn, (!body.trim() || submitting) && styles.askBtnDisabled]}
          disabled={!body.trim() || submitting}
          onPress={() => void onAsk()}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#0a0a0f" />
          ) : (
            <Icon name="send" size={18} color="#0a0a0f" />
          )}
        </TouchableOpacity>
      </View>
      {questions.length === 0 ? (
        <Text style={styles.emptyHint}>No questions yet — be the first to ask.</Text>
      ) : (
        questions.map((q) => (
          <View key={q.id} style={styles.questionRow}>
            <TouchableOpacity
              style={[styles.upvoteBtn, q.upvotedByMe && styles.upvoteBtnActive]}
              onPress={() => void onUpvote(q.id)}
            >
              <Icon name="arrow-up-bold" size={16} color={q.upvotedByMe ? '#0a0a0f' : '#00d4ff'} />
              <Text style={[styles.upvoteCount, q.upvotedByMe && styles.upvoteCountActive]}>
                {q.upvotes}
              </Text>
            </TouchableOpacity>
            <View style={styles.questionBody}>
              <Text style={styles.questionText}>{q.body}</Text>
              <Text style={styles.questionMeta}>
                {q.displayName}{q.answered ? ' · answered' : ''}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { paddingBottom: 48 },
  center: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#666', fontSize: 15, marginTop: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 56, paddingBottom: 8,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  cover: { width: '100%', height: 180, backgroundColor: '#12121f' },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },

  title: { color: '#fff', fontSize: 22, fontWeight: '800', paddingHorizontal: 20, marginTop: 16 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 8 },
  metaText: { color: '#ddd', fontSize: 14 },
  metaSubtle: { color: '#888', fontSize: 13 },
  description: { color: '#bbb', fontSize: 15, lineHeight: 22, paddingHorizontal: 20, marginTop: 16 },

  sectionTitle: {
    color: '#fff', fontSize: 16, fontWeight: '700',
    paddingHorizontal: 20, marginTop: 28, marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 18,
  },
  emptyHint: { color: '#666', fontSize: 14, paddingHorizontal: 20 },

  rsvpRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  rsvpBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#12121f', borderWidth: 1, borderColor: '#1f1f33',
  },
  rsvpBtnActive: { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  rsvpBtnDisabled: { opacity: 0.4 },
  rsvpText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  rsvpTextActive: { color: '#0a0a0f' },
  fullNote: { color: '#ff9f43', fontSize: 13, paddingHorizontal: 20, marginTop: 8 },

  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 10 },
  attendeeAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#12121f' },
  attendeeAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  attendeeInitial: { color: '#00d4ff', fontSize: 15, fontWeight: '700' },
  attendeeName: { color: '#ddd', fontSize: 15 },

  card: {
    marginHorizontal: 20, marginBottom: 12, padding: 16,
    backgroundColor: '#12121f', borderRadius: 14, borderWidth: 1, borderColor: '#1f1f33',
  },
  pollQuestion: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  pollOption: {
    height: 40, borderRadius: 10, backgroundColor: '#1a1a2e',
    marginBottom: 8, overflow: 'hidden', justifyContent: 'center',
  },
  pollOptionFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#00d4ff22' },
  pollOptionFillMine: { backgroundColor: '#00d4ff44' },
  pollOptionContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12,
  },
  pollOptionLabel: { color: '#fff', fontSize: 14, fontWeight: '500' },
  pollOptionPct: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  pollTotal: { color: '#666', fontSize: 12, marginTop: 4 },

  composerInput: {
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 14,
    marginBottom: 8,
  },
  composerOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composerAdd: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, marginBottom: 8 },
  composerAddText: { color: '#00d4ff', fontSize: 13, fontWeight: '600' },
  composerSubmit: {
    backgroundColor: '#00d4ff', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  composerSubmitText: { color: '#0a0a0f', fontSize: 14, fontWeight: '700' },

  askRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 20, marginBottom: 14 },
  askInput: {
    flex: 1, backgroundColor: '#12121f', borderWidth: 1, borderColor: '#1f1f33',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 15,
    maxHeight: 100,
  },
  askBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#00d4ff',
    alignItems: 'center', justifyContent: 'center',
  },
  askBtnDisabled: { opacity: 0.4 },

  questionRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 14 },
  upvoteBtn: {
    alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: '#00d4ff18', minWidth: 44,
  },
  upvoteBtnActive: { backgroundColor: '#00d4ff' },
  upvoteCount: { color: '#00d4ff', fontSize: 13, fontWeight: '700', marginTop: 2 },
  upvoteCountActive: { color: '#0a0a0f' },
  questionBody: { flex: 1 },
  questionText: { color: '#eee', fontSize: 15, lineHeight: 21 },
  questionMeta: { color: '#777', fontSize: 12, marginTop: 4 },
});
