/**
 * Sentry mobile bootstrap helpers.
 * Keep navigation integration here so App.tsx and AppNavigator can share
 * without a circular import.
 */
import * as Sentry from '@sentry/react-native';

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
  routeChangeTimeoutMs: 1_000,
  ignoreEmptyBackNavigationTransactions: true,
  useDispatchedActionData: true,
});

export interface NexaLaunchPerformanceInput {
  startedAtMs: number;
  completedAtMs: number;
  path: 'map' | 'non_map';
  totalMs: number;
  authReadyMs: number | null;
  mapReadyMs: number | null;
  overlayHiddenMs: number | null;
  mapReadyFailOpen: boolean;
  spatialHandoffUsed: boolean;
  reducedMotion: boolean | null;
  interrupted: boolean;
}

/**
 * Emit a sampled, queryable Sentry span for the completed branded launch flow.
 * The span is created after completion with explicit historical boundaries, so
 * no mutable tracing object survives React renders/background transitions.
 *
 * Foreground-interrupted launches use a separate span op. Their wall-clock
 * duration is still useful for diagnosis, but it must not pollute normal
 * `ui.load` launch latency distributions used for device calibration.
 */
export function recordNexaLaunchPerformance(
  input: NexaLaunchPerformanceInput,
): void {
  const attributes: Record<string, string | number | boolean> = {
    'nexa.launch.path': input.path,
    'nexa.launch.total_ms': input.totalMs,
    'nexa.launch.map_ready_fail_open': input.mapReadyFailOpen,
    'nexa.launch.spatial_handoff_used': input.spatialHandoffUsed,
    'nexa.launch.interrupted': input.interrupted,
  };

  if (input.authReadyMs !== null) {
    attributes['nexa.launch.auth_ready_ms'] = input.authReadyMs;
  }
  if (input.mapReadyMs !== null) {
    attributes['nexa.launch.map_ready_ms'] = input.mapReadyMs;
  }
  if (input.overlayHiddenMs !== null) {
    attributes['nexa.launch.overlay_hidden_ms'] = input.overlayHiddenMs;
  }
  if (input.reducedMotion !== null) {
    attributes['nexa.launch.reduced_motion'] = input.reducedMotion;
  }

  const span = Sentry.startInactiveSpan({
    name: 'NEXA branded launch',
    op: input.interrupted ? 'ui.load.interrupted' : 'ui.load',
    startTime: input.startedAtMs / 1_000,
    attributes,
  });
  span.end(input.completedAtMs / 1_000);
}

/**
 * Release string must match what CI / sentry-cli upload under for source maps
 * and native symbols to attach. Format: packageName@version+dist
 *
 * Override via build-time env (babel inline):
 *   SENTRY_RELEASE=com.g88@0.1.0+42
 *   SENTRY_DIST=42
 * CI android-apk sets these from package version + github.run_number.
 */
const PACKAGE_VERSION = '0.1.0';

export function resolveSentryRelease(): string {
  const fromEnv = process.env.SENTRY_RELEASE as string | undefined;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const dist = resolveSentryDist();
  return `com.g88@${PACKAGE_VERSION}+${dist}`;
}

export function resolveSentryDist(): string {
  const fromEnv =
    (process.env.SENTRY_DIST as string | undefined) ??
    (process.env.ANDROID_VERSION_CODE as string | undefined);
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return '0';
}
