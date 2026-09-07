/**
 * energyDecisionEngine.ts
 *
 * Rule-based AI energy management engine.
 * Combines solar forecast, weather, battery SOC, grid pricing, and consumption
 * to produce actionable, time-windowed recommendations.
 *
 * Design: deterministic rules with confidence scoring.
 * No LLM required. Recommendations are derived from actual data.
 */

import type { HourlyForecast } from './solarService';
import type { WeatherData, DailyWeatherForecast } from './weatherService';

export type ActionCode =
  | 'SOLAR_DIRECT'
  | 'CHARGE_BATTERY'
  | 'USE_BATTERY'
  | 'USE_GRID'
  | 'EXPORT_SOLAR'
  | 'PRESERVE_BATTERY'
  | 'NO_ACTION';

export interface EnergyRecommendation {
  action: ActionCode;
  timeWindow: string;       // e.g. "Now" or "11:00 – 14:00"
  fromHour: number;
  toHour: number;
  reason: string;
  confidence: number;       // 0-100
  estimatedSavingRs: number;
  estimatedEnergyImpactKwh: number;
  priority: 'high' | 'medium' | 'low';
  dataQuality: 'measured' | 'estimated' | 'forecast';
}

export interface ApplianceWindow {
  applianceName: string;
  powerKw: number;
  durationMinutes: number;
  recommendedStartHour: number;
  recommendedEndHour: number;
  reason: string;
  estimatedSavingRs: number;
  confidence: number;
}

export interface EnergyDecisionResult {
  currentStatus: {
    solarKw: number;
    loadKw: number;
    batterySocPercent: number | null;
    batteryAvailableKwh: number | null;
    gridStatus: 'importing' | 'exporting' | 'off';
    surplusKw: number;
    timestamp: string;
    dataQuality: 'measured' | 'estimated';
  };
  primaryRecommendation: EnergyRecommendation;
  recommendations: EnergyRecommendation[];
  applianceWindows: ApplianceWindow[];
  todaySummary: {
    expectedSolarKwh: number;
    expectedConsumptionKwh: number;
    estimatedSavingsRs: number;
    estimatedGridUsageKwh: number;
    peakSolarHour: number;
  };
  weatherImpact: string;
  warnings: string[];
}

interface DecisionInput {
  system: {
    capacityKw: number;
    electricityRate: number;
    exportRate: number | null;
    batteryCapacityKwh: number | null;
    timezone: string;
  };
  forecast: HourlyForecast[];
  weather: WeatherData | null;
  currentHour: number;
  latestReading: {
    solarKwh: number | null;
    consumptionKwh: number | null;
    batterySocPercent: number | null;
    gridImportKwh: number | null;
    gridExportKwh: number | null;
  } | null;
  avgDailyConsumptionKwh: number;
  appliances: Array<{
    name: string;
    powerKw: number;
    durationMinutes: number;
    preferredStart: string | null;
    preferredEnd: string | null;
  }>;
}

export function runDecisionEngine(input: DecisionInput): EnergyDecisionResult {
  const {
    system,
    forecast,
    weather,
    currentHour,
    latestReading,
    avgDailyConsumptionKwh,
    appliances,
  } = input;

  const warnings: string[] = [];

  // ── Current snapshot ──────────────────────────────────────────────────────
  const currentForecast = forecast.find(f => f.hour === currentHour);
  const currentSolarKw = latestReading?.solarKwh
    ?? (currentForecast?.estimatedKwh ?? 0);

  const avgHourlyConsumption = avgDailyConsumptionKwh / 24;
  const currentLoadKw = latestReading?.consumptionKwh ?? avgHourlyConsumption;

  const batterySoc = latestReading?.batterySocPercent ?? null;
  const batteryCapacity = system.batteryCapacityKwh ?? null;
  const batteryAvailableKwh = batterySoc !== null && batteryCapacity !== null
    ? (batterySoc / 100) * batteryCapacity * 0.9 // 90% usable
    : null;

  const surplusKw = currentSolarKw - currentLoadKw;
  const isExporting = surplusKw > 0.1;
  const isImporting = surplusKw < -0.1;

  const dataQuality = latestReading?.solarKwh != null ? 'measured' : 'estimated';

  if (dataQuality === 'estimated') {
    warnings.push('No recent measured data available. Recommendations are based on forecasts.');
  }

  // ── Today summary ─────────────────────────────────────────────────────────
  const totalSolarToday = forecast.reduce((s, f) => s + f.estimatedKwh, 0);
  const peakHour = forecast.reduce((best, f) =>
    f.estimatedKwh > (forecast[best]?.estimatedKwh ?? 0) ? f.hour : best, 0);
  
  const weatherFactor = weather?.daily[0]?.estimatedSolarFactor ?? 1;
  const adjustedSolarKwh = totalSolarToday * weatherFactor;
  const daylightHours = forecast.filter(f => f.estimatedKwh > 0).length;

  // Savings: kWh from solar that offsets grid consumption
  const usableSolarKwh = Math.min(adjustedSolarKwh, avgDailyConsumptionKwh);
  const estimatedSavingsRs = usableSolarKwh * system.electricityRate;
  const estimatedGridUsageKwh = Math.max(0, avgDailyConsumptionKwh - adjustedSolarKwh);

  // ── Weather impact text ───────────────────────────────────────────────────
  let weatherImpact = '';
  if (!weather) {
    weatherImpact = 'Weather data unavailable. Solar forecast confidence is reduced.';
    warnings.push('Weather data could not be fetched. Using irradiance-only forecast.');
  } else {
    const today = weather.daily[0];
    const tomorrow = weather.daily[1];
    const cloud = Math.round(today?.cloudCoverAvgPercent ?? 0);
    const factor = Math.round((today?.estimatedSolarFactor ?? 1) * 100);
    weatherImpact = `${today?.weatherDescription ?? 'Unknown'} today. Estimated solar output at ${factor}% capacity (avg cloud cover ${cloud}%).`;
    
    if (tomorrow && tomorrow.estimatedSolarFactor < 0.5) {
      weatherImpact += ` Tomorrow: ${tomorrow.weatherDescription} — consider preserving battery capacity.`;
    }
  }

  // ── Build recommendations ─────────────────────────────────────────────────
  const recommendations: EnergyRecommendation[] = [];

  // --- Recommendation 1: Current hour action ---
  const primary = buildCurrentRecommendation({
    currentSolarKw, currentLoadKw, surplusKw,
    batterySoc, batteryAvailableKwh, batteryCapacity,
    currentHour, system, weather, dataQuality, avgHourlyConsumption,
  });
  recommendations.push(primary);

  // --- Recommendation 2: Best charging window ---
  const chargingWindow = findChargingWindow(forecast, weather, avgHourlyConsumption);
  if (chargingWindow && batterySoc !== null && batterySoc < 80) {
    recommendations.push({
      action: 'CHARGE_BATTERY',
      timeWindow: `${chargingWindow.start}:00 – ${chargingWindow.end}:00`,
      fromHour: chargingWindow.start,
      toHour: chargingWindow.end,
      reason: `Solar surplus expected during this window (${chargingWindow.surplusKwh.toFixed(1)} kWh excess). Charging battery reduces grid dependency later.`,
      confidence: Math.round(85 * (weather?.daily[0]?.estimatedSolarFactor ?? 1)),
      estimatedSavingRs: chargingWindow.surplusKwh * (system.exportRate ?? 0) > 0
        ? chargingWindow.surplusKwh * (system.exportRate ?? system.electricityRate) * system.electricityRate
        : chargingWindow.surplusKwh * system.electricityRate * 0.5,
      estimatedEnergyImpactKwh: chargingWindow.surplusKwh,
      priority: 'medium',
      dataQuality: 'forecast',
    });
  }

  // --- Recommendation 3: Battery discharge window ---
  if (batterySoc !== null && batterySoc > 30) {
    const expensiveHours = findExpensiveHours(forecast, avgHourlyConsumption, currentHour);
    if (expensiveHours.length > 0) {
      const from = expensiveHours[0];
      const to = expensiveHours[expensiveHours.length - 1] + 1;
      const kwhNeeded = (to - from) * avgHourlyConsumption;
      recommendations.push({
        action: 'USE_BATTERY',
        timeWindow: `${from}:00 – ${to}:00`,
        fromHour: from,
        toHour: to,
        reason: `Solar generation will fall during this period while household demand continues. Battery at ${batterySoc.toFixed(0)}% can cover approximately ${Math.min(batteryAvailableKwh ?? 0, kwhNeeded).toFixed(1)} kWh without grid import.`,
        confidence: 78,
        estimatedSavingRs: Math.min(batteryAvailableKwh ?? 0, kwhNeeded) * system.electricityRate,
        estimatedEnergyImpactKwh: Math.min(batteryAvailableKwh ?? 0, kwhNeeded),
        priority: 'medium',
        dataQuality: 'forecast',
      });
    }
  }

  // --- Recommendation 4: Tomorrow preserve battery ---
  const tomorrow = weather?.daily[1];
  if (tomorrow && tomorrow.estimatedSolarFactor < 0.4 && batterySoc !== null) {
    const targetSoc = Math.max(batterySoc, 70);
    recommendations.push({
      action: 'PRESERVE_BATTERY',
      timeWindow: 'Tonight – Tomorrow morning',
      fromHour: 20,
      toHour: 8,
      reason: `${tomorrow.weatherDescription} is forecast for tomorrow with ${Math.round(tomorrow.precipitationProbability)}% rain probability. Low solar expected — keep battery at ${targetSoc}%+ overnight.`,
      confidence: Math.round(70 * (1 - (tomorrow.estimatedSolarFactor ?? 0.5))),
      estimatedSavingRs: 0,
      estimatedEnergyImpactKwh: 0,
      priority: tomorrow.estimatedSolarFactor < 0.2 ? 'high' : 'medium',
      dataQuality: 'forecast',
    });
  }

  // --- Recommendation 5: Export window ---
  const exportWindow = findExportWindow(forecast, avgHourlyConsumption, batterySoc, batteryCapacity);
  if (exportWindow && system.exportRate && system.exportRate > 0) {
    const exportKwh = exportWindow.surplusKwh;
    recommendations.push({
      action: 'EXPORT_SOLAR',
      timeWindow: `${exportWindow.start}:00 – ${exportWindow.end}:00`,
      fromHour: exportWindow.start,
      toHour: exportWindow.end,
      reason: `Solar surplus of ~${exportKwh.toFixed(1)} kWh expected when generation exceeds both household demand and battery capacity. Exporting earns ₹${(exportKwh * (system.exportRate ?? 0)).toFixed(0)}.`,
      confidence: 70,
      estimatedSavingRs: exportKwh * (system.exportRate ?? 0),
      estimatedEnergyImpactKwh: exportKwh,
      priority: 'low',
      dataQuality: 'forecast',
    });
  }

  // ── Appliance Windows ─────────────────────────────────────────────────────
  const applianceWindows = appliances.map(appliance =>
    scheduleAppliance(appliance, forecast, weather, avgHourlyConsumption, system)
  ).filter((w): w is ApplianceWindow => w !== null);

  return {
    currentStatus: {
      solarKw: currentSolarKw,
      loadKw: currentLoadKw,
      batterySocPercent: batterySoc,
      batteryAvailableKwh,
      gridStatus: isExporting ? 'exporting' : isImporting ? 'importing' : 'off',
      surplusKw,
      timestamp: new Date().toISOString(),
      dataQuality,
    },
    primaryRecommendation: primary,
    recommendations: recommendations.sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    }),
    applianceWindows,
    todaySummary: {
      expectedSolarKwh: adjustedSolarKwh,
      expectedConsumptionKwh: avgDailyConsumptionKwh,
      estimatedSavingsRs,
      estimatedGridUsageKwh,
      peakSolarHour: peakHour,
    },
    weatherImpact,
    warnings,
  };
}

// ── Helper Functions ──────────────────────────────────────────────────────────

function buildCurrentRecommendation(p: {
  currentSolarKw: number;
  currentLoadKw: number;
  surplusKw: number;
  batterySoc: number | null;
  batteryAvailableKwh: number | null;
  batteryCapacity: number | null;
  currentHour: number;
  system: { electricityRate: number; exportRate: number | null };
  weather: WeatherData | null;
  dataQuality: 'measured' | 'estimated';
  avgHourlyConsumption: number;
}): EnergyRecommendation {
  const {
    currentSolarKw, currentLoadKw, surplusKw,
    batterySoc, batteryAvailableKwh, batteryCapacity,
    currentHour, system, weather, dataQuality, avgHourlyConsumption,
  } = p;

  const isNight = currentHour < 6 || currentHour >= 20;
  const timeWindow = 'Now';

  if (isNight) {
    if (batterySoc !== null && batterySoc > 20 && batteryAvailableKwh != null && batteryAvailableKwh > 0.5) {
      return {
        action: 'USE_BATTERY',
        timeWindow,
        fromHour: currentHour,
        toHour: currentHour + 1,
        reason: `It is nighttime — no solar generation. Battery is at ${batterySoc.toFixed(0)}% (${batteryAvailableKwh.toFixed(1)} kWh available). Using battery power avoids grid import at ₹${system.electricityRate}/kWh.`,
        confidence: 90,
        estimatedSavingRs: avgHourlyConsumption * system.electricityRate,
        estimatedEnergyImpactKwh: avgHourlyConsumption,
        priority: 'high',
        dataQuality,
      };
    }
    return {
      action: 'USE_GRID',
      timeWindow,
      fromHour: currentHour,
      toHour: currentHour + 1,
      reason: `Nighttime — no solar generation${batterySoc !== null ? ` and battery is at ${batterySoc.toFixed(0)}%` : ''}. Grid power is required.`,
      confidence: 95,
      estimatedSavingRs: 0,
      estimatedEnergyImpactKwh: avgHourlyConsumption,
      priority: 'low',
      dataQuality,
    };
  }

  if (currentSolarKw > 0.1 && surplusKw >= 0) {
    // Solar covers load
    if (batterySoc !== null && batteryCapacity !== null && batterySoc < 90 && surplusKw > 0.2) {
      return {
        action: 'CHARGE_BATTERY',
        timeWindow,
        fromHour: currentHour,
        toHour: currentHour + 1,
        reason: `Solar generation (${currentSolarKw.toFixed(1)} kW) exceeds current demand (${currentLoadKw.toFixed(1)} kW) with ${surplusKw.toFixed(1)} kW surplus. Battery at ${batterySoc.toFixed(0)}% — charging now maximises self-sufficiency.`,
        confidence: 88,
        estimatedSavingRs: surplusKw * system.electricityRate,
        estimatedEnergyImpactKwh: surplusKw,
        priority: 'high',
        dataQuality,
      };
    }
    return {
      action: 'SOLAR_DIRECT',
      timeWindow,
      fromHour: currentHour,
      toHour: currentHour + 1,
      reason: `Solar generation (${currentSolarKw.toFixed(1)} kW) is ${surplusKw >= 0 ? 'sufficient for' : 'partially covering'} current household demand (${currentLoadKw.toFixed(1)} kW). Use solar directly — zero grid cost.`,
      confidence: 92,
      estimatedSavingRs: Math.min(currentSolarKw, currentLoadKw) * system.electricityRate,
      estimatedEnergyImpactKwh: Math.min(currentSolarKw, currentLoadKw),
      priority: 'high',
      dataQuality,
    };
  }

  // Solar exists but insufficient
  if (currentSolarKw > 0.1 && surplusKw < 0) {
    if (batterySoc !== null && batterySoc > 20 && batteryAvailableKwh != null && batteryAvailableKwh > 0.3) {
      return {
        action: 'USE_BATTERY',
        timeWindow,
        fromHour: currentHour,
        toHour: currentHour + 1,
        reason: `Solar (${currentSolarKw.toFixed(1)} kW) covers partial demand. Battery at ${batterySoc.toFixed(0)}% can cover the remaining ${Math.abs(surplusKw).toFixed(1)} kW shortfall, avoiding grid import.`,
        confidence: 82,
        estimatedSavingRs: Math.abs(surplusKw) * system.electricityRate,
        estimatedEnergyImpactKwh: Math.abs(surplusKw),
        priority: 'high',
        dataQuality,
      };
    }
    return {
      action: 'SOLAR_DIRECT',
      timeWindow,
      fromHour: currentHour,
      toHour: currentHour + 1,
      reason: `Solar generating ${currentSolarKw.toFixed(1)} kW but demand is ${currentLoadKw.toFixed(1)} kW. Use solar output directly and supplement with grid for the ${Math.abs(surplusKw).toFixed(1)} kW shortfall.`,
      confidence: 80,
      estimatedSavingRs: currentSolarKw * system.electricityRate,
      estimatedEnergyImpactKwh: currentSolarKw,
      priority: 'medium',
      dataQuality,
    };
  }

  // No solar, not night (clouds/morning/evening edge)
  if (batterySoc !== null && batterySoc > 20 && batteryAvailableKwh != null && batteryAvailableKwh > 0.5) {
    return {
      action: 'USE_BATTERY',
      timeWindow,
      fromHour: currentHour,
      toHour: currentHour + 1,
      reason: `Minimal solar generation at this time (possibly cloud cover or transitional hour). Battery is at ${batterySoc.toFixed(0)}% — using stored energy avoids grid import cost.`,
      confidence: 75,
      estimatedSavingRs: avgHourlyConsumption * system.electricityRate,
      estimatedEnergyImpactKwh: avgHourlyConsumption,
      priority: 'medium',
      dataQuality,
    };
  }

  return {
    action: 'USE_GRID',
    timeWindow,
    fromHour: currentHour,
    toHour: currentHour + 1,
    reason: `No significant solar generation at this time${batterySoc !== null ? ` and battery at ${batterySoc.toFixed(0)}%` : ''}. Grid power required.`,
    confidence: 90,
    estimatedSavingRs: 0,
    estimatedEnergyImpactKwh: avgHourlyConsumption,
    priority: 'low',
    dataQuality,
  };
}

function findChargingWindow(
  forecast: HourlyForecast[],
  weather: WeatherData | null,
  avgHourlyConsumption: number
): { start: number; end: number; surplusKwh: number } | null {
  const factor = weather?.daily[0]?.estimatedSolarFactor ?? 1;
  let bestStart = -1, bestEnd = -1, bestSurplus = 0;
  let windowSurplus = 0, windowStart = -1;

  for (let h = 0; h < 24; h++) {
    const solar = (forecast[h]?.estimatedKwh ?? 0) * factor;
    const surplus = solar - avgHourlyConsumption;
    if (surplus > 0.1) {
      if (windowStart === -1) windowStart = h;
      windowSurplus += surplus;
      if (windowSurplus > bestSurplus) {
        bestSurplus = windowSurplus;
        bestStart = windowStart;
        bestEnd = h + 1;
      }
    } else {
      windowStart = -1;
      windowSurplus = 0;
    }
  }

  if (bestStart === -1) return null;
  return { start: bestStart, end: bestEnd, surplusKwh: bestSurplus };
}

function findExpensiveHours(
  forecast: HourlyForecast[],
  avgHourlyConsumption: number,
  currentHour: number
): number[] {
  // Hours after sunset where demand is high but solar is zero
  return forecast
    .filter(f => f.hour > currentHour && f.estimatedKwh === 0 && f.hour >= 17 && f.hour <= 22)
    .map(f => f.hour);
}

function findExportWindow(
  forecast: HourlyForecast[],
  avgHourlyConsumption: number,
  batterySoc: number | null,
  batteryCapacity: number | null
): { start: number; end: number; surplusKwh: number } | null {
  const batteryHeadroom = batterySoc !== null && batteryCapacity !== null
    ? (1 - batterySoc / 100) * batteryCapacity
    : 0;

  let surplus = 0, start = -1, end = -1;
  for (const f of forecast) {
    const s = f.estimatedKwh - avgHourlyConsumption - batteryHeadroom / 24;
    if (s > 0.2) {
      if (start === -1) start = f.hour;
      surplus += s;
      end = f.hour + 1;
    }
  }
  if (start === -1) return null;
  return { start, end, surplusKwh: surplus };
}

function scheduleAppliance(
  appliance: { name: string; powerKw: number; durationMinutes: number; preferredStart: string | null; preferredEnd: string | null },
  forecast: HourlyForecast[],
  weather: WeatherData | null,
  avgHourlyConsumption: number,
  system: { electricityRate: number }
): ApplianceWindow | null {
  const durationHours = appliance.durationMinutes / 60;
  const factor = weather?.daily[0]?.estimatedSolarFactor ?? 1;

  // Preferred window constraints
  const prefStart = appliance.preferredStart ? parseInt(appliance.preferredStart.split(':')[0], 10) : 6;
  const prefEnd = appliance.preferredEnd ? parseInt(appliance.preferredEnd.split(':')[0], 10) : 20;

  let bestStart = -1;
  let bestNet = -Infinity;

  for (let h = prefStart; h <= prefEnd - Math.ceil(durationHours); h++) {
    // Calculate net solar available during window
    let netSolar = 0;
    for (let d = 0; d < Math.ceil(durationHours); d++) {
      const slot = forecast[h + d];
      if (!slot) continue;
      const adjustedSolar = slot.estimatedKwh * factor;
      netSolar += Math.max(0, adjustedSolar - avgHourlyConsumption);
    }
    if (netSolar > bestNet) {
      bestNet = netSolar;
      bestStart = h;
    }
  }

  if (bestStart === -1) return null;

  const endHour = Math.min(24, bestStart + Math.ceil(durationHours));
  const energyKwh = appliance.powerKw * durationHours;
  const solarCovered = Math.min(energyKwh, bestNet);
  const saving = solarCovered * system.electricityRate;

  return {
    applianceName: appliance.name,
    powerKw: appliance.powerKw,
    durationMinutes: appliance.durationMinutes,
    recommendedStartHour: bestStart,
    recommendedEndHour: endHour,
    reason: `Solar surplus of ~${bestNet.toFixed(1)} kWh available between ${bestStart}:00–${endHour}:00${weather ? ` (${Math.round((weather.daily[0]?.estimatedSolarFactor ?? 1) * 100)}% solar efficiency today)` : ''}. Running ${appliance.name} here saves approximately ₹${saving.toFixed(0)}.`,
    estimatedSavingRs: saving,
    confidence: Math.round(70 * (factor)),
  };
}
