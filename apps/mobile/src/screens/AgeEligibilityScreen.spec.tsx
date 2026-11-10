import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { checkAgeEligibility, completeAgeEligibility } from '@/features/auth/ageEligibilitySlice';
import { logout } from '@/features/auth/authSlice';
import { AgeEligibilityScreen } from './AgeEligibilityScreen';

jest.mock('@/components/Brand/NexaWordmark', () => ({ NexaWordmark: 'NexaWordmark' }));
jest.mock('@/components/Profile/ProfileOriginFields', () => ({ BirthDateField: 'BirthDateField' }));

const mockDispatch = jest.fn();
const mockUser = { id: '11111111-1111-1111-1111-111111111111' };
let mockGate = {
  userId: mockUser.id,
  phase: 'required',
  error: null as string | null,
};

jest.mock('@/hooks/redux', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: {
    auth: { user: typeof mockUser };
    ageEligibility: typeof mockGate;
  }) => unknown) => selector({ auth: { user: mockUser }, ageEligibility: mockGate }),
}));
jest.mock('@/features/auth/ageEligibilitySlice', () => ({
  checkAgeEligibility: jest.fn((userId: string) => ({ type: 'ageEligibility/check', payload: userId })),
  completeAgeEligibility: jest.fn((args: { userId: string; dateOfBirth: string }) =>
    ({ type: 'ageEligibility/complete', payload: args })),
}));
jest.mock('@/features/auth/authSlice', () => ({
  logout: jest.fn(() => ({ type: 'auth/logout' })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGate = { userId: mockUser.id, phase: 'required', error: null };
});

it('does not submit an empty DOB and blocks an underage DOB', () => {
  const screen = render(<AgeEligibilityScreen />);
  fireEvent.press(screen.getByLabelText('Confirm I am 18 or older'));
  expect(screen.UNSAFE_getByType('BirthDateField' as unknown as React.ComponentType).props.error)
    .toBe('Choose your date of birth');
  expect(completeAgeEligibility).not.toHaveBeenCalled();

  const picker = () => screen.UNSAFE_getByType('BirthDateField' as unknown as React.ComponentType);
  fireEvent(picker(), 'change', '2015-01-01');
  fireEvent.press(screen.getByLabelText('Confirm I am 18 or older'));
  expect(picker().props.error).toBe('You must be at least 18 years old');
  expect(completeAgeEligibility).not.toHaveBeenCalled();
});

it('dispatches the minimal private DOB payload to server completion', () => {
  const screen = render(<AgeEligibilityScreen />);
  const picker = screen.UNSAFE_getByType('BirthDateField' as unknown as React.ComponentType);
  fireEvent(picker, 'change', '2000-01-01');
  fireEvent.press(screen.getByLabelText('Confirm I am 18 or older'));
  expect(completeAgeEligibility).toHaveBeenCalledWith({
    userId: mockUser.id, dateOfBirth: '2000-01-01',
  });
  expect(mockDispatch).toHaveBeenCalled();
});

it('fails closed on status errors with retry and sign out', () => {
  mockGate = { userId: mockUser.id, phase: 'error', error: 'DB unavailable' };
  const screen = render(<AgeEligibilityScreen />);
  expect(screen.getByText('DB unavailable')).toBeTruthy();
  expect(screen.queryByLabelText('Confirm I am 18 or older')).toBeNull();
  fireEvent.press(screen.getByLabelText('Retry age eligibility check'));
  expect(checkAgeEligibility).toHaveBeenCalledWith(mockUser.id);
  fireEvent.press(screen.getByLabelText('Sign out'));
  expect(logout).toHaveBeenCalledTimes(1);
});

it('prevents DOB re-submission while the server is checking', () => {
  mockGate = { userId: mockUser.id, phase: 'checking', error: null };
  const screen = render(<AgeEligibilityScreen />);
  expect(screen.queryByLabelText('Confirm I am 18 or older')).toBeNull();
  expect(completeAgeEligibility).not.toHaveBeenCalled();
});
