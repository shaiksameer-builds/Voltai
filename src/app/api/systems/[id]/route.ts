import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const system = await prisma.solarSystem.findUnique({
      where: { id },
    });

    if (!system || system.userId !== user.id) {
      return NextResponse.json({ error: 'System not found or unauthorized' }, { status: 404 });
    }

    // Delete the system
    await prisma.solarSystem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete system:', error);
    return NextResponse.json({ error: 'Failed to delete system' }, { status: 500 });
  }
}
