import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'hourly'; // hourly, daily, monthly, yearly
    const dateStr = searchParams.get('date'); // YYYY-MM-DD

    const system = await prisma.solarSystem.findUnique({
      where: { id },
    });

    if (!system || system.userId !== user.id) {
      return NextResponse.json({ error: 'System not found or unauthorized' }, { status: 404 });
    }

    let startDate = new Date();
    let endDate = new Date();

    if (range === 'hourly') {
      if (dateStr) {
        startDate = new Date(dateStr);
        startDate.setUTCHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
      } else {
        startDate.setHours(startDate.getHours() - 48);
      }
    } else if (range === 'daily') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (range === 'monthly') {
      startDate.setMonth(startDate.getMonth() - 12);
    } else if (range === 'yearly') {
      startDate.setFullYear(startDate.getFullYear() - 5);
    }

    const readings = await prisma.energyReading.findMany({
      where: { 
        solarSystemId: id,
        timestamp: { gte: startDate, lte: endDate }
      },
      orderBy: { timestamp: 'asc' },
    });

    // Aggregate based on range
    const aggregated = new Map<string, any>();

    for (const r of readings) {
      let key = '';
      let displayTime = '';
      
      if (range === 'hourly') {
        key = r.timestamp.toISOString();
        displayTime = r.timestamp.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
      } else if (range === 'daily') {
        key = r.timestamp.toISOString().split('T')[0];
        displayTime = r.timestamp.toLocaleString('en-US', { month: 'short', day: 'numeric' });
      } else if (range === 'monthly') {
        key = `${r.timestamp.getFullYear()}-${String(r.timestamp.getMonth() + 1).padStart(2, '0')}`;
        displayTime = r.timestamp.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      } else if (range === 'yearly') {
        key = `${r.timestamp.getFullYear()}`;
        displayTime = r.timestamp.toLocaleString('en-US', { year: 'numeric' });
      }

      if (!aggregated.has(key)) {
        aggregated.set(key, {
          timestampKey: key,
          timestamp: displayTime,
          hour: range === 'hourly' ? r.timestamp.getUTCHours() : undefined,
          estimatedKwh: 0,
          solarActualKwh: 0,
          consumptionKwh: 0,
          batterySocPercent: range === 'hourly' ? r.batterySocPercent : 0, // only makes sense hourly, or avg
          gridImportKwh: 0,
          gridExportKwh: 0,
          isEstimated: r.isEstimated,
          count: 0
        });
      }

      const agg = aggregated.get(key)!;
      agg.estimatedKwh += r.solarKwh ?? 0;
      if (r.solarKwh != null) agg.solarActualKwh += r.solarKwh;
      if (r.consumptionKwh != null) agg.consumptionKwh += r.consumptionKwh;
      if (r.gridImportKwh != null) agg.gridImportKwh += r.gridImportKwh;
      if (r.gridExportKwh != null) agg.gridExportKwh += r.gridExportKwh;
      if (r.batterySocPercent != null) agg.batterySocPercent = r.batterySocPercent; // take last value
      agg.count += 1;
    }

    // Clean up missing/empty values to undefined so chart doesn't render zeroes if data was absent
    const results = Array.from(aggregated.values()).map(a => ({
      ...a,
      solarActualKwh: a.solarActualKwh > 0 ? a.solarActualKwh : undefined,
      consumptionKwh: a.consumptionKwh > 0 ? a.consumptionKwh : undefined,
      gridImportKwh: a.gridImportKwh > 0 ? a.gridImportKwh : undefined,
      gridExportKwh: a.gridExportKwh > 0 ? a.gridExportKwh : undefined,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
