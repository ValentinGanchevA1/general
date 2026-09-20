import { FriendsSuggestionsService } from './friends-suggestions.service';

/**
 * Ranking contract tests — pure score helpers mirrored from SQL formula.
 * Integration SQL is covered via listSuggestions mock path + ordering cases.
 */

function rankScore(input: {
  mutualCount: number;
  wave: boolean;
  chat: boolean;
  distanceM: number | null;
  verification: string;
  sharedInterests: number;
  sharedGoals: number;
}): number {
  const near = 2_000;
  const city = 10_000;
  const prox =
    input.distanceM != null && input.distanceM <= near
      ? 1.0
      : input.distanceM != null && input.distanceM <= city
        ? 0.5
        : 0.0;
  const ver =
    input.verification === 'id'
      ? 0.5
      : input.verification === 'phone'
        ? 0.35
        : input.verification === 'email'
          ? 0.2
          : 0.0;
  return (
    (3.0 * Math.log(1 + input.mutualCount)) / Math.log(2) +
    2.0 * (input.wave ? 1 : 0) +
    1.5 * (input.chat ? 1 : 0) +
    prox +
    ver +
    Math.min(input.sharedInterests, 5) / 5 +
    0.5 * (Math.min(input.sharedGoals, 3) / 3)
  );
}

describe('FriendsSuggestionsService ranking formula', () => {
  it('ranks high mutual density above a lone recent wave', () => {
    const mutualHeavy = rankScore({
      mutualCount: 5,
      wave: false,
      chat: false,
      distanceM: null,
      verification: 'none',
      sharedInterests: 0,
      sharedGoals: 0,
    });
    const waveOnly = rankScore({
      mutualCount: 0,
      wave: true,
      chat: false,
      distanceM: null,
      verification: 'none',
      sharedInterests: 0,
      sharedGoals: 0,
    });
    expect(mutualHeavy).toBeGreaterThan(waveOnly);
  });

  it('boosts wave peer who also has mutuals over mutuals alone', () => {
    const both = rankScore({
      mutualCount: 2,
      wave: true,
      chat: false,
      distanceM: null,
      verification: 'none',
      sharedInterests: 0,
      sharedGoals: 0,
    });
    const mutualOnly = rankScore({
      mutualCount: 2,
      wave: false,
      chat: false,
      distanceM: null,
      verification: 'none',
      sharedInterests: 0,
      sharedGoals: 0,
    });
    expect(both).toBeGreaterThan(mutualOnly);
  });

  it('applies 2km full proximity boost and 10km half boost', () => {
    const near = rankScore({
      mutualCount: 0,
      wave: false,
      chat: false,
      distanceM: 1_500,
      verification: 'none',
      sharedInterests: 0,
      sharedGoals: 0,
    });
    const city = rankScore({
      mutualCount: 0,
      wave: false,
      chat: false,
      distanceM: 8_000,
      verification: 'none',
      sharedInterests: 0,
      sharedGoals: 0,
    });
    const far = rankScore({
      mutualCount: 0,
      wave: false,
      chat: false,
      distanceM: 50_000,
      verification: 'none',
      sharedInterests: 0,
      sharedGoals: 0,
    });
    expect(near).toBeGreaterThan(city);
    expect(city).toBeGreaterThan(far);
    expect(near - far).toBeCloseTo(1.0, 5);
    expect(city - far).toBeCloseTo(0.5, 5);
  });

  it('prefers verified ID over unverified at equal graph signals', () => {
    const idUser = rankScore({
      mutualCount: 1,
      wave: false,
      chat: false,
      distanceM: null,
      verification: 'id',
      sharedInterests: 0,
      sharedGoals: 0,
    });
    const noneUser = rankScore({
      mutualCount: 1,
      wave: false,
      chat: false,
      distanceM: null,
      verification: 'none',
      sharedInterests: 0,
      sharedGoals: 0,
    });
    expect(idUser).toBeGreaterThan(noneUser);
  });

  it('shared interests contribute positive score', () => {
    const shared = rankScore({
      mutualCount: 0,
      wave: false,
      chat: false,
      distanceM: null,
      verification: 'none',
      sharedInterests: 3,
      sharedGoals: 0,
    });
    const none = rankScore({
      mutualCount: 0,
      wave: false,
      chat: false,
      distanceM: null,
      verification: 'none',
      sharedInterests: 0,
      sharedGoals: 0,
    });
    expect(shared).toBeGreaterThan(none);
  });
});

describe('FriendsSuggestionsService.dismissSuggestion', () => {
  it('upserts permanent dismiss when no snooze', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        if (sql.includes('SELECT id FROM users')) return [{ id: params[0] }];
        return [];
      }),
    };
    const svc = new FriendsSuggestionsService(db as never);
    const res = await svc.dismissSuggestion('actor', 'target', {});
    expect(res).toEqual({ ok: true });
    const insert = queries.find((q) => q.sql.includes('INSERT INTO friend_suggestion_dismissals'));
    expect(insert).toBeDefined();
    expect(insert!.params[0]).toBe('actor');
    expect(insert!.params[1]).toBe('target');
    expect(insert!.params[2]).toBeNull();
  });

  it('snoozeDays sets future snooze_until', async () => {
    const db = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('SELECT id FROM users')) return [{ id: params[0] }];
        return [];
      }),
    };
    const svc = new FriendsSuggestionsService(db as never);
    const before = Date.now();
    await svc.dismissSuggestion('actor', 'target', { snoozeDays: 7 });
    const insertCall = (db.query as jest.Mock).mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('INSERT INTO friend_suggestion_dismissals'),
    );
    expect(insertCall).toBeDefined();
    const until = insertCall![1][2] as Date;
    expect(until).toBeInstanceOf(Date);
    expect(until.getTime()).toBeGreaterThan(before + 6 * 86_400_000);
    expect(until.getTime()).toBeLessThan(before + 8 * 86_400_000);
  });
});
