import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import AddSystemForm from '@/components/AddSystemForm';
import { Zap, Sun, BarChart2 } from 'lucide-react';
import ClientDashboardCards from './ClientDashboardCards';

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const systems = await prisma.solarSystem.findMany({
    where: { userId: user.id },
    include: { consumptionLogs: { take: 1, orderBy: { date: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Your <span className="text-yellow-400">Properties</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1 font-mono">
            {systems.length} propert{systems.length === 1 ? 'y' : 'ies'} tracked
          </p>
        </div>
        <AddSystemForm />
      </div>

      {/* Stats Row */}
      {systems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: Sun,
              label: 'Total Systems',
              value: systems.length,
              color: 'text-yellow-400',
              bg: 'bg-yellow-400/10 border-yellow-400/20',
            },
            {
              icon: BarChart2,
              label: 'Total Capacity',
              value: `${systems.reduce((a, s) => a + s.capacityKw, 0).toFixed(1)} kW`,
              color: 'text-blue-400',
              bg: 'bg-blue-400/10 border-blue-400/20',
            },
            {
              icon: Zap,
              label: 'Avg Electricity Rate',
              value: `₹${(systems.reduce((a, s) => a + s.electricityRate, 0) / systems.length).toFixed(2)}/kWh`,
              color: 'text-emerald-400',
              bg: 'bg-emerald-400/10 border-emerald-400/20',
            },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={`rounded-2xl border p-5 ${stat.bg} bg-zinc-900/60 backdrop-blur`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                  <span className="text-xs uppercase font-mono tracking-widest text-zinc-500">{stat.label}</span>
                </div>
                <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Properties Grid */}
      {systems.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/40">
          <div className="bg-yellow-400/10 border border-yellow-400/20 p-5 rounded-2xl mb-6">
            <svg viewBox="0 0 24 24" className="w-12 h-12 text-yellow-400 fill-current mx-auto">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No properties yet</h2>
          <p className="text-zinc-500 text-sm max-w-sm mb-8">
            Add your first solar property. Upload a CSV file with your historical energy data to get started with AI-powered insights.
          </p>
          <AddSystemForm />
        </div>
      ) : (
        <ClientDashboardCards systems={systems} />
      )}
    </div>
  );
}
