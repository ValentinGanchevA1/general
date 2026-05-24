import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export function UserProfileScreen({ route }: Props): React.JSX.Element {
	// The userId parameter is strongly typed based on your AppNavigator setup
	const { userId } = route.params;

	return (
		<View style={styles.container}>
			<Text style={styles.title}>User Profile</Text>
			<Text style={styles.subtitle}>Viewing user: {userId}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#0a0a0f', // Matching your app's dark theme
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
	},
	title: { color: '#ffffff', fontSize: 22, fontWeight: 'bold' },
	subtitle: { color: '#00d4ff', fontSize: 16, marginTop: 8 },
});
