import { buildPublicProfileActivity } from './ProfileStatsRow';

describe('NEXA public profile activity', () => {
  it('keeps level and earned achievements', () => {
    expect(buildPublicProfileActivity(7, ['🏆', '⚡', '🗺️', 'extra'])).toEqual({
      level: 7,
      achievementIcons: ['🏆', '⚡', '🗺️'],
    });
  });

  it('does not accept leaderboard rank as a public presentation input', () => {
    const activity = buildPublicProfileActivity(null, []);

    expect(activity).toEqual({
      level: null,
      achievementIcons: [],
    });
    expect('allTimeRank' in activity).toBe(false);
  });
});
