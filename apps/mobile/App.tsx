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
import { track } from '@/lib/analytics';
import {
  navigationIntegration,
  recordNexaLaunchPerformance,
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
import { buildNexaLaunchTelemetryProps } from '@/components/Brand/nexaLaunchTelemetry';
import { getLastResolvedLaunchReduceMotion } from '@/components/Brand/resolveLaunchReduceMotion';
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
  const [launchStartedAtMs] = React.useState(() => Date.now());

  const authReadyAtRef = React.useRef<number | null>(
    restoring ? null : launchStartedAtMs,
  );
  const mapReadyAtRef = React.useRef<number | null>(null);
  const overlayHiddenAtRef = React.useRef<number | null>(null);
  const launchReduceMotionRef = React.useRef<boolean | null>(null);
  const launchTelemetrySentRef = React.useRef(false);

  const requiresMapSurface = React.useMemo(
    () =>
      shouldRunNexaSpatialHandoff({
        authenticated: user != null,
        profileSetupComplete,
      }),
    [profileSetupComplete, user],
  );

  React.useEffect(() => {
    if (!restoring && authReadyAtRef.current === null) {
      authReadyAtRef.current = Date.now();
    }
  }, [restoring]);

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

  const recordLaunchComplete = React.useCallback(
    (completedAtMs: number): void => {
      if (launchTelemetrySentRef.current) return;
      launchTelemetrySentRef.current = true;

      const telemetry = buildNexaLaunchTelemetryProps({
        startedAtMs: launchStartedAtMs,
        completedAtMs,
        authReadyAtMs: authReadyAtRef.current,
        mapReadyAtMs: mapReadyAtRef.current,
        overlayHiddenAtMs: overlayHiddenAtRef.current,
        requiresMapSurface,
        mapSurfaceWaitExpired,
        reducedMotion: launchReduceMotionRef.current,
      });

      track('nexa_launch_complete', telemetry);
      recordNexaLaunchPerformance({
        startedAtMs: launchStartedAtMs,
        completedAtMs,
        path: telemetry.path,
        totalMs: telemetry.totalMs,
        authReadyMs: telemetry.authReadyMs,
        mapReadyMs: telemetry.mapReadyMs,
        overlayHiddenMs: telemetry.overlayHiddenMs,
        mapReadyFailOpen: telemetry.mapReadyFailOpen,
        reducedMotion: telemetry.reducedMotion,
      });
    },
    [launchStartedAtMs, mapSurfaceWaitExpired, requiresMapSurface],
  );

  const handleMapSurfaceReady = React.useCallback((): void => {
    if (mapReadyAtRef.current === null) {
      mapReadyAtRef.current = Date.now();
    }
    setMapSurfaceReady(true);
  }, []);

  const handleLaunchHidden = React.useCallback((): void => {
    const hiddenAtMs = Date.now();
    if (overlayHiddenAtRef.current === null) {
      overlayHiddenAtRef.current = hiddenAtMs;
    }
    if (launchReduceMotionRef.current === null) {
      launchReduceMotionRef.current = getLastResolvedLaunchReduceMotion();
    }

    if (requiresMapSurface) {
      setShowSpatialHandoff(true);
      return;
    }
    setShowSpatialHandoff(false);
    setLaunchInteractionsReady(true);
    recordLaunchComplete(hiddenAtMs);
  }, [recordLaunchComplete, requiresMapSurface]);

  const handleSpatialHandoffComplete = React.useCallback((): void => {
    setShowSpatialHandoff(false);
    setLaunchInteractionsReady(true);
    recordLaunchComplete(Date.now());
  }, [recordLaunchComplete]);

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
        <UserLocationProvider
          key={user?.id ?? 'signed-out'}
          enabled={user != null}
        >
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
