import {
  PULSE_CHECK_IN_COOLDOWN_MS,
  type PulseCheckInResult,
} from '@g88/shared';

import reducer, {
  checkInCooldownUntilMs,
  createPlacePulseCheckIn,
  createPulseCheckIn,
  isCheckInCooldownActive,
} from './pulseSlice';

const CREATED_AT = '2026-11-01T18:00:00.000Z';
const RESULT: PulseCheckInResult = {
  id: 'check-in-1',
  placeLabel: 'Sea Garden',
  placeId: 'place-1',
  placeIdentity: null,
  audience: 'friends',
  createdAt: CREATED_AT,
  expiresAt: '2026-11-02T00:00:00.000Z',
};

describe('Pulse check-in cooldown', () => {
  it('derives the cooldown from server-created time using the shared contract', () => {
    const expectedUntil = Date.parse(CREATED_AT) + PULSE_CHECK_IN_COOLDOWN_MS;

    expect(checkInCooldownUntilMs(RESULT)).toBe(expectedUntil);
    expect(isCheckInCooldownActive(expectedUntil, expectedUntil - 1)).toBe(true);
    expect(isCheckInCooldownActive(expectedUntil, expectedUntil)).toBe(false);
  });

  it('stores the canonical place after a successful Place check-in', () => {
    const action = createPlacePulseCheckIn.fulfilled(
      RESULT,
      'request-1',
      { placeId: 'place-1', audience: 'friends', lat: 43.2, lng: 27.9 },
    );
    const state = reducer(undefined, action);

    expect(state.checkInCooldownUntilMs).toBe(Date.parse(CREATED_AT) + PULSE_CHECK_IN_COOLDOWN_MS);
    expect(state.lastCheckInPlaceId).toBe('place-1');
    expect(state.checkInError).toBeNull();
    expect(state.checkInSubmitting).toBe(false);
  });

  it('keeps the cooldown global even when a free-text check-in has no canonical place', () => {
    const freeTextResult: PulseCheckInResult = {
      ...RESULT,
      placeId: null,
      placeLabel: 'Local corner',
    };
    const action = createPulseCheckIn.fulfilled(
      freeTextResult,
      'request-2',
      {
        placeLabel: 'Local corner',
        placeIdentity: null,
        audience: 'nearby',
        lat: 43.2,
        lng: 27.9,
      },
    );
    const state = reducer(undefined, action);

    expect(state.checkInCooldownUntilMs).toBe(Date.parse(CREATED_AT) + PULSE_CHECK_IN_COOLDOWN_MS);
    expect(state.lastCheckInPlaceId).toBeNull();
  });

  it('fails open in the client when a malformed server timestamp cannot define a safe cooldown', () => {
    expect(checkInCooldownUntilMs({ ...RESULT, createdAt: 'invalid' })).toBeNull();
    expect(isCheckInCooldownActive(null, Date.parse(CREATED_AT))).toBe(false);
  });
});
