import { buildTrustEarnedChips } from './ProfileTrustBlock';

describe('buildTrustEarnedChips', () => {
  it('returns empty for verification none and no id', () => {
    expect(buildTrustEarnedChips('none', false)).toEqual([]);
  });

  it('email only', () => {
    expect(buildTrustEarnedChips('email', false).map((c) => c.label)).toEqual(['Email']);
  });

  it('phone includes email + phone', () => {
    expect(buildTrustEarnedChips('phone', false).map((c) => c.label)).toEqual([
      'Email',
      'Phone',
    ]);
  });

  it('selfie includes photo', () => {
    expect(buildTrustEarnedChips('selfie', false).map((c) => c.label)).toEqual([
      'Email',
      'Phone',
      'Photo',
    ]);
  });

  it('id verification level + idVerified includes ID chip', () => {
    expect(buildTrustEarnedChips('id', true).map((c) => c.label)).toEqual([
      'Email',
      'Phone',
      'Photo',
      'ID',
    ]);
  });
});
