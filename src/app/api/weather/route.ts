import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getWeatherData } from '@/lib/services/weatherService';
import { prisma } from '@/lib/prisma';

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

    const weather = await getWeatherData(system.latitude, system.longitude, system.timezone);
    if (!weather) return NextResponse.json({ error: 'Weather data unavailable' }, { status: 503 });

    return NextResponse.json(weather);
  } catch (err) {
    console.error('[api/weather]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
