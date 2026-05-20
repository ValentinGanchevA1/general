import React from 'react';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { store } from '@/store';
import { AppNavigator } from '@/navigation/AppNavigator';

export default function App(): React.JSX.Element {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </Provider>
  );
}
