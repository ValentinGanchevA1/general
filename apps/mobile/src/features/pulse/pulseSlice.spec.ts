import pulseReducer, { fetchFeed } from './pulseSlice';

describe('pulse error presentation', () => {
  it('never copies raw thunk error.message into user-facing Redux state', () => {
    const action = fetchFeed.rejected(
      new Error('Request failed with status code 500'),
      'pulse-request-1',
      undefined,
    );

    const state = pulseReducer(undefined, action);

    expect(action.error.message).toBe('Request failed with status code 500');
    expect(state.error).toBe('Failed to load Pulse');
    expect(state.error).not.toContain('status code 500');
  });
});
