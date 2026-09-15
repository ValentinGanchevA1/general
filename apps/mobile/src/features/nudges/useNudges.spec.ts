import { selectNudge, type NudgeInputs } from './useNudges';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 5, 14); // fixed wall-clock for deterministic age math

function inputs(over: Partial<NudgeInputs> = {}): NudgeInputs {
  return {
    emailVerified: true,
    phoneVerified: true,
    idVerificationStatus: 'verified',
    createdAt: new Date(NOW - 5 * DAY_MS).toISOString(),
    currentStreak: 0,
    dismissed: {},
    now: NOW,
    ...over,
  };
}

describe('selectNudge — activation ladder', () => {
  it('nudges email when unverified and account ≥1 day', () => {
    const n = selectNudge(
      inputs({
        emailVerified: false,
        phoneVerified: false,
        idVerificationStatus: 'none',
        createdAt: new Date(NOW - 1.5 * DAY_MS).toISOString(),
      }),
    );
    expect(n?.id).toBe('verify-email');
    expect(n?.target).toBe('EmailVerification');
  });

  it('holds email nudge until account is ~1 day old', () => {
    const n = selectNudge(
      inputs({
        emailVerified: false,
        createdAt: new Date(NOW - 0.5 * DAY_MS).toISOString(),
      }),
    );
    expect(n).toBeNull();
  });

  it('nudges phone after email is done', () => {
    const n = selectNudge(
      inputs({
        emailVerified: true,
        phoneVerified: false,
        idVerificationStatus: 'none',
      }),
    );
    expect(n?.id).toBe('verify-phone');
    expect(n?.target).toBe('Verification');
  });

  it('does not phone-nudge while email still open', () => {
    const n = selectNudge(
      inputs({
        emailVerified: false,
        phoneVerified: false,
        createdAt: new Date(NOW - 5 * DAY_MS).toISOString(),
      }),
    );
    expect(n?.id).toBe('verify-email');
  });

  it('nudges ID after email + phone', () => {
    const n = selectNudge(
      inputs({
        emailVerified: true,
        phoneVerified: true,
        idVerificationStatus: 'none',
      }),
    );
    expect(n?.id).toBe('verify-id');
    expect(n?.target).toBe('VerificationId');
  });

  it('holds ID nudge until account is ~2 days old', () => {
    const n = selectNudge(
      inputs({
        emailVerified: true,
        phoneVerified: true,
        idVerificationStatus: 'none',
        createdAt: new Date(NOW - 1 * DAY_MS).toISOString(),
      }),
    );
    expect(n).toBeNull();
  });

  it('always surfaces rejected ID (bypass age)', () => {
    const n = selectNudge(
      inputs({
        emailVerified: true,
        phoneVerified: true,
        idVerificationStatus: 'rejected',
        createdAt: new Date(NOW - 0.1 * DAY_MS).toISOString(),
      }),
    );
    expect(n?.id).toBe('verify-id');
    expect(n?.cta).toBe('Resubmit');
  });

  it('skips pending ID (no nag while under review)', () => {
    const n = selectNudge(
      inputs({
        emailVerified: true,
        phoneVerified: true,
        idVerificationStatus: 'pending',
      }),
    );
    expect(n).toBeNull();
  });

  it('email outranks phone and ID', () => {
    const n = selectNudge(
      inputs({
        emailVerified: false,
        phoneVerified: false,
        idVerificationStatus: 'none',
        currentStreak: 7,
        createdAt: new Date(NOW - 5 * DAY_MS).toISOString(),
      }),
    );
    expect(n?.id).toBe('verify-email');
  });

  it('phone outranks ID and streak', () => {
    const n = selectNudge(
      inputs({
        emailVerified: true,
        phoneVerified: false,
        idVerificationStatus: 'none',
        currentStreak: 7,
      }),
    );
    expect(n?.id).toBe('verify-phone');
  });
});

describe('selectNudge — streak milestones', () => {
  it('fires on a 7-day streak when fully verified', () => {
    const n = selectNudge(inputs({ currentStreak: 7 }));
    expect(n?.id).toBe('streak-milestone');
    expect(n?.title).toContain('7-day streak');
  });

  it.each([1, 2, 4, 5, 6, 8, 13, 29])('does NOT fire on a non-milestone day (%i)', (streak) => {
    expect(selectNudge(inputs({ currentStreak: streak }))).toBeNull();
  });

  it('verification outranks a milestone when both apply', () => {
    const n = selectNudge(
      inputs({
        emailVerified: true,
        phoneVerified: true,
        idVerificationStatus: 'none',
        currentStreak: 7,
      }),
    );
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
