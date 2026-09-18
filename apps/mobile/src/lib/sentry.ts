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
