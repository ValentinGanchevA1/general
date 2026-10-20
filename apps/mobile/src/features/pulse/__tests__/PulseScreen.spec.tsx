// apps/mobile/src/features/pulse/__tests__/PulseScreen.spec.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { NavigationContainer } from '@react-navigation/native';

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
  useSocket: () => ({ on: () => () => undefined, sendPresence: jest.fn() }),
}));

jest.mock('@/features/stories/storyMedia', () => ({
  __esModule: true,
  pickAndUploadStoryMedia: jest.fn(),
}));

jest.mock('@/lib/analytics', () => ({ __esModule: true, track: jest.fn() }));

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

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ key: 'Pulse', name: 'Pulse', params: {} }),
  useFocusEffect: jest.fn(),
}));

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
import friendsReducer from '@/features/friends/friendsSlice';

function wrap(children: React.ReactElement) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      profile: profileReducer,
      chat: chatReducer,
      pulse: pulseReducer,
      discovery: discoveryReducer,
      stories: storiesReducer,
      friends: friendsReducer,
    },
  });
  return <Provider store={store}><NavigationContainer>{children}</NavigationContainer></Provider>;
}

describe('PulseScreen discovery feed', () => {
  it('renders stories and the local discovery filters', () => {
    const { queryByLabelText, queryByTestId, getByLabelText } = render(wrap(<PulseScreen />));
    expect(queryByTestId('share-cta')).toBeNull();
    expect(getByLabelText(/Create your story|Story posting locked/)).toBeTruthy();
    expect(getByLabelText('Filter For You')).toBeTruthy();
    expect(getByLabelText('Filter Nearby')).toBeTruthy();
    expect(getByLabelText('Filter Events')).toBeTruthy();
    expect(getByLabelText('Filter Marketplace')).toBeTruthy();
    expect(queryByLabelText('Filter Waves')).toBeNull();
    expect(queryByLabelText('Filter Chats')).toBeNull();
    expect(queryByLabelText('Filter Matches')).toBeNull();
  });

  it('switches discovery filter without restoring interaction filters', () => {
    const { getByLabelText, queryByLabelText } = render(wrap(<PulseScreen />));
    fireEvent.press(getByLabelText('Filter Events'));
    expect(getByLabelText('Filter Events')).toBeTruthy();
    expect(queryByLabelText('Filter Waves')).toBeNull();
  });

  it('renders the trending strip with mock topics', () => {
    const { getByTestId } = render(wrap(<PulseScreen />));
    expect(getByTestId('trending-topic-#coffee')).toBeTruthy();
  });
});
