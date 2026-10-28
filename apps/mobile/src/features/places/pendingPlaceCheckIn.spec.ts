import {
  clearPendingPlaceCheckIn,
  setPendingPlaceCheckIn,
  takePendingPlaceCheckIn,
} from './pendingPlaceCheckIn';

describe('pendingPlaceCheckIn', () => {
  afterEach(() => clearPendingPlaceCheckIn());

  it('consumes the matching place intent once', () => {
    setPendingPlaceCheckIn('place-1');
    expect(takePendingPlaceCheckIn('place-1')).toBe(true);
    expect(takePendingPlaceCheckIn('place-1')).toBe(false);
  });

  it('does not consume an intent for another place', () => {
    setPendingPlaceCheckIn('place-1');
    expect(takePendingPlaceCheckIn('place-2')).toBe(false);
    expect(takePendingPlaceCheckIn('place-1')).toBe(true);
  });
});
