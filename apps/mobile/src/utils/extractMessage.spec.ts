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

  it('does not expose Nest missing-route API paths', () => {
    expect(
      extractMessage(
        {
          statusCode: 404,
          code: 'unknown',
          message: 'Cannot GET /api/v1/events/9812eebf-57e5-4a79-ba23-52bd014a44d9/reviews',
        },
        'Could not load event reviews. Try again.',
      ),
    ).toBe('Could not load event reviews. Try again.');
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
