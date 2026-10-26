import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { EventAttendancePage, EventReviewPage, EventReviewReportReason, MyEventReview, SaveEventReviewRequest } from '@g88/shared';
import { getJson, patchJson, postJson } from '@/api/client';
import { logout, sessionEnded } from '@/features/auth/authSlice';
import { extractMessage } from '@/utils/extractMessage';

interface Entry {
  context: MyEventReview | null; page: EventReviewPage | null; attendance: EventAttendancePage | null;
  draft: SaveEventReviewRequest; editing: boolean; error: string | null;
  loadId: string | null; saveId: string | null; actionId: string | null; pageId: string | null;
  receivedAt: number; notice: string | null;
}
interface ReviewsState { entries: Record<string, Entry> }
type ThunkConfig = { state: { eventReviews: ReviewsState }; rejectValue: string };
const initialState: ReviewsState = { entries: {} };
const emptyDraft = (): SaveEventReviewRequest => ({ rating: 0, tags: [], comment: '' });
const entry = (s: ReviewsState, id: string): Entry => (s.entries[id] ??= {
  context: null, page: null, attendance: null, draft: emptyDraft(), editing: false, error: null,
  loadId: null, saveId: null, actionId: null, pageId: null, receivedAt: 0, notice: null,
});

export const loadEventReviews = createAsyncThunk<
  { context: MyEventReview; page: EventReviewPage; attendance: EventAttendancePage | null; receivedAt: number },
  { eventId: string; isHost: boolean }, ThunkConfig
>('eventReviews/load', async ({ eventId, isHost }, { rejectWithValue }) => {
  try {
    const [context, page, attendance] = await Promise.all([
      getJson<MyEventReview>(`/events/${eventId}/reviews/me`),
      getJson<EventReviewPage>(`/events/${eventId}/reviews`),
      isHost ? getJson<EventAttendancePage>(`/events/${eventId}/attendance`) : Promise.resolve(null),
    ]);
    return { context, page, attendance, receivedAt: Date.now() };
  } catch (e) { return rejectWithValue(extractMessage(e, 'Could not load event reviews. Try again.')); }
}, { condition: ({ eventId }, { getState }) => {
  const e = getState().eventReviews.entries[eventId];
  return !e?.loadId && !e?.saveId && !e?.actionId && !e?.pageId;
} });

export const saveEventReview = createAsyncThunk<
  { context: MyEventReview; receivedAt: number }, { eventId: string }, ThunkConfig
>('eventReviews/save', async ({ eventId }, { getState, rejectWithValue }) => {
  const e = getState().eventReviews.entries[eventId]!;
  const body: SaveEventReviewRequest = { rating: e.draft.rating, tags: e.draft.tags, comment: e.draft.comment.trim() };
  try {
    const context = e.context?.myReview
      ? await patchJson<SaveEventReviewRequest, MyEventReview>(`/events/${eventId}/reviews/me`, body)
      : await postJson<SaveEventReviewRequest, MyEventReview>(`/events/${eventId}/reviews`, body);
    return { context, receivedAt: Date.now() };
  } catch (err) { return rejectWithValue(extractMessage(err, 'Could not publish your review. Your draft is kept.')); }
}, { condition: ({ eventId }, { getState }) => {
  const e = getState().eventReviews.entries[eventId];
  return Boolean(e && !e.saveId && !e.loadId && !e.actionId && !e.pageId && e.editing && e.draft.rating >= 1 && e.context?.eligibility === 'eligible');
} });

type ActionArgs = { eventId: string } & (
  { kind: 'confirm'; userId: string } | { kind: 'end' } |
  { kind: 'report'; reviewId: string; reason: EventReviewReportReason }
);
export const eventReviewAction = createAsyncThunk<string, ActionArgs, ThunkConfig>(
  'eventReviews/action', async (arg, { rejectWithValue }) => {
    try {
      if (arg.kind === 'confirm') {
        await postJson(`/events/${arg.eventId}/attendance/${arg.userId}/confirm`, {});
        return 'Attendance confirmed.';
      }
      if (arg.kind === 'end') {
        await postJson(`/events/${arg.eventId}/end`, {});
        return 'Event ended. Confirmed attendees can now review.';
      }
      await postJson(`/events/${arg.eventId}/reviews/${arg.reviewId}/report`, { reason: arg.reason });
      return 'Report sent for review.';
    } catch (e) { return rejectWithValue(extractMessage(e, 'Could not complete that action. Try again.')); }
  }, { condition: ({ eventId }, { getState }) => {
    const e = getState().eventReviews.entries[eventId];
    return Boolean(e && !e.actionId && !e.saveId && !e.loadId && !e.pageId);
  } });

export const moreEventReviews = createAsyncThunk<
  { kind: 'reviews'; page: EventReviewPage } | { kind: 'attendance'; page: EventAttendancePage },
  { eventId: string; kind: 'reviews' | 'attendance' }, ThunkConfig
>('eventReviews/more', async ({ eventId, kind }, { getState, rejectWithValue }) => {
  const e = getState().eventReviews.entries[eventId]!;
  const cursor = kind === 'reviews' ? e.page!.nextCursor : e.attendance!.nextCursor;
  try {
    if (kind === 'reviews') return { kind, page: await getJson<EventReviewPage>(`/events/${eventId}/reviews?cursor=${cursor}`) };
    return { kind, page: await getJson<EventAttendancePage>(`/events/${eventId}/attendance?cursor=${cursor}`) };
  } catch (err) { return rejectWithValue(extractMessage(err, 'Could not load more. Try again.')); }
}, { condition: ({ eventId, kind }, { getState }) => {
  const e = getState().eventReviews.entries[eventId];
  return Boolean(e && !e.pageId && !e.loadId && !e.saveId && !e.actionId && (kind === 'reviews' ? e.page?.nextCursor : e.attendance?.nextCursor));
} });

const slice = createSlice({
  name: 'eventReviews', initialState,
  reducers: {
    changeReviewDraft(s, { payload }: PayloadAction<{ eventId: string; draft: SaveEventReviewRequest }>) {
      const e = entry(s, payload.eventId); if (!e.saveId) { e.draft = payload.draft; e.notice = null; }
    },
    editEventReview(s, { payload }: PayloadAction<string>) {
      const e = entry(s, payload); if (e.context?.myReview) { e.draft = e.context.myReview; e.editing = true; }
    },
  },
  extraReducers: b => {
    b.addCase(logout.fulfilled, () => initialState);
    b.addCase(logout.rejected, () => initialState);
    b.addCase(sessionEnded, () => initialState);
    b.addCase(loadEventReviews.pending, (s, a) => { const e = entry(s, a.meta.arg.eventId); e.loadId = a.meta.requestId; e.error = null; });
    b.addCase(loadEventReviews.fulfilled, (s, a) => {
      const e = s.entries[a.meta.arg.eventId]; if (!e || e.loadId !== a.meta.requestId) return;
      e.loadId = null; e.context = a.payload.context; e.page = a.payload.page; e.attendance = a.payload.attendance; e.receivedAt = a.payload.receivedAt;
      if (!e.context.myReview && e.context.eligibility === 'eligible') e.editing = true;
    });
    b.addCase(loadEventReviews.rejected, (s, a) => { const e = s.entries[a.meta.arg.eventId]; if (e?.loadId === a.meta.requestId) { e.loadId = null; e.error = a.payload ?? 'Could not load reviews.'; } });
    b.addCase(saveEventReview.pending, (s, a) => { const e = entry(s, a.meta.arg.eventId); e.saveId = a.meta.requestId; e.error = null; });
    b.addCase(saveEventReview.fulfilled, (s, a) => {
      const e = s.entries[a.meta.arg.eventId]; if (!e || e.saveId !== a.meta.requestId) return;
      e.saveId = null; e.context = a.payload.context; e.receivedAt = a.payload.receivedAt; e.editing = false; e.notice = 'Review saved.';
    });
    b.addCase(saveEventReview.rejected, (s, a) => { const e = s.entries[a.meta.arg.eventId]; if (e?.saveId === a.meta.requestId) { e.saveId = null; e.error = a.payload ?? 'Could not save your review.'; } });
    b.addCase(eventReviewAction.pending, (s, a) => { const e = entry(s, a.meta.arg.eventId); e.actionId = a.meta.requestId; e.error = null; e.notice = null; });
    b.addCase(eventReviewAction.fulfilled, (s, a) => { const e = s.entries[a.meta.arg.eventId]; if (e?.actionId === a.meta.requestId) { e.actionId = null; e.notice = a.payload; } });
    b.addCase(eventReviewAction.rejected, (s, a) => { const e = s.entries[a.meta.arg.eventId]; if (e?.actionId === a.meta.requestId) { e.actionId = null; e.error = a.payload ?? 'Action failed.'; } });
    b.addCase(moreEventReviews.pending, (s, a) => { const e = entry(s, a.meta.arg.eventId); e.pageId = a.meta.requestId; e.error = null; });
    b.addCase(moreEventReviews.fulfilled, (s, a) => {
      const e = s.entries[a.meta.arg.eventId]; if (!e || e.pageId !== a.meta.requestId) return; e.pageId = null;
      if (a.payload.kind === 'reviews' && e.page) e.page = { ...a.payload.page, items: [...e.page.items, ...a.payload.page.items.filter(r => !e.page!.items.some(old => old.id === r.id))] };
      if (a.payload.kind === 'attendance' && e.attendance) e.attendance = { ...a.payload.page, items: [...e.attendance.items, ...a.payload.page.items.filter(r => !e.attendance!.items.some(old => old.userId === r.userId))] };
    });
    b.addCase(moreEventReviews.rejected, (s, a) => { const e = s.entries[a.meta.arg.eventId]; if (e?.pageId === a.meta.requestId) { e.pageId = null; e.error = a.payload ?? 'Could not load more.'; } });
  },
});
export const { changeReviewDraft, editEventReview } = slice.actions;
export default slice.reducer;
