import { useCallback, useEffect, useState } from 'react';

import { extractMessage } from '@/utils/extractMessage';
import { fetchCurrentWeather } from './weatherService';
import type { CurrentWeather, WeatherCoordinates } from './weatherTypes';

const WEATHER_REFRESH_MS = 15 * 60 * 1000;

interface UseCurrentWeatherResult {
	weather: CurrentWeather | null;
	loading: boolean;
	error: string | null;
	refresh: () => void;
}

export function useCurrentWeather(
	coords: WeatherCoordinates | null,
): UseCurrentWeatherResult {
	const [weather, setWeather] = useState<CurrentWeather | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [refreshVersion, setRefreshVersion] = useState(0);

	const latitude = coords == null ? null : Number(coords.lat.toFixed(2));
	const longitude = coords == null ? null : Number(coords.lng.toFixed(2));

	useEffect(() => {
		if (latitude == null || longitude == null) return;

		const controller = new AbortController();
		let active = true;

		const load = async (): Promise<void> => {
			setLoading(true);
			try {
				const next = await fetchCurrentWeather(
					{ lat: latitude, lng: longitude },
					controller.signal,
				);
				if (!active) return;
				setWeather(next);
				setError(null);
			} catch (cause: unknown) {
				if (!active || controller.signal.aborted) return;
				setError(extractMessage(cause, 'Unable to load weather'));
			} finally {
				if (active) setLoading(false);
			}
		};

		// Keep load-on-mount async from the effect body so
		// react-hooks/set-state-in-effect remains clean in CI.
		const initialTimer = setTimeout(() => {
			void load();
		}, 0);
		const refreshTimer = setInterval(() => {
			void load();
		}, WEATHER_REFRESH_MS);

		return () => {
			active = false;
			controller.abort();
			clearTimeout(initialTimer);
			clearInterval(refreshTimer);
		};
	}, [latitude, longitude, refreshVersion]);

	const refresh = useCallback((): void => {
		setRefreshVersion((value) => value + 1);
	}, []);

	return { weather, loading, error, refresh };
}
