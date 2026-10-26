import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { postJson } from '@/api/client';
import reducer from '@/features/auth/passwordResetSlice';
import { PasswordRecoveryScreen } from './PasswordRecoveryScreen';

jest.mock('@/api/client', () => ({ postJson: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) }));
const post = postJson as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('supports request, code, mismatch validation, password reset and return to login', async () => {
  const store = configureStore({ reducer: { passwordReset: reducer } });
  const onClose = jest.fn();
  post.mockResolvedValueOnce({ message: 'If eligible, check your email', retryAfterSeconds: 60 });
  const screen = render(<Provider store={store}><PasswordRecoveryScreen initialEmail="person@example.com" onClose={onClose} /></Provider>);
  fireEvent.press(screen.getByText('Send reset code'));
  await waitFor(() => expect(screen.getByLabelText('Reset code')).toBeTruthy());
  expect(screen.getByText(/Resend code in/)).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Reset code'), '12345678');
  fireEvent.changeText(screen.getByLabelText('New password'), 'new-password');
  fireEvent.changeText(screen.getByLabelText('Confirm password'), 'other-password');
  fireEvent.press(screen.getByText('Update password'));
  expect(screen.getByText('Passwords do not match.')).toBeTruthy();
  expect(post).toHaveBeenCalledTimes(1);
  fireEvent.changeText(screen.getByLabelText('Confirm password'), 'new-password');
  post.mockResolvedValueOnce({ message: 'Password updated. Sign in with your new password.' });
  fireEvent.press(screen.getByText('Update password'));
  await waitFor(() => expect(screen.getByText('Password updated')).toBeTruthy());
  expect(screen.queryByLabelText('New password')).toBeNull();
  fireEvent.press(screen.getByText('Back to sign in'));
  expect(onClose).toHaveBeenCalledWith('person@example.com');
  expect(store.getState().passwordReset.step).toBe('email');
}, 15_000);

it('shows unavailable delivery errors and keeps email entry available', async () => {
  const store = configureStore({ reducer: { passwordReset: reducer } });
  post.mockRejectedValueOnce(new Error('Password recovery is temporarily unavailable.'));
  const screen = render(<Provider store={store}><PasswordRecoveryScreen initialEmail="person@example.com" onClose={jest.fn()} /></Provider>);
  fireEvent.press(screen.getByText('Send reset code'));
  await waitFor(() => expect(screen.getByText('Password recovery is temporarily unavailable.')).toBeTruthy());
  expect(screen.getByLabelText('Recovery email')).toBeTruthy();
});
