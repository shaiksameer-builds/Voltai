import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTodayForecast } from '@/lib/services/solarService';
import { getWeatherData } from '@/lib/services/weatherService';
import { runDecisionEngine } from '@/lib/services/energyDecisionEngine';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const systemId = searchParams.get('systemId');
    if (!systemId) return NextResponse.json({ error: 'systemId required' }, { status: 400 });

    const system = await prisma.solarSystem.findUnique({
      where: { id: systemId },
      include: {
        appliances: true,
        consumptionLogs: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });
    if (!system || system.userId !== user.id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Fetch forecast, weather, latest energy reading in parallel
    const [forecast, weather, latestReading] = await Promise.all([
      getTodayForecast(systemId),
      getWeatherData(system.latitude, system.longitude, system.timezone),
      prisma.energyReading.findFirst({
        where: { solarSystemId: systemId },
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    // Calculate average daily consumption from historical logs
    const avgDailyConsumptionKwh = system.consumptionLogs.length > 0
      ? system.consumptionLogs.reduce((s, l) => s + l.kwhConsumed, 0) / system.consumptionLogs.length
      : system.capacityKw * 2; // fallback: assume 2x capacity

    // Current local hour for the property's timezone
    const localHour = parseInt(
      new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: system.timezone }),
      10
    );

    const result = runDecisionEngine({
      system: {
        capacityKw: system.capacityKw,
        electricityRate: system.electricityRate,
        exportRate: system.exportRate,
        batteryCapacityKwh: system.batteryCapacityKwh,
        timezone: system.timezone,
      },
      forecast,
      weather,
      currentHour: isNaN(localHour) ? new Date().getHours() : localHour,
      latestReading: latestReading ? {
        solarKwh: latestReading.solarKwh,
        consumptionKwh: latestReading.consumptionKwh,
        batterySocPercent: latestReading.batterySocPercent,
        gridImportKwh: latestReading.gridImportKwh,
        gridExportKwh: latestReading.gridExportKwh,
      } : null,
      avgDailyConsumptionKwh,
      appliances: system.appliances,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/recommendations]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
