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
    const requests: AppAlertRequest[] = [];
    bindAppAlertHost((next) => {
      if (next) requests.push(next);
    });

    appAlert('Could not open chat', 'Request failed with status code 500');

    expect(requests[0]?.message).toBe('Something went wrong — try again in a moment');
  });

  it('preserves normal product-authored alert copy', () => {
    const requests: AppAlertRequest[] = [];
    bindAppAlertHost((next) => {
      if (next) requests.push(next);
    });

    appAlert('Blocked', "You won't see this user or hear from them.");

    expect(requests[0]?.message).toBe("You won't see this user or hear from them.");
  });
});
