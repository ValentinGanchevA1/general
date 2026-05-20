import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { restoreSession } from '@/features/auth/authSlice';
import { AuthScreen } from '@/screens/AuthScreen';
import { MapScreen } from '@/screens/MapScreen';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type TabParamList = {
  Map: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0a0a0f' },
        tabBarActiveTintColor: '#00d4ff',
        tabBarInactiveTintColor: '#555',
      }}
    >
      <Tab.Screen name="Map" component={MapScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { user, loading } = useAppSelector((s) => s.auth);

  useEffect(() => {
    void dispatch(restoreSession());
  }, [dispatch]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' }}>
        <ActivityIndicator color="#00d4ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
