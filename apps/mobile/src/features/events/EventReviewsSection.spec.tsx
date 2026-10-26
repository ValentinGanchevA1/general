import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { EventDetail, MyEventReview } from '@g88/shared';
import { postJson } from '@/api/client';
import reducer, { loadEventReviews } from './eventReviewsSlice';
import { EventReviewsSection } from './EventReviewsSection';

jest.mock('@/api/client', () => ({ getJson: jest.fn(() => new Promise(() => undefined)), postJson: jest.fn(), patchJson: jest.fn() }));
jest.mock('@/features/auth/authSlice', () => {
  const kit = jest.requireActual('@reduxjs/toolkit');
  return { logout: kit.createAsyncThunk('auth/logout', async () => undefined), sessionEnded: kit.createAction('auth/sessionEnded') };
});
jest.mock('@/theme', () => ({ ...jest.requireActual('@/theme/tokens'), useAppTheme: () => ({ colors: jest.requireActual('@/theme/colors').darkColors }) }));
jest.mock('@/navigation/openRootScreen', () => ({ openViaRef: jest.fn() }));
jest.mock('react-native-svg', () => ({ SvgXml: () => null }));
const event: EventDetail = { id: 'e', hostId: 'h', hostDisplayName: 'Host', hostAvatarUrl: null, title: 'Sea Garden Meetup', startsAt: '2026-10-26T10:00:00Z', endsAt: '2026-10-26T11:00:00Z', coverUrl: null, description: null, location: { lat: 43, lng: 27 }, capacity: null, attendeeCount: 1, visibility: 'public', myRsvp: 'going', attendees: [] };
const context: MyEventReview = { eligibility: 'eligible', myReview: null, serverNow: '2026-10-26T12:00:00Z' };
function setup(value = context) {
  const s = configureStore({ reducer: { eventReviews: reducer } });
  const args = { eventId: 'e', isHost: false };
  // Keep the mount request pending, then resolve it explicitly with server data.
  const ui = render(<Provider store={s}><EventReviewsSection event={event} isHost={false} onEnded={jest.fn()} /></Provider>);
  act(() => {
    const id = s.getState().eventReviews.entries.e!.loadId!;
    s.dispatch(loadEventReviews.fulfilled({ context: value, page: { count: 0, average: null, items: [], nextCursor: null }, attendance: null, receivedAt: Date.now() }, id, args));
  });
  return { s, ui };
}
beforeEach(() => jest.clearAllMocks());
it('starts without a score and supports optional tags and Unicode comments', () => {
  const { s, ui } = setup();
  expect(ui.getByRole('button', { name: 'Publish review' }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(ui.getByLabelText('Rate 4 of 5 stars'));
  expect(ui.getByLabelText('Rate 4 of 5 stars').props.accessibilityState.selected).toBe(true);
  fireEvent.press(ui.getByLabelText('Welcoming'));
  fireEvent.changeText(ui.getByLabelText('Review comment, optional'), '😀'.repeat(501));
  expect(Array.from(s.getState().eventReviews.entries.e!.draft.comment)).toHaveLength(500);
});
it('preserves a draft after a failed publish', async () => {
  const { s, ui } = setup();
  fireEvent.press(ui.getByLabelText('Rate 4 of 5 stars'));
  fireEvent.changeText(ui.getByLabelText('Review comment, optional'), 'A helpful detail');
  jest.mocked(postJson).mockRejectedValue({ statusCode: 0, message: 'Network error' });
  await act(async () => { fireEvent.press(ui.getByText('Publish review')); });
  expect(s.getState().eventReviews.entries.e!.draft).toMatchObject({ rating: 4, comment: 'A helpful detail' });
  expect(ui.getByText('Server is waking up — try again in a few seconds')).toBeTruthy();
  expect(ui.getByText('Publish review')).toBeTruthy();
});
it('stars-only publishing is star selection then Publish', async () => {
  const { ui } = setup();
  jest.mocked(postJson).mockResolvedValue({ ...context, myReview: { id: 'r', userId: 'u', eventId: 'e', displayName: 'U', rating: 5, tags: [], comment: '', createdAt: context.serverNow, updatedAt: context.serverNow, editableUntil: '2026-10-27T12:00:00Z' } });
  fireEvent.press(ui.getByLabelText('Rate 5 of 5 stars'));
  await act(async () => { fireEvent.press(ui.getByText('Publish review')); });
  expect(postJson).toHaveBeenCalledWith('/events/e/reviews', { rating: 5, tags: [], comment: '' });
  expect(ui.getByText('Review saved.')).toBeTruthy();
});
it('shows exact-deadline reviews read-only and explains ineligibility', () => {
  const saved: MyEventReview = { ...context, myReview: { id: 'r', userId: 'u', eventId: 'e', displayName: 'U', rating: 4, tags: [], comment: 'Good', createdAt: '2026-10-25T12:00:00Z', updatedAt: context.serverNow, editableUntil: context.serverNow } };
  const first = setup(saved);
  expect(first.ui.getByText('Editing period ended')).toBeTruthy();
  expect(first.ui.queryByText('Edit review')).toBeNull();
  first.ui.unmount();
  const second = setup({ ...context, eligibility: 'attendance_unconfirmed' });
  expect(second.ui.getByText('Reviews require confirmed attendance. Going alone does not confirm attendance.')).toBeTruthy();
  expect(second.ui.queryByText('Publish review')).toBeNull();
});
