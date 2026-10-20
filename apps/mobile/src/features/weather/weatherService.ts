import type {
	CurrentWeather,
	WeatherCondition,
	WeatherCoordinates,
} from './weatherTypes';

interface OpenMeteoCurrent {
	temperature_2m: number;
	weather_code: number;
	is_day: number;
}

interface OpenMeteoResponse {
	current?: OpenMeteoCurrent;
}

function mapWeatherCode(code: number): WeatherCondition {
	if (code === 0) return 'clear';
	if (code === 1 || code === 2) return 'partly-cloudy';
	if (code === 3) return 'cloudy';
	if (code === 45 || code === 48) return 'fog';
	if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
	if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
	if (code >= 95 && code <= 99) return 'storm';
	return 'unknown';
}

/**
 * Weather does not need exact GPS precision. Rounding to 2 decimals keeps the
 * request stable across normal GPS jitter and avoids sending unnecessarily
 * precise coordinates to the weather provider.
 */
export function quantizeWeatherCoordinates(
	coords: WeatherCoordinates,
): WeatherCoordinates {
	return {
		lat: Number(coords.lat.toFixed(2)),
		lng: Number(coords.lng.toFixed(2)),
	};
}

export async function fetchCurrentWeather(
	coords: WeatherCoordinates,
	signal?: AbortSignal,
): Promise<CurrentWeather> {
	const location = quantizeWeatherCoordinates(coords);
	const url =
		'https://api.open-meteo.com/v1/forecast' +
		`?latitude=${location.lat}` +
		`&longitude=${location.lng}` +
		'&current=temperature_2m,weather_code,is_day' +
		'&timezone=auto';

	const response = await fetch(url, { signal });
	if (!response.ok) {
		throw new Error(`Weather request failed: ${response.status}`);
	}

	const body = (await response.json()) as OpenMeteoResponse;
	if (body.current == null) {
		throw new Error('Weather response does not contain current conditions');
	}

	return {
		temperatureC: Math.round(body.current.temperature_2m),
		condition: mapWeatherCode(body.current.weather_code),
		isDay: body.current.is_day === 1,
		fetchedAt: Date.now(),
	};
}
