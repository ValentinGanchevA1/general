import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { clearError, login, loginWithGoogle, register } from '@/features/auth/authSlice';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/constants/app';
import { AuthScreen } from './AuthScreen';

jest.mock('./PasswordRecoveryScreen', () => ({ PasswordRecoveryScreen: 'PasswordRecoveryScreen' }));

const mockDispatch = jest.fn();
let mockAuth = { loading: false, error: null as string | null };
jest.mock('@/hooks/redux', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: () => mockAuth,
}));
jest.mock('@/features/auth/authSlice', () => ({
  clearError: jest.fn(() => ({ type: 'auth/clearError' })),
  login: jest.fn(() => ({ type: 'auth/login' })),
  loginWithGoogle: jest.fn(() => ({ type: 'auth/google' })),
  register: Object.assign(jest.fn(() => ({ type: 'auth/register' })), {
    fulfilled: { match: () => false },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { loading: false, error: null };
});

it('validates locally then submits trimmed email and the unchanged password', () => {
  const screen = render(<AuthScreen />);
  fireEvent.press(screen.getByLabelText('Sign in'));
  expect(screen.getByText('Email is required')).toBeTruthy();
  expect(login).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Email'), ' person@example.com ');
  fireEvent.changeText(screen.getByLabelText('Password'), ' correct horse ');
  fireEvent.press(screen.getByLabelText('Sign in'));
  expect(login).toHaveBeenCalledWith({ email: 'person@example.com', password: ' correct horse ' });
  expect(mockDispatch).toHaveBeenCalled();
});

it('toggles password visibility and restores hidden state when changing mode', () => {
  const screen = render(<AuthScreen />);
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  fireEvent.press(screen.getByLabelText('Show password'));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
  fireEvent.press(screen.getByText('Create account'));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  expect(screen.getByLabelText('Password').props.autoComplete).toBe('new-password');
  expect(screen.getByLabelText('Display name')).toBeTruthy();
});

it('retains registration validation and submits the existing registration contract', () => {
  const screen = render(<AuthScreen />);
  fireEvent.press(screen.getByText('Create account'));
  fireEvent.press(screen.getByLabelText('Join NEXA'));
  expect(screen.getByText('Display name is required')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Display name'), ' Person ');
  fireEvent.changeText(screen.getByLabelText('Email'), 'person@example.com');
  fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
  fireEvent.press(screen.getByLabelText('Join NEXA'));
  expect(register).toHaveBeenCalledWith({ email: 'person@example.com', password: 'password123', displayName: 'Person' });
});

it('clears stale errors before Google sign-in and displays server errors', () => {
  mockAuth.error = 'Unable to sign in';
  const screen = render(<AuthScreen />);
  expect(screen.getByText('Unable to sign in')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Continue with Google'));
  expect(clearError).toHaveBeenCalled();
  expect(loginWithGoogle).toHaveBeenCalledTimes(1);
});

it('blocks button and keyboard submission while authentication is pending', () => {
  mockAuth.loading = true;
  const screen = render(<AuthScreen />);
  fireEvent.changeText(screen.getByLabelText('Email'), 'person@example.com');
  fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
  fireEvent.press(screen.getByLabelText('Sign in'));
  fireEvent.press(screen.getByLabelText('Continue with Google'));
  fireEvent(screen.getByLabelText('Password'), 'submitEditing');
  expect(login).not.toHaveBeenCalled();
  expect(loginWithGoogle).not.toHaveBeenCalled();
});

it('opens configured legal links and enters password recovery', () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const screen = render(<AuthScreen />);
  fireEvent.press(screen.getByText('Terms of Service'));
  expect(openURL).toHaveBeenCalledWith(TERMS_OF_SERVICE_URL);
  fireEvent.press(screen.getByText('Privacy Policy'));
  expect(openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
  fireEvent.press(screen.getByLabelText('Forgot password?'));
  expect(screen.UNSAFE_getByType('PasswordRecoveryScreen' as unknown as React.ComponentType).props.initialEmail).toBe('');
  openURL.mockRestore();
});
