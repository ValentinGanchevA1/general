import { extractMessage } from './extractMessage';

describe('extractMessage', () => {
  it('maps axios 429 transport errors to user-facing rate-limit copy', () => {
    expect(extractMessage(new Error('Request failed with status code 429'), 'Failed to load')).toBe(
      'Too many requests — try again shortly',
    );
  });

  it('uses structured statusCode when the API client wraps a 429', () => {
    expect(
      extractMessage(
        {
          statusCode: 429,
          code: 'unknown',
          message: 'Request failed with status code 429',
        },
        'Failed to load',
      ),
    ).toBe('Too many requests — try again shortly');
  });

  it('does not expose generic axios 4xx transport text', () => {
    expect(extractMessage(new Error('Request failed with status code 404'), 'Failed to load')).toBe(
      'Failed to load',
    );
  });

  it('does not expose generic axios 5xx transport text', () => {
    expect(extractMessage(new Error('Request failed with status code 500'), 'Failed to load')).toBe(
      'Something went wrong — try again in a moment',
    );
  });

  it('keeps cold-start 503 transport failures on the existing transient-server copy', () => {
    expect(extractMessage(new Error('Request failed with status code 503'), 'Failed to load')).toBe(
      'Server is waking up — try again in a few seconds',
    );
  });

  it('preserves product-authored API messages', () => {
    expect(
      extractMessage(
        {
          statusCode: 400,
          code: 'profile.underage',
          message: 'You must be 18+ to use NEXA.',
        },
        'Failed to update profile',
      ),
    ).toBe('You must be 18+ to use NEXA.');
  });

  it('keeps the existing transient-network copy', () => {
    expect(extractMessage(new Error('Network request failed'), 'Failed to load')).toBe(
      'Server is waking up — try again in a few seconds',
    );
  });
});
