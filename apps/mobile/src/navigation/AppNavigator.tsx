import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { restoreSession, logout } from '@/features/auth/authSlice';
import { fetchProfile } from '@/features/profile/profileSlice';
import { authEvents } from '@/api/client';

import { AuthScreen } from '@/screens/AuthScreen';
import { MapScreen } from '@/screens/MapScreen';
import { InboxScreen } from '@/screens/InboxScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { ProfileCreationScreen } from '@/screens/ProfileCreationScreen';
import { ProfileEditScreen } from '@/screens/ProfileEditScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';

export type RootStackParamList = {
  Auth: undefined;
  ProfileCreation: undefined;
  Main: undefined;
  Chat: { conversationId: string; otherUserName: string };
  ProfileEdit: undefined;
  Settings: undefined;
};

export type TabParamList = {
  Map: undefined;
  Inbox: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0a0a0f', borderTopColor: '#1a1a2e' },
        tabBarActiveTintColor: '#00d4ff',
        tabBarInactiveTintColor: '#555',
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            Map: 'map-marker-radius',
            Inbox: 'message-outline',
            Profile: 'account-circle-outline',
          };
          return <MaterialCommunityIcons name={icons[route.name] ?? 'circle'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Inbox" component={InboxScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const authLoading = useAppSelector((s) => s.auth.loading);
  const profileInitialized = useAppSelector((s) => s.profile.initialized);
  const profileComplete = useAppSelector((s) => s.profile.profile?.profileComplete ?? false);

  const prevUserIdRef = useRef<string | null>(null);

  // Bootstrap session on mount.
  useEffect(() => {
    void dispatch(restoreSession());
  }, [dispatch]);

  // Fetch profile whenever a user signs in (null → non-null transition).
  useEffect(() => {
    const prev = prevUserIdRef.current;
    const curr = user?.id ?? null;
    prevUserIdRef.current = curr;
    if (curr && curr !== prev) {
      void dispatch(fetchProfile());
    }
  }, [dispatch, user?.id]);

  // Handle forced logout from expired refresh token.
  useEffect(() => {
    return authEvents.on('logout', () => {
      dispatch(logout());
    });
  }, [dispatch]);

  // Show spinner while restoring session or waiting for first profile fetch.
  const showSpinner = authLoading || (!!user && !profileInitialized);
  if (showSpinner) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' }}>
        <ActivityIndicator color="#00d4ff" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : !profileComplete ? (
          <Stack.Screen name="ProfileCreation" component={ProfileCreationScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({
                headerShown: true,
                title: route.params.otherUserName,
                headerStyle: { backgroundColor: '#0a0a0f' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: '600' },
              })}
            />
            <Stack.Screen
              name="ProfileEdit"
              component={ProfileEditScreen}
              options={{
                headerShown: true,
                title: 'Edit Profile',
                headerStyle: { backgroundColor: '#0a0a0f' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                headerShown: true,
                title: 'Settings',
                headerStyle: { backgroundColor: '#0a0a0f' },
                headerTintColor: '#fff',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
