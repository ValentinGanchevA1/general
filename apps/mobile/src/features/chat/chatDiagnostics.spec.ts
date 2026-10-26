import reducer, { fetchConversations } from './chatSlice';
import {
  classifyConversationRefreshFailure,
  type ConversationRefreshFailure,
} from './chatDiagnostics';

describe('classifyConversationRefreshFailure', () => {
  it.each([
    [{ statusCode: 0, code: 'network' }, { failureClass: 'network', statusCode: 0 }],
    [
      { statusCode: 0, code: 'refresh_unavailable' },
      { failureClass: 'refresh_unavailable', statusCode: 0 },
    ],
    [{ statusCode: 401, code: 'unknown' }, { failureClass: 'unauthorized', statusCode: 401 }],
    [{ statusCode: 403, code: 'unknown' }, { failureClass: 'forbidden', statusCode: 403 }],
    [{ statusCode: 429, code: 'unknown' }, { failureClass: 'rate_limited', statusCode: 429 }],
    [{ statusCode: 500, code: 'unknown' }, { failureClass: 'server', statusCode: 500 }],
    [{ statusCode: 503, code: 'unknown' }, { failureClass: 'server', statusCode: 503 }],
    [{ statusCode: 418, code: 'teapot' }, { failureClass: 'unknown', statusCode: 418 }],
    [new Error('boom'), { failureClass: 'unknown', statusCode: null }],
  ] as const)('classifies %# without retaining free text', (error, expected) => {
    expect(classifyConversationRefreshFailure(error)).toEqual(expected);
  });
});

describe('chatSlice conversation refresh diagnostics', () => {
  const failure: ConversationRefreshFailure = {
    failureClass: 'server',
    statusCode: 503,
  };

  it('stores the structured rejection in Redux', () => {
    const action = fetchConversations.rejected(
      new Error('Service unavailable'),
      'request-1',
      undefined,
      { message: 'Failed to load conversations', failure },
    );

    const state = reducer(undefined, action);

    expect(state.conversationsLoading).toBe(false);
    expect(state.conversationsError).toEqual(failure);
  });

  it('clears stale diagnostics when a retry starts and succeeds', () => {
    const rejected = fetchConversations.rejected(
      new Error('Service unavailable'),
      'request-1',
      undefined,
      { message: 'Failed to load conversations', failure },
    );
    let state = reducer(undefined, rejected);

    state = reducer(state, fetchConversations.pending('request-2', undefined));
    expect(state.conversationsError).toBeNull();
    expect(state.conversationsLoading).toBe(true);

    state = reducer(state, fetchConversations.fulfilled([], 'request-2', undefined));
    expect(state.conversationsError).toBeNull();
    expect(state.conversationsLoading).toBe(false);
  });
});
