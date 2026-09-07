/**
 * weatherService.ts
 * 
 * Fetches current weather and 7-day forecast from Open-Meteo (free, no API key).
 * Weather data is used by the energy decision engine to adjust recommendations.
 */

export interface CurrentWeather {
  temperature: number;        // °C
  cloudCoverPercent: number;  // 0-100
  precipitationMm: number;    // mm
  windSpeedKmh: number;
  weatherCode: number;        // WMO code
  weatherDescription: string;
  isDay: boolean;
  uvIndex: number;
  shortwaveRadiation: number; // W/m²
  feelsLike: number;          // °C
}

export interface DailyWeatherForecast {
  date: string;               // YYYY-MM-DD local
  sunrise: string;            // HH:MM local
  sunset: string;             // HH:MM local
  maxTempC: number;
  minTempC: number;
  precipitationMm: number;
  precipitationProbability: number; // 0-100
  cloudCoverAvgPercent: number;
  uvIndexMax: number;
  solarRadiationSum: number;  // MJ/m²
  weatherCode: number;
  weatherDescription: string;
  estimatedSolarFactor: number; // 0-1 multiplier for solar generation
}

export interface HourlyWeatherForecast {
  time: string;               // ISO "YYYY-MM-DDTHH:MM" local
  hour: number;               // local 0-23
  date: string;               // YYYY-MM-DD
  cloudCoverPercent: number;
  precipitationMm: number;
  shortwaveRadiation: number; // W/m²
  temperature: number;        // °C
  isDay: number;              // 0 or 1
  weatherCode: number;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyWeatherForecast[];
  daily: DailyWeatherForecast[];
  timezone: string;
  fetchedAt: string;
}

// WMO weather interpretation codes
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Heavy drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  80: 'Slight showers', 81: 'Moderate showers', 82: 'Heavy showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Thunderstorm + heavy hail',
};

function describeWeather(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? `Weather code ${code}`;
}

/**
 * Calculate how much a weather condition reduces solar generation.
 * Returns a multiplier 0-1 (1 = clear, 0 = fully overcast/rainy).
 */
export function solarReductionFactor(cloudCoverPercent: number, weatherCode: number): number {
  // Rain/thunderstorm codes
  if ([61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode)) return 0.1;
  if ([51, 53, 55].includes(weatherCode)) return 0.2;
  if ([71, 73, 75, 85, 86].includes(weatherCode)) return 0.15;
  if ([45, 48].includes(weatherCode)) return 0.2;

  // Cloud cover based reduction
  const cloudFactor = 1 - (cloudCoverPercent / 100) * 0.8;
  return Math.max(0.05, Math.min(1, cloudFactor));
}

let weatherCache: Map<string, { data: WeatherData; expiresAt: number }> = new Map();

export async function getWeatherData(
  latitude: number,
  longitude: number,
  timezone: string
): Promise<WeatherData | null> {
  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,` +
    `precipitation,weather_code,cloud_cover,wind_speed_10m,uv_index,shortwave_radiation` +
    `&hourly=temperature_2m,precipitation,cloud_cover,shortwave_radiation,is_day,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,` +
    `precipitation_sum,precipitation_probability_max,uv_index_max,shortwave_radiation_sum` +
    `&timezone=auto&forecast_days=7`;

  try {
    const res = await fetch(url, { next: { revalidate: 1800 } }); // 30-min cache
    if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
    const raw = await res.json();

    const c = raw.current;
    const current: CurrentWeather = {
      temperature: c.temperature_2m,
      cloudCoverPercent: c.cloud_cover,
      precipitationMm: c.precipitation,
      windSpeedKmh: c.wind_speed_10m,
      weatherCode: c.weather_code,
      weatherDescription: describeWeather(c.weather_code),
      isDay: c.is_day === 1,
      uvIndex: c.uv_index,
      shortwaveRadiation: c.shortwave_radiation,
      feelsLike: c.apparent_temperature,
    };

    const hourly: HourlyWeatherForecast[] = raw.hourly.time.map((t: string, i: number) => ({
      time: t,
      hour: parseInt(t.slice(11, 13), 10),
      date: t.slice(0, 10),
      cloudCoverPercent: raw.hourly.cloud_cover[i] ?? 0,
      precipitationMm: raw.hourly.precipitation[i] ?? 0,
      shortwaveRadiation: raw.hourly.shortwave_radiation[i] ?? 0,
      temperature: raw.hourly.temperature_2m[i] ?? 0,
      isDay: raw.hourly.is_day[i] ?? 0,
      weatherCode: raw.hourly.weather_code[i] ?? 0,
    }));

    const daily: DailyWeatherForecast[] = raw.daily.time.map((d: string, i: number) => {
      const cloudAvg = hourly
        .filter(h => h.date === d)
        .reduce((sum, h) => sum + h.cloudCoverPercent, 0) /
        Math.max(1, hourly.filter(h => h.date === d).length);

      const code = raw.daily.weather_code[i];
      return {
        date: d,
        sunrise: raw.daily.sunrise[i]?.slice(11, 16) ?? '06:00',
        sunset: raw.daily.sunset[i]?.slice(11, 16) ?? '18:00',
        maxTempC: raw.daily.temperature_2m_max[i],
        minTempC: raw.daily.temperature_2m_min[i],
        precipitationMm: raw.daily.precipitation_sum[i] ?? 0,
        precipitationProbability: raw.daily.precipitation_probability_max[i] ?? 0,
        cloudCoverAvgPercent: cloudAvg,
        uvIndexMax: raw.daily.uv_index_max[i] ?? 0,
        solarRadiationSum: raw.daily.shortwave_radiation_sum[i] ?? 0,
        weatherCode: code,
        weatherDescription: describeWeather(code),
        estimatedSolarFactor: solarReductionFactor(cloudAvg, code),
      };
    });

    const weatherData: WeatherData = {
      current,
      hourly,
      daily,
      timezone: raw.timezone ?? timezone,
      fetchedAt: new Date().toISOString(),
    };

    // Cache for 30 minutes
    weatherCache.set(cacheKey, { data: weatherData, expiresAt: Date.now() + 30 * 60 * 1000 });
    return weatherData;
  } catch (err) {
    console.error('[weatherService] Failed:', err);
    return null;
  }
}
