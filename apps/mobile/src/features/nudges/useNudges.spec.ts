import { selectNudge, type NudgeInputs } from './useNudges';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 5, 14); // fixed wall-clock for deterministic age math

function inputs(over: Partial<NudgeInputs> = {}): NudgeInputs {
  return {
    idVerificationStatus: 'verified', // verified → no verify nudge unless overridden
    createdAt: new Date(NOW - 10 * DAY_MS).toISOString(),
    currentStreak: 0,
    dismissed: {},
    now: NOW,
    ...over,
  };
}

describe('selectNudge — verification', () => {
  it('nudges an unverified account older than 2 days', () => {
    const n = selectNudge(inputs({ idVerificationStatus: 'none' }));
    expect(n?.id).toBe('verify-id');
    expect(n?.cta).toBe('Verify');
  });

  it('holds the verify nudge for a fresh (<2d) unverified account', () => {
    const n = selectNudge(
      inputs({ idVerificationStatus: 'none', createdAt: new Date(NOW - 1 * DAY_MS).toISOString() }),
    );
    expect(n).toBeNull();
  });

  it('a rejected ID bypasses the age hold', () => {
    const n = selectNudge(
      inputs({
        idVerificationStatus: 'rejected',
        createdAt: new Date(NOW - 1 * DAY_MS).toISOString(),
      }),
    );
    expect(n?.id).toBe('verify-id');
    expect(n?.cta).toBe('Resubmit');
  });
});

describe('selectNudge — streak milestone', () => {
  it('celebrates on a milestone day', () => {
    const n = selectNudge(inputs({ currentStreak: 7 }));
    expect(n?.id).toBe('streak-milestone');
    expect(n?.title).toContain('7-day streak');
  });

  it.each([1, 2, 4, 5, 6, 8, 13, 29])('does NOT fire on a non-milestone day (%i)', (streak) => {
    expect(selectNudge(inputs({ currentStreak: streak }))).toBeNull();
  });

  it('verification outranks a milestone when both apply', () => {
    const n = selectNudge(inputs({ idVerificationStatus: 'none', currentStreak: 7 }));
    expect(n?.id).toBe('verify-id');
  });
});

describe('selectNudge — dismissal cooldown', () => {
  it('suppresses a nudge within its cooldown window', () => {
    const n = selectNudge(
      inputs({ currentStreak: 7, dismissed: { 'streak-milestone': NOW - 0.5 * DAY_MS } }),
    );
    expect(n).toBeNull();
  });

  it('re-shows after the cooldown elapses', () => {
    const n = selectNudge(
      inputs({ currentStreak: 7, dismissed: { 'streak-milestone': NOW - 2 * DAY_MS } }),
    );
    expect(n?.id).toBe('streak-milestone');
  });
});
