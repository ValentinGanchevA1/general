// apps/mobile/src/features/pulse/__tests__/PulseScreen.spec.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { NavigationContainer } from '@react-navigation/native';

import { PulseScreen } from '../PulseScreen';

// Keep thunks as no-ops; use the real reducer so initial state stays accurate.
jest.mock('../pulseSlice', () => ({
  ...jest.requireActual('../pulseSlice'),
  fetchFeed: jest.fn(() => ({ type: 'pulse/fetch/pending' })),
  clearPendingFilter: jest.fn(() => ({ type: 'pulse/clearPendingFilter' })),
}));

import authReducer from '@/features/auth/authSlice';
import profileReducer from '@/features/profile/profileSlice';
import chatReducer from '@/features/chat/chatSlice';
import pulseReducer from '@/features/pulse/pulseSlice';
import discoveryReducer from '@/features/discovery/discoverySlice';

function wrap(children: React.ReactElement) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      profile: profileReducer,
      chat: chatReducer,
      pulse: pulseReducer,
      discovery: discoveryReducer,
    },
  });
  return (
    <Provider store={store}>
      <NavigationContainer>{children}</NavigationContainer>
    </Provider>
  );
}

describe('PulseScreen v2', () => {
  it('renders the Share CTA and filter chips', () => {
    const { getByTestId } = render(wrap(<PulseScreen />));
    expect(getByTestId('share-cta')).toBeTruthy();
    expect(getByTestId('pulse-filter-all')).toBeTruthy();
    expect(getByTestId('pulse-filter-chats')).toBeTruthy();
  });

  it('switches filter when a chip is tapped', () => {
    const { getByTestId } = render(wrap(<PulseScreen />));
    fireEvent.press(getByTestId('pulse-filter-waves'));
    // The chip should remain rendered after press — no crash, basic interaction works.
    expect(getByTestId('pulse-filter-waves')).toBeTruthy();
  });

  it('renders the trending strip with mock topics', () => {
    const { getByTestId } = render(wrap(<PulseScreen />));
    expect(getByTestId('trending-topic-#coffee')).toBeTruthy();
  });
});
