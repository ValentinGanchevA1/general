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
