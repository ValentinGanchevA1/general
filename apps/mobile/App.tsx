import * as Sentry from '@sentry/react-native';
import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { scrubSentryPayload } from '@g88/shared';

import { store } from '@/store';
import { AppNavigator } from '@/navigation/AppNavigator';
import { Config } from '@/config';
import {
  navigationIntegration,
  resolveSentryDist,
  resolveSentryRelease,
} from '@/lib/sentry';
import { ThemeProvider, useAppTheme, type ProtosNexusEntitlement } from '@/theme';
import { useAppSelector } from '@/hooks/redux';
import { NexaLaunchOverlay } from '@/components/Brand/NexaLaunchOverlay';
import { NexaSpatialMapHandoff } from '@/components/Brand/NexaSpatialMapHandoff';
import { NexaLaunchSurfaceProvider } from '@/components/Brand/NexaLaunchSurfaceContext';
import { shouldRunNexaSpatialHandoff } from '@/components/Brand/nexaLaunchDestination';
import {
  NEXA_MAP_SURFACE_READY_FAIL_OPEN_MS,
  resolveNexaLaunchReady,
} from '@/components/Brand/nexaLaunchReadiness';
import { UserLocationProvider } from '@/features/location/UserLocationProvider';

Sentry.init({
  dsn: Config.SENTRY_DSN,
  enabled: !__DEV__ && !!Config.SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  release: resolveSentryRelease(),
  dist: resolveSentryDist(),
  sendDefaultPii: false,
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  integrations: [navigationIntegration],
  beforeSend: (event) => scrubSentryPayload(event),
  beforeBreadcrumb: (breadcrumb) => scrubSentryPayload(breadcrumb),
});

GoogleSignin.configure({ webClientId: Config.GOOGLE_WEB_CLIENT_ID });

function AppShell(): React.JSX.Element {
  const restoring = useAppSelector((state) => state.auth.restoring);
  const user = useAppSelector((state) => state.auth.user);
  const profileSetupComplete = useAppSelector(
    (state) => state.auth.profileSetupComplete,
  );
  const { colors, scheme } = useAppTheme();
  const [showSpatialHandoff, setShowSpatialHandoff] = React.useState(false);
  const [launchInteractionsReady, setLaunchInteractionsReady] = React.useState(false);
  const [mapSurfaceReady, setMapSurfaceReady] = React.useState(false);
  const [mapSurfaceWaitExpired, setMapSurfaceWaitExpired] = React.useState(false);

  const requiresMapSurface = React.useMemo(
    () =>
      shouldRunNexaSpatialHandoff({
        authenticated: user != null,
        profileSetupComplete,
      }),
    [profileSetupComplete, user],
  );

  React.useEffect(() => {
    if (restoring || !requiresMapSurface || mapSurfaceReady) return;
    const timer = setTimeout(
      () => setMapSurfaceWaitExpired(true),
      NEXA_MAP_SURFACE_READY_FAIL_OPEN_MS,
    );
    return () => clearTimeout(timer);
  }, [mapSurfaceReady, requiresMapSurface, restoring]);

  const launchReady = resolveNexaLaunchReady({
    restoring,
    requiresMapSurface,
    mapSurfaceReady,
    mapSurfaceWaitExpired,
  });

  const handleMapSurfaceReady = React.useCallback((): void => {
    setMapSurfaceReady(true);
  }, []);

  const handleLaunchHidden = React.useCallback((): void => {
    if (requiresMapSurface) {
      setShowSpatialHandoff(true);
      return;
    }
    setShowSpatialHandoff(false);
    setLaunchInteractionsReady(true);
  }, [requiresMapSurface]);

  const handleSpatialHandoffComplete = React.useCallback((): void => {
    setShowSpatialHandoff(false);
    setLaunchInteractionsReady(true);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <NexaLaunchSurfaceProvider
        onMapSurfaceReady={handleMapSurfaceReady}
        interactionsReady={launchInteractionsReady}
      >
        <UserLocationProvider enabled={user != null}>
          <AppNavigator />
        </UserLocationProvider>
      </NexaLaunchSurfaceProvider>
      <NexaLaunchOverlay ready={launchReady} onHidden={handleLaunchHidden} />
      {showSpatialHandoff ? (
        <NexaSpatialMapHandoff onComplete={handleSpatialHandoffComplete} />
      ) : null}
    </View>
  );
}

function EntitledThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const initialized = useAppSelector((state) => state.profile.initialized);
  const tier = useAppSelector((state) => state.profile.profile?.subscriptionTier);

  const canUseProtosNexus: ProtosNexusEntitlement = initialized
    ? tier === 'premium'
    : undefined;

  return (
    <ThemeProvider canUseProtosNexus={canUseProtosNexus}>
      {children}
    </ThemeProvider>
  );
}

function App(): React.JSX.Element {
  // BottomSheetModalProvider lives inside NavigationContainer (AppNavigator)
  // so portal content keeps navigation context (EntityBottomSheet useNavigation).
  return (
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>
        <SafeAreaProvider>
          <EntitledThemeProvider>
            <AppShell />
          </EntitledThemeProvider>
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default Sentry.wrap(App);