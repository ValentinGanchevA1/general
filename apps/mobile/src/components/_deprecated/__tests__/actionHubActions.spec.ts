// apps/mobile/src/components/__tests__/actionHubActions.spec.ts
import { ACTION_HUB_ACTIONS, findAction } from '../actionHubActions';

describe('ActionHub action map', () => {
  it('exposes all five activity types in the expected order', () => {
    expect(ACTION_HUB_ACTIONS.map((a) => a.filter)).toEqual([
      'chats', 'waves', 'alerts', 'listings', 'matches',
    ]);
  });

  it('each action declares an icon and a label', () => {
    for (const a of ACTION_HUB_ACTIONS) {
      expect(a.icon.length).toBeGreaterThan(0);
      expect(a.label.length).toBeGreaterThan(0);
    }
  });

  it('keys are unique', () => {
    const keys = ACTION_HUB_ACTIONS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('findAction resolves known keys', () => {
    expect(findAction('chats')?.filter).toBe('chats');
    expect(findAction('matches')?.filter).toBe('matches');
  });

  it('findAction returns undefined for unknown keys', () => {
    expect(findAction('nope')).toBeUndefined();
  });
});
