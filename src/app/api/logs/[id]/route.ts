import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const log = await prisma.consumptionLog.findUnique({ where: { id }, include: { solarSystem: true } });
    if (!log) return NextResponse.json({ error: 'Log not found' }, { status: 404 });
    if (log.solarSystem.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.consumptionLog.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
