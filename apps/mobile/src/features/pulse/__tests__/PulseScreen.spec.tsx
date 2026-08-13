// apps/mobile/src/features/pulse/__tests__/PulseScreen.spec.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { NavigationContainer } from '@react-navigation/native';

// Native modules are not linked under Jest. Mock before any import that pulls them in.
// jest.mock is hoisted, so these run before the PulseScreen import below.
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(() => 1),
    clearWatch: jest.fn(),
    setRNConfiguration: jest.fn(),
    requestAuthorization: jest.fn(),
  },
}));

jest.mock('@/features/location/useUserLocation', () => ({
  __esModule: true,
  useUserLocation: () => ({
    coords: { lat: 42.7, lng: 23.3 },
    requestPermission: jest.fn(),
  }),
}));

jest.mock('@/realtime/useSocket', () => ({
  __esModule: true,
  useSocket: () => ({
    on: () => () => undefined,
    sendPresence: jest.fn(),
  }),
}));

jest.mock('@/features/stories/storyMedia', () => ({
  __esModule: true,
  pickAndUploadStoryMedia: jest.fn(),
}));

jest.mock('@/lib/analytics', () => ({
  __esModule: true,
  track: jest.fn(),
}));

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

jest.mock('@/features/stories/storiesSlice', () => ({
  __esModule: true,
  ...jest.requireActual('@/features/stories/storiesSlice'),
  fetchNearbyStories: jest.fn(() => ({ type: 'stories/nearby/pending' })),
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

import { PulseScreen } from '../PulseScreen';
import authReducer from '@/features/auth/authSlice';
import profileReducer from '@/features/profile/profileSlice';
import chatReducer from '@/features/chat/chatSlice';
import pulseReducer from '@/features/pulse/pulseSlice';
import discoveryReducer from '@/features/discovery/discoverySlice';
import storiesReducer from '@/features/stories/storiesSlice';

function wrap(children: React.ReactElement) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      profile: profileReducer,
      chat: chatReducer,
      pulse: pulseReducer,
      discovery: discoveryReducer,
      stories: storiesReducer,
    },
  });
  return (
    <Provider store={store}>
      <NavigationContainer>{children}</NavigationContainer>
    </Provider>
  );
}

describe('PulseScreen v2', () => {
  it('renders story strip and filter chips (no Share CTA)', () => {
    const { getByTestId, queryByTestId, getByLabelText } = render(wrap(<PulseScreen />));
    expect(queryByTestId('share-cta')).toBeNull();
    // No profile in the test store → soft gate locks create; strip still mounts.
    expect(getByLabelText(/Create your story|Story posting locked/)).toBeTruthy();
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
