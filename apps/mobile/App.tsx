import * as Sentry from '@sentry/react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
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
import { ThemeProvider } from '@/theme';
import { useAppSelector } from '@/hooks/redux';
import { NexaLaunchOverlay } from '@/components/Brand/NexaLaunchOverlay';

Sentry.init({
  dsn: Config.SENTRY_DSN,
  enabled: !__DEV__ && !!Config.SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  // Tie events to the build that produced them (must match CI / upload release name).
  release: resolveSentryRelease(),
  dist: resolveSentryDist(),
  sendDefaultPii: false,
  // Performance tracing — 100% in local validation builds; sample in prod.
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  integrations: [navigationIntegration],
  // Shared PII/secret scrubber (OB1) — same denylist + token redaction as the
  // backend. Last line of defence before anything leaves the device.
  beforeSend: (event) => scrubSentryPayload(event),
  beforeBreadcrumb: (breadcrumb) => scrubSentryPayload(breadcrumb),
});

GoogleSignin.configure({ webClientId: Config.GOOGLE_WEB_CLIENT_ID });

function AppShell(): React.JSX.Element {
  const restoring = useAppSelector((state) => state.auth.restoring);

  return (
    <View style={styles.root}>
      <AppNavigator />
      <NexaLaunchOverlay ready={!restoring} />
    </View>
  );
}

function App(): React.JSX.Element {
  // BottomSheetModalProvider lives inside NavigationContainer (AppNavigator)
  // so portal content keeps navigation context (EntityBottomSheet useNavigation).
  return (
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AppShell />
          </ThemeProvider>
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default Sentry.wrap(App);
