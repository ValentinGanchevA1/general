import { resolveSocketAppStateAction } from './socketAppState';

describe('resolveSocketAppStateAction', () => {
  it('connects when the app is active and transport is disconnected', () => {
    expect(resolveSocketAppStateAction('active', false)).toBe('connect');
  });

  it('does nothing when the app is active and transport is already connected', () => {
    expect(resolveSocketAppStateAction('active', true)).toBe('none');
  });

  it.each(['inactive', 'background'] as const)(
    'disconnects in %s even when transport is not yet connected',
    (state) => {
      expect(resolveSocketAppStateAction(state, false)).toBe('disconnect');
      expect(resolveSocketAppStateAction(state, true)).toBe('disconnect');
    },
  );
});
