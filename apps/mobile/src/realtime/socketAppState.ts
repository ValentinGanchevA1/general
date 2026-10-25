import type { AppStateStatus } from 'react-native';

export type SocketAppStateAction = 'connect' | 'disconnect' | 'none';

/**
 * Realtime transport is foreground-only. Background/inactive always requests a
 * disconnect so an in-flight connection or reconnection is also stopped.
 */
export function resolveSocketAppStateAction(
  state: AppStateStatus,
  connected: boolean,
): SocketAppStateAction {
  if (state !== 'active') return 'disconnect';
  return connected ? 'none' : 'connect';
}
