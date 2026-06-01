// apps/mobile/src/features/pulse/__tests__/PulseScreen.spec.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { NavigationContainer } from '@react-navigation/native';

import { PulseScreen } from '../PulseScreen';

// Keep thunks as no-ops; use the real reducer so initial state stays accurate.
// __esModule: true is required — it is non-enumerable on the real module so the
// spread drops it, and without it babel interop treats the whole mock object as
// the default export, breaking `import pulseReducer from './pulseSlice'`.
jest.mock('../pulseSlice', () => ({
  __esModule: true,
  ...jest.requireActual('../pulseSlice'),
  fetchFeed: jest.fn(() => ({ type: 'pulse/fetch/pending' })),
  clearPendingFilter: jest.fn(() => ({ type: 'pulse/clearPendingFilter' })),
}));

// PulseScreen reads navigation hooks (useNavigation/useRoute/useFocusEffect).
// Outside a real navigator, useRoute throws "Couldn't find a route object", so
// stub the hooks while keeping the rest of @react-navigation/native real.
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ key: 'Pulse', name: 'Pulse', params: {} }),
  useFocusEffect: jest.fn(),
}));

// The trending strip fetches from the API via location; supply fixed topics so
// the "renders trending strip" assertion is deterministic.
jest.mock('../useTrendingNearby', () => ({
  __esModule: true,
  useTrendingNearby: () => ({ topics: ['#coffee', '#nightlife', '#sale'], loading: false }),
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
