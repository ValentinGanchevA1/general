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
  const { colors, scheme } = useAppTheme();
  const [showSpatialHandoff, setShowSpatialHandoff] = React.useState(false);

  const handleLaunchHidden = React.useCallback((): void => {
    setShowSpatialHandoff(true);
  }, []);

  const handleSpatialHandoffComplete = React.useCallback((): void => {
    setShowSpatialHandoff(false);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <AppNavigator />
      <NexaLaunchOverlay ready={!restoring} onHidden={handleLaunchHidden} />
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
