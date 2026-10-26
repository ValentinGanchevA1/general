import { configureStore, createAction } from '@reduxjs/toolkit';
import type { MyEventReview } from '@g88/shared';
import { getJson, postJson, patchJson } from '@/api/client';
import reducer, { changeReviewDraft, editEventReview, loadEventReviews, saveEventReview } from './eventReviewsSlice';

jest.mock('@/api/client', () => ({ getJson: jest.fn(), postJson: jest.fn(), patchJson: jest.fn() }));
jest.mock('@/features/auth/authSlice', () => {
  const kit = jest.requireActual('@reduxjs/toolkit');
  return { logout: kit.createAsyncThunk('auth/logout', async () => undefined), sessionEnded: kit.createAction('auth/sessionEnded') };
});
const context: MyEventReview = { eligibility: 'eligible', myReview: null, serverNow: '2026-10-26T12:00:00Z' };
const args = { eventId: 'e', isHost: false };
function store() { return configureStore({ reducer: { eventReviews: reducer } }); }
function loaded(s: ReturnType<typeof store>, value = context): void {
  s.dispatch(loadEventReviews.pending('load', args));
  s.dispatch(loadEventReviews.fulfilled({ context: value, page: { items: [], count: 0, average: null, nextCursor: null }, attendance: null, receivedAt: Date.now() }, 'load', args));
}
beforeEach(() => jest.clearAllMocks());
it('guards concurrent submits, preserves failed draft and sends only contract fields', async () => {
  const s = store(); loaded(s);
  s.dispatch(changeReviewDraft({ eventId: 'e', draft: { rating: 5, tags: ['welcoming'], comment: ' Nice ' } }));
  let reject: (e: unknown) => void = () => undefined;
  jest.mocked(postJson).mockReturnValue(new Promise((_, no) => { reject = no; }));
  const first = s.dispatch(saveEventReview({ eventId: 'e' }));
  await s.dispatch(saveEventReview({ eventId: 'e' }));
  expect(postJson).toHaveBeenCalledTimes(1);
  reject({ statusCode: 429, message: 'Request failed with status code 429' });
  await first;
  expect(s.getState().eventReviews.entries.e?.draft.comment).toBe(' Nice ');
  expect(s.getState().eventReviews.entries.e?.error).toContain('Too many requests');
  expect(postJson).toHaveBeenCalledWith('/events/e/reviews', { rating: 5, tags: ['welcoming'], comment: 'Nice' });
});
it('edits the saved review without posting identity/deadline fields', async () => {
  const s = store();
  const saved: MyEventReview = { ...context, myReview: { id: 'r', userId: 'u', eventId: 'e', displayName: 'U', rating: 4, tags: [], comment: '', createdAt: context.serverNow, updatedAt: context.serverNow, editableUntil: '2026-10-27T12:00:00Z' } };
  loaded(s, saved); s.dispatch(editEventReview('e'));
  jest.mocked(patchJson).mockResolvedValue(saved);
  await s.dispatch(saveEventReview({ eventId: 'e' }));
  expect(patchJson).toHaveBeenCalledWith('/events/e/reviews/me', { rating: 4, tags: [], comment: '' });
  expect(s.getState().eventReviews.entries.e?.editing).toBe(false);
});
it('clears review text on session teardown and ignores stale responses', async () => {
  const s = store(); loaded(s);
  s.dispatch(changeReviewDraft({ eventId: 'e', draft: { rating: 5, tags: [], comment: 'Private draft' } }));
  let resolve: (v: unknown) => void = () => undefined;
  jest.mocked(getJson).mockReturnValue(new Promise(yes => { resolve = yes; }));
  const pending = s.dispatch(loadEventReviews(args));
  s.dispatch(createAction('auth/sessionEnded')());
  // An obsolete request cannot recreate an entry after logout.
  s.dispatch(loadEventReviews.fulfilled({ context, page: { items: [], count: 0, average: null, nextCursor: null }, attendance: null, receivedAt: 0 }, 'obsolete', args));
  expect(s.getState().eventReviews.entries).toEqual({});
  resolve({}); void pending;
});
