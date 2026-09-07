/**
 * forecast.ts — Legacy compatibility shim.
 * Delegates to the new timezone-aware solarService.
 * Kept for backward compatibility with existing page imports.
 */
export { getTodayForecast, findBestApplianceWindow } from './services/solarService';
