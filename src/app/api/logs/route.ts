import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const systemId = searchParams.get('systemId');

    if (!systemId) return NextResponse.json({ error: 'systemId is required' }, { status: 400 });

    const system = await prisma.solarSystem.findUnique({ where: { id: systemId } });
    if (!system || system.userId !== user.id) {
      return NextResponse.json({ error: 'System not found or forbidden' }, { status: 403 });
    }

    const logs = await prisma.consumptionLog.findMany({
      where: { solarSystemId: systemId },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await request.json();
    const { systemId, date, kwhConsumed } = data;

    if (!systemId || !date || kwhConsumed == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const system = await prisma.solarSystem.findUnique({ where: { id: systemId } });
    if (!system || system.userId !== user.id) {
      return NextResponse.json({ error: 'System not found or forbidden' }, { status: 403 });
    }

    const parsedDate = new Date(date);
    // Normalize date to midnight UTC to prevent time zone issues causing duplicates on the same day
    parsedDate.setUTCHours(0, 0, 0, 0);

    const existingLog = await prisma.consumptionLog.findFirst({
      where: {
        solarSystemId: systemId,
        date: parsedDate,
      },
    });

    if (existingLog) {
      return NextResponse.json({ error: 'A consumption entry for this date already exists.' }, { status: 400 });
    }

    const log = await prisma.consumptionLog.create({
      data: {
        solarSystemId: systemId,
        date: parsedDate,
        kwhConsumed: parseFloat(kwhConsumed),
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('Create log error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
