import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const systems = await prisma.solarSystem.findMany({
      where: { userId: user.id },
      include: {
        consumptionLogs: {
          take: 5,
          orderBy: { date: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(systems);
  } catch (error) {
    console.error('Fetch systems error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, csvContent, capacityKw, latitude, longitude, electricityRate } = body;

    if (!name) {
      return NextResponse.json({ error: 'Property / System name is required' }, { status: 400 });
    }

    // Default System Settings
    let systemCapacity = capacityKw ? parseFloat(capacityKw) : 5.0;
    let systemLat = latitude ? parseFloat(latitude) : 37.7749;
    let systemLon = longitude ? parseFloat(longitude) : -122.4194;
    let systemRate = electricityRate ? parseFloat(electricityRate) : 0.15;

    const parsedLogs: Array<{ date: Date; kwhConsumed: number }> = [];

    // Parse CSV if provided
    if (csvContent && typeof csvContent === 'string') {
      const lines = csvContent.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const cols = trimmed.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length < 2) continue;

        const firstCol = cols[0].toLowerCase();
        const secondCol = cols[1];

        // Check for metadata key-value rows
        if (firstCol.includes('capacity')) {
          const val = parseFloat(secondCol);
          if (!isNaN(val)) systemCapacity = val;
        } else if (firstCol.includes('lat')) {
          const val = parseFloat(secondCol);
          if (!isNaN(val)) systemLat = val;
        } else if (firstCol.includes('lon')) {
          const val = parseFloat(secondCol);
          if (!isNaN(val)) systemLon = val;
        } else if (firstCol.includes('rate') || firstCol.includes('price')) {
          const val = parseFloat(secondCol);
          if (!isNaN(val)) systemRate = val;
        } else {
          // Check for data rows (Date, kWh)
          const parsedDate = new Date(cols[0]);
          const kwh = parseFloat(cols[1]);
          if (!isNaN(parsedDate.getTime()) && !isNaN(kwh)) {
            parsedLogs.push({
              date: parsedDate,
              kwhConsumed: Math.max(0, kwh),
            });
          }
        }
      }
    }

    // Create system record
    const system = await prisma.solarSystem.create({
      data: {
        userId: user.id,
        name,
        capacityKw: systemCapacity,
        latitude: systemLat,
        longitude: systemLon,
        electricityRate: systemRate,
      },
    });

    // Create log entries if CSV contained data rows
    if (parsedLogs.length > 0) {
      await prisma.consumptionLog.createMany({
        data: parsedLogs.map(log => ({
          solarSystemId: system.id,
          date: log.date,
          kwhConsumed: log.kwhConsumed,
        })),
      });
    }

    return NextResponse.json({
      system,
      logsImported: parsedLogs.length,
    }, { status: 201 });
  } catch (error) {
    console.error('Create system error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
