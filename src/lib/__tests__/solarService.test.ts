import { findBestApplianceWindow } from '../services/solarService';

describe('solarService', () => {
  describe('findBestApplianceWindow', () => {
    it('returns best 3-hour window for daytime', () => {
      // Mock forecast
      const forecast: any[] = Array.from({ length: 24 }).map((_, hour) => ({
        hour,
        estimatedKwh: hour >= 10 && hour <= 14 ? hour : 0, // max at 14
      }));
      
      const best = findBestApplianceWindow(forecast);
      // Window: [10,11,12], [11,12,13], [12,13,14]
      // 10+11+12 = 33
      // 11+12+13 = 36
      // 12+13+14 = 39 (best is 12)
      
      expect(best).toBe(12);
    });

    it('returns -1 if not enough daylight hours', () => {
      const forecast: any[] = Array.from({ length: 24 }).map((_, hour) => ({
        hour,
        estimatedKwh: hour === 12 || hour === 13 ? 5 : 0, // only 2 hours
      }));
      
      const best = findBestApplianceWindow(forecast);
      expect(best).toBe(-1);
    });
  });
});
