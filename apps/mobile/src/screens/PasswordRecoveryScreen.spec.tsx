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

it.each([
  '', 'person@example', '@example.com', 'person@@example.com',
  'person@.com', 'person@example.', 'person@exam ple.com',
  `person@${'a.'.repeat(130)}com`,
])('rejects invalid recovery email %p without requesting a code', (email) => {
  const store = configureStore({ reducer: { passwordReset: reducer } });
  const screen = render(<Provider store={store}><PasswordRecoveryScreen initialEmail={email} onClose={jest.fn()} /></Provider>);
  fireEvent.press(screen.getByText('Send reset code'));
  expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  expect(post).not.toHaveBeenCalled();
});

it.each(['person@example.com', ' person@sub.example.com ', 'person+tag@example.bg'])(
  'accepts recovery email %p and trims it for the request', async (email) => {
    const store = configureStore({ reducer: { passwordReset: reducer } });
    post.mockResolvedValueOnce({ message: 'If eligible, check your email', retryAfterSeconds: 60 });
    const screen = render(<Provider store={store}><PasswordRecoveryScreen initialEmail={email} onClose={jest.fn()} /></Provider>);
    fireEvent.press(screen.getByText('Send reset code'));
    await waitFor(() => expect(screen.getByText('Reset password')).toBeTruthy());
    expect(post).toHaveBeenCalledWith('/auth/forgot-password', { email: email.trim() });
  },
);

it.each([
  ['1234567', 'valid-password', 'Enter the 8-digit code from your email.'],
  ['12345678', 'short', 'Use at least 8 characters and no more than 72 UTF-8 bytes.'],
  ['12345678', 'a'.repeat(73), 'Use at least 8 characters and no more than 72 UTF-8 bytes.'],
  ['12345678', 'я'.repeat(37), 'Use at least 8 characters and no more than 72 UTF-8 bytes.'],
  ['12345678', '€'.repeat(25), 'Use at least 8 characters and no more than 72 UTF-8 bytes.'],
  ['12345678', '😀'.repeat(19), 'Use at least 8 characters and no more than 72 UTF-8 bytes.'],
])('rejects reset code %p and password %p locally', async (code, password, error) => {
  const store = configureStore({ reducer: { passwordReset: reducer } });
  post.mockResolvedValueOnce({ message: 'If eligible, check your email', retryAfterSeconds: 60 });
  const screen = render(<Provider store={store}><PasswordRecoveryScreen initialEmail="person@example.com" onClose={jest.fn()} /></Provider>);
  fireEvent.press(screen.getByText('Send reset code'));
  await waitFor(() => expect(screen.getByLabelText('Reset code')).toBeTruthy());
  fireEvent.changeText(screen.getByLabelText('Reset code'), code);
  fireEvent.changeText(screen.getByLabelText('New password'), password);
  fireEvent.changeText(screen.getByLabelText('Confirm password'), password);
  fireEvent.press(screen.getByText('Update password'));
  expect(screen.getByText(error)).toBeTruthy();
  expect(post).toHaveBeenCalledTimes(1);
});

it.each(['a'.repeat(72), 'я'.repeat(36), '€'.repeat(24), '😀'.repeat(18)])(
  'accepts a password at the 72 UTF-8 byte boundary: %p', async (password) => {
    const store = configureStore({ reducer: { passwordReset: reducer } });
    post.mockResolvedValueOnce({ message: 'If eligible, check your email', retryAfterSeconds: 60 });
    const screen = render(<Provider store={store}><PasswordRecoveryScreen initialEmail="person@example.com" onClose={jest.fn()} /></Provider>);
    fireEvent.press(screen.getByText('Send reset code'));
    await waitFor(() => expect(screen.getByLabelText('Reset code')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Reset code'), '12345678');
    fireEvent.changeText(screen.getByLabelText('New password'), password);
    fireEvent.changeText(screen.getByLabelText('Confirm password'), password);
    post.mockResolvedValueOnce({ message: 'Password updated.' });
    fireEvent.press(screen.getByText('Update password'));
    await waitFor(() => expect(screen.getByText('Password updated')).toBeTruthy());
    expect(post).toHaveBeenLastCalledWith('/auth/reset-password', {
      email: 'person@example.com', resetCode: '12345678', newPassword: password,
    });
  },
);
