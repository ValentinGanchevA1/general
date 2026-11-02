import { Config } from '@/config';

export type E2EDeviceProbeEvent =
  | 'location_started'
  | 'location_update'
  | 'location_ended';

/**
 * CI-only device probe for realtime privacy regression tests.
 *
 * The probe is disabled in every normal build. When explicitly enabled at
 * bundle time, it emits only a fixed event-type marker. Never add coordinates,
 * user/conversation/session IDs, tokens, message text, or other payload data.
 */
export function emitE2EDeviceProbe(event: E2EDeviceProbeEvent): void {
  if (!Config.E2E_DEVICE_PROBE) return;

  // eslint-disable-next-line no-console
  console.log(`[NEXA_E2E_DEVICE] ${event}`);
}
