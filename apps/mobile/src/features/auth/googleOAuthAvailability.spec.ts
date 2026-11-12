import { hasGoogleWebClientId } from './googleOAuthAvailability';

describe('optional Google OAuth bootstrap', () => {
  it('does not initialize native Google Sign-In for CI/release bundles without OAuth config', () => {
    expect(hasGoogleWebClientId('')).toBe(false);
    expect(hasGoogleWebClientId('   ')).toBe(false);
    expect(hasGoogleWebClientId('\n\t')).toBe(false);
  });

  it('recognizes a provided public Web Client ID', () => {
    expect(hasGoogleWebClientId('client-id.apps.googleusercontent.com')).toBe(true);
    expect(hasGoogleWebClientId('  configured-client  ')).toBe(true);
  });
});
