import { classifyDiscoveryFailure } from '@/features/discovery/discoveryFailureDiagnostics';
import { transportFailureCode } from './transportFailureCode';

describe('transportFailureCode', () => {
  it.each(['ECONNABORTED', 'ETIMEDOUT'])('preserves Axios %s as timeout', (code) => {
    const normalized = { statusCode: 0, code: transportFailureCode({ code }) };
    expect(normalized.code).toBe('timeout');
    expect(classifyDiscoveryFailure('legacy', normalized)).toEqual({
      lane: 'legacy',
      kind: 'timeout',
      statusCode: 0,
      retryable: true,
    });
  });

  it('classifies generic transport failures as network without retaining details', () => {
    expect(transportFailureCode({ code: 'ERR_NETWORK', message: 'private URL' })).toBe('network');
    expect(transportFailureCode(new Error('private URL'))).toBe('network');
    expect(transportFailureCode(null)).toBe('network');
  });
});
