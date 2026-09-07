import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { systemId, name, powerKw, durationMinutes, isFlexible, preferredStart, preferredEnd } = body;

    if (!systemId || !name || !powerKw || !durationMinutes)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

    const system = await prisma.solarSystem.findUnique({ where: { id: systemId } });
    if (!system || system.userId !== user.id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const appliance = await prisma.appliance.create({
      data: {
        solarSystemId: systemId,
        name,
        powerKw: parseFloat(powerKw),
        durationMinutes: parseInt(durationMinutes),
        isFlexible: isFlexible ?? true,
        preferredStart: preferredStart || null,
        preferredEnd: preferredEnd || null,
      },
    });

    return NextResponse.json(appliance, { status: 201 });
  } catch (err) {
    console.error('[api/appliances]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const systemId = searchParams.get('systemId');
    if (!systemId) return NextResponse.json({ error: 'systemId required' }, { status: 400 });

    const system = await prisma.solarSystem.findUnique({ where: { id: systemId } });
    if (!system || system.userId !== user.id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const appliances = await prisma.appliance.findMany({
      where: { solarSystemId: systemId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(appliances);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
