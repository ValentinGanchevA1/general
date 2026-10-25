import { statusFromAndroidPermissionCheck } from './locationPermissionState';

describe('statusFromAndroidPermissionCheck', () => {
  it('treats a granted quiet check as authoritative', () => {
    expect(statusFromAndroidPermissionCheck(true)).toBe('granted');
  });

  it('keeps a negative quiet check unknown until an explicit request resolves', () => {
    expect(statusFromAndroidPermissionCheck(false)).toBe('unknown');
  });
});
