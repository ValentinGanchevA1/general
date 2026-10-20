export type WeatherCondition =
	| 'clear'
	| 'partly-cloudy'
	| 'cloudy'
	| 'fog'
	| 'rain'
	| 'snow'
	| 'storm'
	| 'unknown';

export interface WeatherCoordinates {
	lat: number;
	lng: number;
}

export interface CurrentWeather {
	temperatureC: number;
	condition: WeatherCondition;
	isDay: boolean;
	fetchedAt: number;
}
