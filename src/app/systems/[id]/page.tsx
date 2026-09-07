import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTodayForecast } from '@/lib/services/solarService';

import SystemChart from '@/components/SystemChart';
import EnergyDashboard from '@/components/EnergyDashboard';
import CsvImportWizard from '@/components/CsvImportWizard';
import DataQualityPanel from '@/components/DataQualityPanel';
import ApplianceScheduler from '@/components/ApplianceScheduler';

import { Activity, Info, TrendingUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default async function SystemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const resolvedParams = await params;
  const systemId = resolvedParams.id;

  const system = await prisma.solarSystem.findUnique({
    where: { id: systemId },
  });

  if (!system || system.userId !== user.id) redirect('/dashboard');

  // Let the client fetch the AI recommendations to keep the initial page load fast
  // and ensure the client timezone logic matches correctly.
  
  // But we still fetch the raw solar forecast + consumption logs for the History tab
  const forecast = await getTodayForecast(system.id);
  
  // We fetch up to 48 hours of energy readings for the history chart
  const recentReadings = await prisma.energyReading.findMany({
    where: { solarSystemId: systemId },
    orderBy: { timestamp: 'desc' },
    take: 48,
  });

  // Map readings back to the format expected by the SystemChart
  const historyData = recentReadings.map(r => ({
    hour: r.timestamp.getUTCHours(), // For simple display
    timestamp: r.timestamp.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
    estimatedKwh: r.solarKwh ?? 0,
    solarActualKwh: r.solarKwh ?? undefined,
    isEstimated: r.isEstimated,
    consumptionKwh: r.consumptionKwh ?? undefined,
    batterySocPercent: r.batterySocPercent ?? undefined,
    gridImportKwh: r.gridImportKwh ?? undefined,
    gridExportKwh: r.gridExportKwh ?? undefined,
  })).reverse();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">{system.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
            <span>{system.capacityKw} kW System</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              ₹{system.electricityRate}/kWh Grid Rate
            </span>
          </div>
        </div>
        <CsvImportWizard systemId={system.id} />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-8">
        <ClientSystemTabs systemId={system.id} historyData={historyData} forecastData={forecast} />
      </div>
    </div>
  );
}

// Inline client component for tabs and data fetching
import ClientSystemTabs from './ClientSystemTabs';
