// apps/mobile/src/navigation/AppNavigator.tsx
import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { MapScreen } from '@/screens/MapScreen';
import { PulseScreen } from '@/features/pulse/PulseScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { ActionHub } from '@/components/ActionHub';

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
	return (
		<NavigationContainer>
			<Stack.Navigator>
				<Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
				<Stack.Screen name="ProfileCreation" component={ProfileScreen} options={{ headerShown: false }} />
				<Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
			</Stack.Navigator>
		</NavigationContainer>
	);
}
