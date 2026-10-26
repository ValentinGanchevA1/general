import { configureStore } from '@reduxjs/toolkit';
import { postJson } from '@/api/client';
import reducer, { clearPasswordRecovery, requestPasswordReset, resetPassword } from './passwordResetSlice';

jest.mock('@/api/client', () => ({ postJson: jest.fn() }));
const post = postJson as jest.Mock;
const makeStore = () => configureStore({ reducer: { passwordReset: reducer } });
beforeEach(() => jest.clearAllMocks());

it('progresses from request to code to success without storing recovery credentials', async () => {
  const store = makeStore();
  post.mockResolvedValueOnce({ message: 'Check your email', retryAfterSeconds: 60 });
  await store.dispatch(requestPasswordReset({ email: 'person@example.com' }));
  expect(store.getState().passwordReset.step).toBe('code');
  expect(store.getState().passwordReset.retryAt).toBeGreaterThan(Date.now());
  post.mockResolvedValueOnce({ message: 'Password updated' });
  await store.dispatch(resetPassword({ email: 'person@example.com', resetCode: '12345678', newPassword: 'new-password' }));
  expect(store.getState().passwordReset.step).toBe('success');
  expect(JSON.stringify(store.getState())).not.toMatch(/12345678|new-password|person@example/);
});

it('preserves the code step and surfaces API failures for retry', async () => {
  const store = makeStore();
  post.mockResolvedValueOnce({ message: 'Check your email', retryAfterSeconds: 60 });
  await store.dispatch(requestPasswordReset({ email: 'person@example.com' }));
  post.mockRejectedValueOnce(new Error('The code is invalid or expired.'));
  await store.dispatch(resetPassword({ email: 'person@example.com', resetCode: '12345678', newPassword: 'new-password' }));
  expect(store.getState().passwordReset).toMatchObject({ step: 'code', busy: false, error: 'The code is invalid or expired.' });
});

it('blocks concurrent requests and ignores late responses after leaving recovery', async () => {
  const store = makeStore();
  let resolve: ((value: { message: string; retryAfterSeconds: number }) => void) | undefined;
  post.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const first = store.dispatch(requestPasswordReset({ email: 'person@example.com' }));
  await store.dispatch(requestPasswordReset({ email: 'person@example.com' }));
  expect(post).toHaveBeenCalledTimes(1);
  store.dispatch(clearPasswordRecovery());
  resolve?.({ message: 'Check your email', retryAfterSeconds: 60 });
  await first;
  expect(store.getState().passwordReset).toMatchObject({ step: 'email', busy: false, message: '' });
});
