import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { EVENT_REVIEW_LIMITS, EVENT_REVIEW_REPORT_REASONS, EVENT_REVIEW_TAGS, EVENT_REVIEW_TAG_LABELS, type EventDetail, type EventReview, type EventReviewReportReason } from '@g88/shared';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useAppTheme, spacing, radius, fontSize, layout, type ThemeColors } from '@/theme';
import { openViaRef } from '@/navigation/openRootScreen';
import { appAlert } from '@/ui/appAlert';
import { changeReviewDraft, editEventReview, eventReviewAction, loadEventReviews, moreEventReviews, saveEventReview } from './eventReviewsSlice';
import { filledReviewStar, emptyReviewStar } from './reviewStars';

const REASONS = {
  own_event: 'Hosts cannot review their own events.', event_ongoing: 'Reviews open after the event ends.',
  attendance_unconfirmed: 'Reviews require confirmed attendance. Going alone does not confirm attendance.',
  moderated: 'Your review is unavailable. Contact support if you need help.', eligible: 'Attendance confirmed',
} as const;
const REPORT_LABELS: Record<EventReviewReportReason, string> = {
  abuse: 'Abuse', spam: 'Spam', privacy: 'Privacy concern', attendance_dispute: 'Attendance dispute',
};

export function EventReviewsSection({ event, isHost, onEnded }: { event: EventDetail; isHost: boolean; onEnded: () => void }): React.JSX.Element {
  const dispatch = useAppDispatch();
  const e = useAppSelector(s => s.eventReviews.entries[event.id]);
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [now, setNow] = useState(() => Date.now());
  const refresh = useCallback(() => { void dispatch(loadEventReviews({ eventId: event.id, isHost })); }, [dispatch, event.id, isHost]);
  useEffect(() => { refresh(); }, [refresh, event.myRsvp, event.endsAt]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') { setNow(Date.now()); refresh(); } });
    return () => listener.remove();
  }, [refresh]);
  useEffect(() => {
    if (!e?.context) return;
    const current = Date.parse(e.context.serverNow) + Math.max(0, Date.now() - e.receivedAt);
    const deadlines = [event.startsAt, event.endsAt, e.context.myReview?.editableUntil]
      .filter((value): value is string => Boolean(value)).map(Date.parse).filter(value => value > current);
    if (!deadlines.length) return;
    const timer = setTimeout(() => { setNow(Date.now()); refresh(); }, Math.min(Math.min(...deadlines) - current + 1, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [e?.context, e?.receivedAt, event.startsAt, event.endsAt, refresh]);
  const busy = Boolean(e?.loadId || e?.saveId || e?.actionId || e?.pageId);
  const myReview = e?.context?.myReview;
  const serverNow = e?.context ? Date.parse(e.context.serverNow) + Math.max(0, now - e.receivedAt) : now;
  const locked = Boolean(myReview && serverNow >= Date.parse(myReview.editableUntil));
  const eligible = e?.context?.eligibility === 'eligible';
  const running = serverNow >= Date.parse(event.startsAt) && (!event.endsAt || serverNow < Date.parse(event.endsAt));
  const form = eligible && e?.editing && !locked;
  const mutate = useCallback(async (arg: Parameters<typeof eventReviewAction>[0]) => {
    const result = await dispatch(eventReviewAction(arg));
    if (eventReviewAction.fulfilled.match(result)) { refresh(); if (arg.kind === 'end') onEnded(); }
  }, [dispatch, onEnded, refresh]);
  const publish = async (): Promise<void> => {
    const result = await dispatch(saveEventReview({ eventId: event.id }));
    if (saveEventReview.fulfilled.match(result)) refresh();
  };
  const report = (review: EventReview): void => appAlert('Report review', 'Choose a reason. Reports are reviewed by the moderation team.', [
    ...EVENT_REVIEW_REPORT_REASONS.map(reason => ({ text: REPORT_LABELS[reason], onPress: () => { void mutate({ kind: 'report', eventId: event.id, reviewId: review.id, reason }); } })),
    { text: 'Cancel', style: 'cancel' },
  ]);
  return <View style={styles.section}>
    {isHost ? <View style={styles.card}>
      <Text style={styles.heading}>Attendance</Text>
      {!running ? <Text style={styles.secondary}>{serverNow < Date.parse(event.startsAt) ? 'Confirmation opens when the event starts.' : 'Event ended. Attendance confirmation is closed.'}</Text> : null}
      <Text style={styles.secondary}>Confirm people who attended during the event. Confirmations cannot be undone here.</Text>
      {e?.attendance?.items.map(a => <View key={a.userId} style={styles.attendee}>
        <Text style={[styles.body, styles.flex]}>{a.displayName}</Text>
        {a.confirmedAt ? <Text style={styles.verified}>Confirmed</Text> : <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Confirm attendance for ${a.displayName}`} disabled={busy || !running} style={styles.smallButton}
          onPress={() => appAlert('Confirm attendance?', `Confirm that ${a.displayName} attended this event.`, [
            { text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => { void mutate({ kind: 'confirm', eventId: event.id, userId: a.userId }); } },
          ])}><Text style={styles.action}>Confirm</Text></TouchableOpacity>}
      </View>)}
      {e?.attendance && e.attendance.items.length === 0 ? <Text style={styles.secondary}>No Going participants to confirm.</Text> : null}
      {e?.attendance?.nextCursor ? <TouchableOpacity style={styles.smallButton} disabled={busy} accessibilityRole="button" onPress={() => { void dispatch(moreEventReviews({ eventId: event.id, kind: 'attendance' })); }}><Text style={styles.action}>More participants</Text></TouchableOpacity> : null}
      <TouchableOpacity style={styles.smallButton} disabled={busy || !running} accessibilityRole="button" onPress={() => appAlert('End event?', 'Confirm attendance first. Ending the event opens reviews and closes attendance confirmation.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'End event', onPress: () => { void mutate({ kind: 'end', eventId: event.id }); } },
      ])}><Text style={styles.action}>End event</Text></TouchableOpacity>
    </View> : null}
    <View style={styles.card}>
      <Text style={styles.verified}>{myReview ? 'YOUR REVIEW' : 'AFTER THE EVENT'}</Text>
      <Text style={styles.heading}>How was the event?</Text>
      <Text style={styles.body}>{event.title}</Text>
      {e?.context ? <Text style={eligible ? styles.verified : styles.secondary}>{REASONS[e.context.eligibility]}</Text> : null}
      {e?.loadId ? <ActivityIndicator accessibilityLabel="Loading reviews" color={colors.actionPrimary} /> : null}
      {form && e ? <>
        <View style={styles.stars} accessibilityLabel="Event rating">
          {[1, 2, 3, 4, 5].map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityLabel={`Rate ${value} of 5 stars`}
            accessibilityState={{ selected: value === e.draft.rating, disabled: busy }} disabled={busy} style={styles.star}
            onPress={() => dispatch(changeReviewDraft({ eventId: event.id, draft: { ...e.draft, rating: value } }))}>
            <SvgXml xml={value <= e.draft.rating ? filledReviewStar : emptyReviewStar} />
          </TouchableOpacity>)}
        </View>
        <Text style={styles.secondary}>{e.draft.rating ? `${e.draft.rating} of 5` : 'Choose a rating'}</Text>
        <Text style={styles.body}>What stood out?</Text>
        <View style={styles.tags}>
          {EVENT_REVIEW_TAGS.map(tag => {
            const selected = e.draft.tags.includes(tag);
            const disabled = busy || (!selected && e.draft.tags.length >= EVENT_REVIEW_LIMITS.tagsMax);
            return <TouchableOpacity key={tag} accessibilityRole="checkbox" accessibilityLabel={EVENT_REVIEW_TAG_LABELS[tag]}
              accessibilityState={{ checked: selected, disabled }} disabled={disabled} style={[styles.tag, selected && styles.tagSelected]}
              onPress={() => dispatch(changeReviewDraft({ eventId: event.id, draft: { ...e.draft, tags: selected ? e.draft.tags.filter(t => t !== tag) : [...e.draft.tags, tag] } }))}>
              <Text style={selected ? styles.verified : styles.secondary}>{selected ? '✓ ' : ''}{EVENT_REVIEW_TAG_LABELS[tag]}</Text>
            </TouchableOpacity>;
          })}
        </View>
        <Text style={styles.secondary}>Optional · select up to 3 tags</Text>
        <View style={styles.comment}>
          <TextInput style={styles.input} accessibilityLabel="Review comment, optional" placeholder="Share a helpful detail…" placeholderTextColor={colors.textSecondary} multiline editable={!busy}
            value={e.draft.comment} onChangeText={comment => dispatch(changeReviewDraft({ eventId: event.id, draft: { ...e.draft, comment: Array.from(comment).slice(0, EVENT_REVIEW_LIMITS.commentMax).join('') } }))} />
          <Text style={styles.secondary}>Optional · {Array.from(e.draft.comment).length}/500 characters</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy || !e.draft.rating, busy: Boolean(e.saveId) }} disabled={busy || !e.draft.rating}
          style={[styles.publish, (busy || !e.draft.rating) && styles.disabled]} onPress={() => { void publish(); }}>
          <Text style={styles.onPrimary}>{e.saveId ? 'Saving…' : myReview ? 'Save changes' : 'Publish review'}</Text>
        </TouchableOpacity>
        <Text style={styles.secondary}>{myReview ? `Editable until ${new Date(myReview.editableUntil).toLocaleString()}` : 'You can edit for 24 hours after publishing.'}</Text>
      </> : myReview ? <>
        <Text style={styles.body}>{myReview.rating} of 5 stars</Text>
        <Text style={styles.secondary}>{myReview.tags.map(t => EVENT_REVIEW_TAG_LABELS[t]).join(' · ')}</Text>
        {myReview.comment ? <Text style={styles.body}>{myReview.comment}</Text> : null}
        <Text style={styles.secondary}>{locked ? 'Editing period ended' : `Editable until ${new Date(myReview.editableUntil).toLocaleString()}`}</Text>
        {!locked && eligible ? <TouchableOpacity disabled={busy} style={styles.smallButton} accessibilityRole="button" onPress={() => dispatch(editEventReview(event.id))}><Text style={styles.action}>Edit review</Text></TouchableOpacity> : null}
      </> : null}
      {e?.context && !eligible ? <TouchableOpacity style={styles.smallButton} accessibilityRole="button" onPress={() => openViaRef('Help')}><Text style={styles.action}>Attendance or review issue? Get help</Text></TouchableOpacity> : null}
      {e?.error ? <Text accessibilityRole="alert" style={styles.error}>{e.error}</Text> : null}
      {e?.error ? <TouchableOpacity disabled={busy} style={styles.smallButton} accessibilityRole="button" onPress={refresh}><Text style={styles.action}>Reload status</Text></TouchableOpacity> : null}
      {e?.notice ? <Text accessibilityLiveRegion="polite" style={styles.verified}>{e.notice}</Text> : null}
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>Event reviews</Text>
      {e?.page ? <Text style={styles.secondary}>{e.page.count ? `${e.page.average?.toFixed(1)} of 5 · ${e.page.count} reviews` : 'No reviews yet.'}</Text> : null}
      {e?.page?.items.map(review => <View key={review.id} style={styles.review}>
        <Text style={styles.body}>{review.displayName} · {review.rating} of 5</Text>
        <Text style={styles.secondary}>{review.tags.map(t => EVENT_REVIEW_TAG_LABELS[t]).join(' · ')}</Text>
        {review.comment ? <Text style={styles.body}>{review.comment}</Text> : null}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Report review by ${review.displayName}`} disabled={busy} style={styles.smallButton} onPress={() => report(review)}><Text style={styles.action}>Report</Text></TouchableOpacity>
      </View>)}
      {e?.page?.nextCursor ? <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.smallButton} onPress={() => { void dispatch(moreEventReviews({ eventId: event.id, kind: 'reviews' })); }}><Text style={styles.action}>More reviews</Text></TouchableOpacity> : null}
    </View>
  </View>;
}
function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.lg },
    card: { backgroundColor: c.surfacePrimary, borderRadius: radius.card, padding: spacing.lg, gap: spacing.lg },
    heading: { fontSize: fontSize.xl, fontWeight: '600', color: c.textPrimary },
    body: { fontSize: fontSize.md, color: c.textPrimary, lineHeight: 22 },
    secondary: { fontSize: fontSize.sm, color: c.textSecondary, lineHeight: 19 },
    verified: { fontSize: fontSize.sm, color: c.verified, lineHeight: 19 },
    action: { fontSize: fontSize.md, color: c.actionPrimary },
    error: { fontSize: fontSize.md, color: c.danger },
    stars: { flexDirection: 'row', justifyContent: 'space-between', maxWidth: 5 * layout.minTouch + 4 * spacing.lg, flexWrap: 'wrap' },
    star: { width: layout.minTouch, height: 48, alignItems: 'center', justifyContent: 'center' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tag: { minHeight: layout.minTouch, flexBasis: '47%', flexGrow: 1, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
    tagSelected: { backgroundColor: c.surfaceTertiary },
    comment: { padding: spacing.lg, gap: spacing.lg, backgroundColor: c.surfaceSecondary, borderRadius: radius.card },
    input: { color: c.textPrimary, fontSize: fontSize.md, minHeight: layout.minTouch, textAlignVertical: 'top', padding: 0 },
    publish: { minHeight: layout.buttonHeight, justifyContent: 'center', alignItems: 'center', padding: spacing.sm, backgroundColor: c.actionPrimary, borderRadius: radius.card },
    onPrimary: { color: c.onPrimary, fontSize: fontSize.md },
    disabled: { opacity: 0.5 },
    smallButton: { minHeight: layout.minTouch, justifyContent: 'center', paddingVertical: spacing.sm },
    review: { borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: spacing.lg, gap: spacing.sm },
    attendee: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    flex: { flex: 1 },
  });
}
