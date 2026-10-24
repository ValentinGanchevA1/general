import { shouldRunNexaSpatialHandoff } from './nexaLaunchDestination';

describe('NEXA launch destination policy', () => {
  it('runs the spatial handoff only when cold start resolves to Main', () => {
    expect(
      shouldRunNexaSpatialHandoff({
        authenticated: true,
        profileSetupComplete: true,
      }),
    ).toBe(true);
  });

  it('does not paint map motion over Auth', () => {
    expect(
      shouldRunNexaSpatialHandoff({
        authenticated: false,
        profileSetupComplete: true,
      }),
    ).toBe(false);
  });

  it('does not paint map motion over ProfileCreation', () => {
    expect(
      shouldRunNexaSpatialHandoff({
        authenticated: true,
        profileSetupComplete: false,
      }),
    ).toBe(false);
  });
});
