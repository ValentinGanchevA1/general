import { classifyDiscoveryFailure } from './discoveryFailureDiagnostics';

describe('classifyDiscoveryFailure', () => {
  it('keeps the failing discovery lane explicit without raw error data', () => {
    expect(
      classifyDiscoveryFailure('legacy', {
        statusCode: 503,
        code: 'upstream_unavailable',
        message: 'provider detail that must not be emitted',
      }),
    ).toEqual({
      lane: 'legacy',
      kind: 'http',
      statusCode: 503,
      retryable: true,
    });

    expect(
      classifyDiscoveryFailure('places', {
        statusCode: 503,
        code: 'upstream_unavailable',
        message: 'provider detail that must not be emitted',
      }),
    ).toEqual({
      lane: 'places',
      kind: 'http',
      statusCode: 503,
      retryable: true,
    });
  });

  it('classifies expected abort/cancellation churn separately', () => {
    expect(
      classifyDiscoveryFailure('legacy', new Error('anything'), true),
    ).toEqual({
      lane: 'legacy',
      kind: 'cancelled',
      statusCode: null,
      retryable: false,
    });

    expect(
      classifyDiscoveryFailure('places', { code: 'ERR_CANCELED', message: 'canceled' }),
    ).toEqual({
      lane: 'places',
      kind: 'cancelled',
      statusCode: null,
      retryable: false,
    });
  });

  it('classifies timeout failures as retryable', () => {
    expect(
      classifyDiscoveryFailure('legacy', {
        statusCode: 0,
        code: 'ECONNABORTED',
        message: 'timeout of 15000ms exceeded',
      }),
    ).toEqual({
      lane: 'legacy',
      kind: 'timeout',
      statusCode: 0,
      retryable: true,
    });
  });

  it('classifies transport/network failures without preserving their raw text', () => {
    expect(
      classifyDiscoveryFailure('places', {
        statusCode: 0,
        code: 'network',
        message: 'Network request failed',
      }),
    ).toEqual({
      lane: 'places',
      kind: 'network',
      statusCode: 0,
      retryable: true,
    });
  });

  it('marks retryable and non-retryable HTTP failures explicitly', () => {
    expect(
      classifyDiscoveryFailure('legacy', {
        statusCode: 429,
        code: 'rate_limited',
        message: 'Too many requests',
      }),
    ).toEqual({
      lane: 'legacy',
      kind: 'http',
      statusCode: 429,
      retryable: true,
    });

    expect(
      classifyDiscoveryFailure('legacy', {
        statusCode: 400,
        code: 'bad_request',
        message: 'Bad request',
      }),
    ).toEqual({
      lane: 'legacy',
      kind: 'http',
      statusCode: 400,
      retryable: false,
    });
  });
});
