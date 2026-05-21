import React from 'react';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { store } from '@/store';
import { AppNavigator } from '@/navigation/AppNavigator';
import { Config } from '@/config';

GoogleSignin.configure({ webClientId: Config.GOOGLE_WEB_CLIENT_ID });

export default function App(): React.JSX.Element {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </Provider>
  );
}
