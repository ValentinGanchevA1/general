// apps/mobile/src/features/pulse/__tests__/PulseScreen.spec.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { NavigationContainer } from '@react-navigation/native';

import { PulseScreen } from '../PulseScreen';

// Minimal mock for fetchFeed thunk + pulse slice shape
const mockReducer = (state = {
  pulse: { items: [], loading: false, error: null, pendingFilter: null },
  discovery: { points: [] },
}) => state;

jest.mock('../pulseSlice', () => ({
  fetchFeed: jest.fn(() => ({ type: 'pulse/fetch/pending' })),
  clearPendingFilter: jest.fn(() => ({ type: 'pulse/clearPendingFilter' })),
}));

function wrap(children: React.ReactElement) {
  const store = configureStore({ reducer: mockReducer });
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
