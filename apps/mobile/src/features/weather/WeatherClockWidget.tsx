import React, { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme } from '@/theme';

import { useCurrentWeather } from './useCurrentWeather';
import type { WeatherCondition, WeatherCoordinates } from './weatherTypes';

interface Props {
	coords: WeatherCoordinates | null;
	top: number;
	right: number;
}

function weatherIconName(condition: WeatherCondition, isDay: boolean): string {
	switch (condition) {
		case 'clear':
			return isDay ? 'weather-sunny' : 'weather-night';
		case 'partly-cloudy':
			return isDay ? 'weather-partly-cloudy' : 'weather-night-partly-cloudy';
		case 'cloudy':
			return 'weather-cloudy';
		case 'fog':
			return 'weather-fog';
		case 'rain':
			return 'weather-rainy';
		case 'snow':
			return 'weather-snowy';
		case 'storm':
			return 'weather-lightning-rainy';
		default:
			return 'weather-cloudy-alert';
	}
}

function formatClock(date: Date): string {
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${hours}:${minutes}`;
}

export function WeatherClockWidget({
	coords,
	top,
	right,
}: Props): React.JSX.Element {
	const { colors, shadow } = useAppTheme();
	const { weather, loading, refresh } = useCurrentWeather(coords);
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 30_000);
		return () => clearInterval(timer);
	}, []);

	const iconName = useMemo(
		() =>
			weather == null
				? 'weather-cloudy'
				: weatherIconName(weather.condition, weather.isDay),
		[weather],
	);

	const temperature = weather == null ? '--°' : `${weather.temperatureC}°`;
	const clock = formatClock(now);

	return (
		<Pressable
			onPress={refresh}
			accessibilityRole="button"
			accessibilityLabel={`Weather ${temperature}, local time ${clock}. Tap to refresh.`}
			style={[
				styles.container,
				{
					top,
					right,
					backgroundColor: colors.surfaceRaised,
					borderColor: colors.borderSubtle,
				},
				shadow(0.12),
			]}
		>
			<View style={styles.weatherRow}>
				{loading && weather == null ? (
					<ActivityIndicator size="small" color={colors.primary} />
				) : (
					<Icon name={iconName} size={19} color={colors.warning} />
				)}
				<Text style={[styles.temperature, { color: colors.textPrimary }]}>
					{temperature}
				</Text>
			</View>

			<View style={styles.clockRow}>
				<Icon name="clock-outline" size={12} color={colors.info} />
				<Text style={[styles.clock, { color: colors.textSecondary }]}>{clock}</Text>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		width: 80,
		height: 56,
		borderRadius: 16,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 22,
	},
	weatherRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 5,
	},
	temperature: {
		fontSize: 16,
		fontWeight: '800',
	},
	clockRow: {
		marginTop: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 3,
	},
	clock: {
		fontSize: 10,
		fontWeight: '700',
	},
});
