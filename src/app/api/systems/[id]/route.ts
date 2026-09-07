import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const system = await prisma.solarSystem.findUnique({ where: { id } });
    if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });
    if (system.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json(system);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const system = await prisma.solarSystem.findUnique({ where: { id } });
    if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });
    if (system.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const data = await request.json();
    const { name, capacityKw, latitude, longitude, electricityRate } = data;

    const updatedSystem = await prisma.solarSystem.update({
      where: { id },
      data: {
        name: name ?? system.name,
        capacityKw: capacityKw != null ? parseFloat(capacityKw) : system.capacityKw,
        latitude: latitude != null ? parseFloat(latitude) : system.latitude,
        longitude: longitude != null ? parseFloat(longitude) : system.longitude,
        electricityRate: electricityRate != null ? parseFloat(electricityRate) : system.electricityRate,
      },
    });

    return NextResponse.json(updatedSystem);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const system = await prisma.solarSystem.findUnique({ where: { id } });
    if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });
    if (system.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.solarSystem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
