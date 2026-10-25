import {
  appAlert,
  bindAppAlertHost,
  dismissAppAlert,
  type AppAlertRequest,
} from './appAlert';

describe('appAlert user-facing error boundary', () => {
  afterEach(() => {
    dismissAppAlert();
    bindAppAlertHost(null);
  });

  it('sanitizes transport-level status messages before they reach the host', () => {
    let request: AppAlertRequest | null = null;
    bindAppAlertHost((next) => {
      request = next;
    });

    appAlert('Could not open chat', 'Request failed with status code 500');

    expect(request?.message).toBe('Something went wrong — try again in a moment');
  });

  it('preserves normal product-authored alert copy', () => {
    let request: AppAlertRequest | null = null;
    bindAppAlertHost((next) => {
      request = next;
    });

    appAlert('Blocked', "You won't see this user or hear from them.");

    expect(request?.message).toBe("You won't see this user or hear from them.");
  });
});
