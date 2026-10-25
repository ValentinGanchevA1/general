import {
  shouldRequestLocationPermission,
  statusFromAndroidForegroundCheck,
  statusFromAndroidPermissionCheck,
} from './locationPermissionState';

describe('statusFromAndroidPermissionCheck', () => {
  it('treats a granted quiet check as authoritative', () => {
    expect(statusFromAndroidPermissionCheck(true)).toBe('granted');
  });

  it('keeps a negative quiet check unknown until an explicit request resolves', () => {
    expect(statusFromAndroidPermissionCheck(false)).toBe('unknown');
  });
});

describe('statusFromAndroidForegroundCheck', () => {
  it('recognizes permission granted in settings', () => {
    expect(statusFromAndroidForegroundCheck(true, 'denied')).toBe('granted');
  });

  it('treats revocation of a previously granted permission as denied', () => {
    expect(statusFromAndroidForegroundCheck(false, 'granted')).toBe('denied');
  });

  it('preserves unknown when permission has never been requested', () => {
    expect(statusFromAndroidForegroundCheck(false, 'unknown')).toBe('unknown');
  });

  it('preserves an explicit denial on a negative foreground check', () => {
    expect(statusFromAndroidForegroundCheck(false, 'denied')).toBe('denied');
  });
});

describe('shouldRequestLocationPermission', () => {
  it('allows the initial automatic request while permission is unknown', () => {
    expect(shouldRequestLocationPermission('unknown', false)).toBe(true);
  });

  it('does not reopen native permission UI automatically after denial', () => {
    expect(shouldRequestLocationPermission('denied', false)).toBe(false);
  });

  it('allows a user-triggered retry after denial', () => {
    expect(shouldRequestLocationPermission('denied', true)).toBe(true);
  });

  it('does not request again once permission is granted', () => {
    expect(shouldRequestLocationPermission('granted', false)).toBe(false);
    expect(shouldRequestLocationPermission('granted', true)).toBe(false);
  });
});
