import { normalizePublicErrorMessage } from './public-error-copy';

describe('normalizePublicErrorMessage', () => {
  it('replaces the legacy public product name', () => {
    expect(normalizePublicErrorMessage('You must be at least 18 years old to use G88.')).toBe(
      'You must be at least 18 years old to use NEXA.',
    );
  });

  it('does not rewrite technical lowercase identifiers or unrelated text', () => {
    expect(normalizePublicErrorMessage('Host g88-api.onrender.com is unavailable')).toBe(
      'Host g88-api.onrender.com is unavailable',
    );
    expect(normalizePublicErrorMessage('Request not found')).toBe('Request not found');
  });
});
