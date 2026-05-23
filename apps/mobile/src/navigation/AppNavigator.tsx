// apps/mobile/src/navigation/AppNavigator.tsx
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { MapScreen } from '@/screens/MapScreen';
import { PulseScreen } from '@/features/pulse/PulseScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { ProfileCreationScreen } from '@/screens/ProfileCreationScreen';
import { ProfileEditScreen } from '@/screens/ProfileEditScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { ActionHub } from '@/components/ActionHub';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { restoreSession } from '@/features/auth/authSlice';

export type PulseFilter = 'all' | 'chats' | 'waves' | 'listings' | 'alerts' | 'matches';

export type TabParamList = {
	Map: undefined;
	Pulse: { filter?: PulseFilter } | undefined;
	Profile: undefined;
};

export type RootStackParamList = {
	Auth: undefined;
	ProfileCreation: undefined;
	Main: NavigatorScreenParams<TabParamList> | undefined;
	Chat: { conversationId: string; otherUserName: string };
	ProfileEdit: undefined;
	Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs(): React.JSX.Element {
	return (
		<View style={{ flex: 1 }}>
			<Tab.Navigator
				screenOptions={({ route }) => ({
					headerShown: false,
					tabBarStyle: { backgroundColor: '#0a0a0f', borderTopColor: '#1a1a2e', height: 64, paddingTop: 6 },
					tabBarActiveTintColor: '#00d4ff',
					tabBarInactiveTintColor: '#555',
					tabBarIcon: ({ color, size }) => {
						const icons: Record<string, string> = {
							Map: 'map-marker-radius',
							Pulse: 'pulse',
							Profile: 'account-circle-outline',
						};
						return <MaterialCommunityIcons name={icons[route.name] ?? 'circle'} size={size} color={color} />;
					},
				})}
			>
				<Tab.Screen name="Map" component={MapScreen} />
				<Tab.Screen name="Pulse" component={PulseScreen} />
				<Tab.Screen name="Profile" component={ProfileScreen} />
			</Tab.Navigator>
			<ActionHub />
		</View>
	);
}

export function AppNavigator(): React.JSX.Element {
	const dispatch = useAppDispatch();
	const user = useAppSelector((s) => s.auth.user);
	const loading = useAppSelector((s) => s.auth.loading);

	useEffect(() => {
		void dispatch(restoreSession());
	}, [dispatch]);

	// Blank dark screen while we check for a stored session
	if (loading && user === null) {
		return <View style={{ flex: 1, backgroundColor: '#0a0a0f' }} />;
	}

	return (
		<NavigationContainer>
			<Stack.Navigator screenOptions={{ headerShown: false }}>
				{user ? (
					<>
						<Stack.Screen name="Main" component={MainTabs} />
						<Stack.Screen name="Chat" component={ChatScreen} />
						<Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
						<Stack.Screen name="Settings" component={SettingsScreen} />
					</>
				) : (
					<>
						<Stack.Screen name="Auth" component={AuthScreen} />
						<Stack.Screen name="ProfileCreation" component={ProfileCreationScreen} />
					</>
				)}
			</Stack.Navigator>
		</NavigationContainer>
	);
}
