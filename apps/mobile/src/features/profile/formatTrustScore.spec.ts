import { formatTrustScoreLabel, trustEmptyCopy } from './formatTrustScore';

describe('formatTrustScoreLabel', () => {
  it('returns em dash for null', () => {
    expect(formatTrustScoreLabel(null)).toBe('\u2014');
  });
  it('returns em dash for undefined', () => {
    expect(formatTrustScoreLabel(undefined)).toBe('\u2014');
  });
  it('returns em dash for zero', () => {
    expect(formatTrustScoreLabel(0)).toBe('\u2014');
  });
  it('returns em dash for negative', () => {
    expect(formatTrustScoreLabel(-1)).toBe('\u2014');
  });
  it('formats positive scores', () => {
    expect(formatTrustScoreLabel(42)).toBe('42%');
    expect(formatTrustScoreLabel(100)).toBe('100%');
  });
});

describe('trustEmptyCopy', () => {
  it('returns soft day-0 copy', () => {
    expect(trustEmptyCopy()).toBe('Just getting started');
  });
});
