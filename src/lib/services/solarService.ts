/**
 * solarService.ts
 * 
 * Timezone-aware solar irradiance → kWh calculator.
 * Fixes the UTC-at-night bug by always fetching Open-Meteo with timezone=auto
 * so returned timestamps are in the property's local time.
 *
 * Never produces negative kWh. Returns 0 for all night hours.
 */

import { prisma } from '../prisma';

const SYSTEM_LOSS_FACTOR = 0.75; // typical panel + inverter efficiency

export interface HourlyForecast {
  hour: number;         // local hour 0-23
  estimatedKwh: number; // always >= 0
  isEstimated: boolean;
  irradianceWm2: number;
}

/**
 * Get today's solar forecast for a system.
 * Returns cached data if already stored today (local date).
 */
export async function getTodayForecast(systemId: string): Promise<HourlyForecast[]> {
  const system = await prisma.solarSystem.findUnique({ where: { id: systemId } });
  if (!system) throw new Error('System not found');

  const tz = system.timezone || 'UTC';

  // Compute today's local date string (YYYY-MM-DD)
  const localDateStr = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // "en-CA" → YYYY-MM-DD
  // Store the cache date as midnight UTC of localDate
  const cacheDate = new Date(localDateStr + 'T00:00:00.000Z');

  // Check cache
  const cached = await prisma.productionForecast.findMany({
    where: { solarSystemId: systemId, date: cacheDate },
    orderBy: { hour: 'asc' },
  });

  if (cached.length === 24) {
    return cached.map(c => ({
      hour: c.hour,
      estimatedKwh: c.estimatedKwh,
      isEstimated: c.isEstimated,
      irradianceWm2: 0, // not stored in legacy model
    }));
  }

  // Clear stale cache for this date
  if (cached.length > 0) {
    await prisma.productionForecast.deleteMany({
      where: { solarSystemId: systemId, date: cacheDate },
    });
  }

  return fetchAndCacheForecast(system, cacheDate, tz);
}

/**
 * Fetch from Open-Meteo with timezone=auto so timestamps come back in local time.
 * Parse the returned time strings to extract local hours.
 */
async function fetchAndCacheForecast(
  system: { id: string; latitude: number; longitude: number; capacityKw: number; timezone: string },
  cacheDate: Date,
  tz: string
): Promise<HourlyForecast[]> {
  // Use both direct normal irradiance AND global tilted irradiance for better accuracy
  // timezone=auto → Open-Meteo returns local timestamps matching the lat/lon
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${system.latitude}` +
    `&longitude=${system.longitude}` +
    `&hourly=direct_normal_irradiance,global_tilted_irradiance,shortwave_radiation` +
    `&timezone=auto` +
    `&forecast_days=2`; // fetch 2 days so we have full local day even at boundaries

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
    const data = await res.json();

    const times: string[] = data.hourly.time; // ISO local strings like "2024-09-07T06:00"
    const dniValues: number[] = data.hourly.direct_normal_irradiance;
    const gtiValues: number[] = data.hourly.global_tilted_irradiance;
    const swrValues: number[] = data.hourly.shortwave_radiation;

    // localDateStr = "YYYY-MM-DD" portion we want
    const targetDateStr = cacheDate.toISOString().slice(0, 10);

    // Build a map hour → irradiance for today only
    const hourlyData: Map<number, { dni: number; gti: number; swr: number }> = new Map();

    for (let i = 0; i < times.length; i++) {
      // times[i] looks like "2024-09-07T06:00" (local, no Z)
      const timeStr = times[i];
      const datePart = timeStr.slice(0, 10); // "YYYY-MM-DD"
      if (datePart !== targetDateStr) continue;

      const hour = parseInt(timeStr.slice(11, 13), 10); // extract HH
      hourlyData.set(hour, {
        dni: Math.max(0, dniValues[i] ?? 0),
        gti: Math.max(0, gtiValues[i] ?? 0),
        swr: Math.max(0, swrValues[i] ?? 0),
      });
    }

    const results: HourlyForecast[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const irr = hourlyData.get(hour);
      // Use GHI (shortwave_radiation) as primary, fall back to DNI
      // GHI represents total horizontal irradiance which is best proxy for flat/tilted panels
      const bestIrradiance = irr
        ? Math.max(0, irr.gti > 0 ? irr.gti : irr.swr > 0 ? irr.swr : irr.dni)
        : 0;

      // kWh = (W/m² / 1000) × capacity_kW × loss_factor × 1 hour
      const estimatedKwh = (bestIrradiance / 1000) * system.capacityKw * SYSTEM_LOSS_FACTOR;

      results.push({
        hour,
        estimatedKwh: Math.max(0, estimatedKwh), // never negative
        isEstimated: true,
        irradianceWm2: bestIrradiance,
      });
    }

    // Cache to DB
    await prisma.productionForecast.createMany({
      data: results.map(r => ({
        solarSystemId: system.id,
        date: cacheDate,
        hour: r.hour,
        estimatedKwh: r.estimatedKwh,
        isEstimated: true,
      })),
    });

    return results;
  } catch (err) {
    console.error('[solarService] Forecast fetch failed:', err);
    // Graceful fallback: return synthetic bell-curve solar profile
    return syntheticFallback(system.capacityKw);
  }
}

/**
 * Synthetic fallback when API is unavailable.
 * Uses a simple bell curve centred at noon, only during daylight hours (6am-6pm).
 */
function syntheticFallback(capacityKw: number): HourlyForecast[] {
  return Array.from({ length: 24 }, (_, hour) => {
    let estimatedKwh = 0;
    if (hour >= 6 && hour < 18) {
      // Bell curve: peak at hour 12
      const x = (hour - 6) / 12; // 0 to 1
      const bell = Math.sin(x * Math.PI); // 0→1→0
      estimatedKwh = bell * capacityKw * SYSTEM_LOSS_FACTOR * 0.8;
    }
    return { hour, estimatedKwh: Math.max(0, estimatedKwh), isEstimated: true, irradianceWm2: 0 };
  });
}

/**
 * Calculate the best 3-hour contiguous window for appliance scheduling.
 * Only considers daytime hours (must have positive solar).
 * Returns the start hour of the best window.
 */
export function findBestApplianceWindow(forecast: HourlyForecast[]): number {
  const daylightHours = forecast.filter(f => f.estimatedKwh > 0);
  if (daylightHours.length < 3) return -1;

  let bestStart = -1;
  let maxSum = -1;

  for (let i = 0; i <= forecast.length - 3; i++) {
    // Only consider windows that are fully within daylight
    const windowHours = [forecast[i], forecast[i + 1], forecast[i + 2]];
    const allDaylight = windowHours.every(h => h.estimatedKwh > 0);
    if (!allDaylight) continue;

    const sum = windowHours.reduce((acc, h) => acc + h.estimatedKwh, 0);
    if (sum > maxSum) {
      maxSum = sum;
      bestStart = i;
    }
  }

  return bestStart;
}
