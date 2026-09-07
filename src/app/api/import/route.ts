import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseCsvHeaders, normalizeRows } from '@/lib/services/dataNormalizationService';
import type { ColumnMapping } from '@/lib/services/dataNormalizationService';

// Step 1: Parse headers and get column suggestions
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const systemId = searchParams.get('systemId');
    if (!systemId) return NextResponse.json({ error: 'systemId required' }, { status: 400 });

    const importSessions = await prisma.dataImportSession.findMany({
      where: { solarSystemId: systemId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({ sessions: importSessions });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Step 2: Parse CSV and detect columns
export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { systemId, csvContent, filename } = body;

    if (!systemId || !csvContent) return NextResponse.json({ error: 'systemId and csvContent required' }, { status: 400 });

    const system = await prisma.solarSystem.findUnique({ where: { id: systemId } });
    if (!system || system.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const parsed = parseCsvHeaders(csvContent);
    return NextResponse.json({ ...parsed, filename: filename ?? 'upload.csv' });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Step 3: Finalize import with confirmed mappings
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { systemId, csvContent, filename, columnMappings }: {
      systemId: string;
      csvContent: string;
      filename: string;
      columnMappings: ColumnMapping[];
    } = body;

    if (!systemId || !csvContent || !columnMappings)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

    const system = await prisma.solarSystem.findUnique({ where: { id: systemId } });
    if (!system || system.userId !== user.id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { rows, validation } = normalizeRows(csvContent, columnMappings);

    // Create import session record
    const session = await prisma.dataImportSession.create({
      data: {
        solarSystemId: systemId,
        filename: filename ?? 'upload.csv',
        columnMappings: JSON.stringify(
          Object.fromEntries(columnMappings.map(m => [m.originalName, m.mappedTo]))
        ),
        rowCount: validation.rowCount,
        importedCount: 0, // will be updated
        errorCount: validation.errorCount,
        qualityScore: validation.qualityScore,
        status: 'pending',
      },
    });

    // Upsert energy readings
    let importedCount = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        await prisma.energyReading.upsert({
          where: {
            solarSystemId_timestamp: {
              solarSystemId: systemId,
              timestamp: row.timestamp,
            },
          },
          create: {
            solarSystemId: systemId,
            timestamp: row.timestamp,
            solarKwh: row.solarKwh,
            consumptionKwh: row.consumptionKwh,
            batterySocPercent: row.batterySocPercent,
            batteryChargeKwh: row.batteryChargeKwh,
            batteryDischargeKwh: row.batteryDischargeKwh,
            gridImportKwh: row.gridImportKwh,
            gridExportKwh: row.gridExportKwh,
            isEstimated: false,
            dataSource: 'csv',
            importSessionId: session.id,
          },
          update: {
            solarKwh: row.solarKwh ?? undefined,
            consumptionKwh: row.consumptionKwh ?? undefined,
            batterySocPercent: row.batterySocPercent ?? undefined,
            batteryChargeKwh: row.batteryChargeKwh ?? undefined,
            batteryDischargeKwh: row.batteryDischargeKwh ?? undefined,
            gridImportKwh: row.gridImportKwh ?? undefined,
            gridExportKwh: row.gridExportKwh ?? undefined,
          },
        });

        // Also update legacy ConsumptionLog for backward compatibility
        if (row.consumptionKwh !== null) {
          const dayDate = new Date(row.timestamp);
          dayDate.setUTCHours(0, 0, 0, 0);
          await prisma.consumptionLog.upsert({
            where: { solarSystemId_date: { solarSystemId: systemId, date: dayDate } },
            create: { solarSystemId: systemId, date: dayDate, kwhConsumed: row.consumptionKwh },
            update: {},
          }).catch(() => {}); // ignore if already exists with different value
        }

        importedCount++;
      } catch (err) {
        errors.push(`Row ${importedCount + 2}: ${(err as Error).message}`);
      }
    }

    // Update session with final counts
    await prisma.dataImportSession.update({
      where: { id: session.id },
      data: {
        importedCount,
        errorCount: validation.errorCount + errors.length,
        status: 'completed',
      },
    });

    // Save column mappings for this system
    for (const mapping of columnMappings.filter(m => m.mappedTo !== 'ignore')) {
      await prisma.propertyColumn.upsert({
        where: { solarSystemId_mappedTo: { solarSystemId: systemId, mappedTo: mapping.mappedTo } },
        create: {
          solarSystemId: systemId,
          originalName: mapping.originalName,
          mappedTo: mapping.mappedTo,
          unit: mapping.unit,
          isActive: true,
        },
        update: { originalName: mapping.originalName, unit: mapping.unit, isActive: true },
      });
    }

    return NextResponse.json({
      sessionId: session.id,
      importedCount,
      validation,
      errors: errors.slice(0, 10),
    }, { status: 201 });
  } catch (err) {
    console.error('[api/import]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
