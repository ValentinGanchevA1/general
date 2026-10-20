import { buildTrustEarnedChips } from './ProfileTrustBlock';

describe('buildTrustEarnedChips', () => {
  it('returns empty for verification none and no id', () => {
    expect(buildTrustEarnedChips('none', false)).toEqual([]);
  });

  it('email only', () => {
    expect(buildTrustEarnedChips('email', false).map((chip) => chip.label)).toEqual([
      'Email',
    ]);
  });

  it('phone includes email + phone', () => {
    expect(buildTrustEarnedChips('phone', false).map((chip) => chip.label)).toEqual([
      'Email',
      'Phone',
    ]);
  });

  it('selfie includes photo', () => {
    expect(buildTrustEarnedChips('selfie', false).map((chip) => chip.label)).toEqual([
      'Email',
      'Phone',
      'Photo',
    ]);
  });

  it('id verification level + idVerified includes explicit strong ID signal', () => {
    const chips = buildTrustEarnedChips('id', true);

    expect(chips.map((chip) => chip.label)).toEqual([
      'Email',
      'Phone',
      'Photo',
      'ID verified',
    ]);
    expect(chips.at(-1)).toEqual({ label: 'ID verified', strong: true });
  });
});
