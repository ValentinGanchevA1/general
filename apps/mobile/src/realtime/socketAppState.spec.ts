import {
  resolveSocketAppStateAction,
  shouldReplayCachedPresence,
} from './socketAppState';

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

describe('shouldReplayCachedPresence', () => {
  it('replays cached presence only while active', () => {
    expect(shouldReplayCachedPresence('active', true)).toBe(true);
    expect(shouldReplayCachedPresence('background', true)).toBe(false);
    expect(shouldReplayCachedPresence('inactive', true)).toBe(false);
  });

  it('does not replay when no foreground presence was cached', () => {
    expect(shouldReplayCachedPresence('active', false)).toBe(false);
  });
});
