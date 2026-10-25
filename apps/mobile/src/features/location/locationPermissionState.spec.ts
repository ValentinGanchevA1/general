import {
  shouldRequestLocationPermission,
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
