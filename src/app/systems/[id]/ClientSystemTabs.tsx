'use client';

import { useState, useEffect } from 'react';
import EnergyDashboard from '@/components/EnergyDashboard';
import SystemChart from '@/components/SystemChart';
import ApplianceScheduler from '@/components/ApplianceScheduler';
import { Loader2 } from 'lucide-react';

const TABS = ['AI Dashboard', 'Forecast Chart', 'History', 'Smart Schedule'];

export default function ClientSystemTabs({ systemId, historyData, forecastData }: any) {
  const [activeTab, setActiveTab] = useState(0);
  const [aiData, setAiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/recommendations?systemId=${systemId}`)
      .then(res => res.json())
      .then(data => {
        setAiData(data);
        setLoading(false);
      });
  }, [systemId]);

  return (
    <div>
      <div className="flex overflow-x-auto border-b border-zinc-800 mb-6 pb-px">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`whitespace-nowrap px-4 py-2 border-b-2 text-sm font-medium transition-colors ${
              activeTab === i
                ? 'border-yellow-400 text-yellow-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 0 && (
          loading ? (
            <div className="flex items-center justify-center h-64 text-zinc-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Analyzing energy data...
            </div>
          ) : aiData?.error ? (
            <div className="text-red-400 p-4 bg-red-950/30 rounded-lg">{aiData.error}</div>
          ) : (
            <EnergyDashboard data={aiData} />
          )
        )}

        {activeTab === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white mb-4">Today&apos;s Forecast</h3>
            <SystemChart data={forecastData} showConsumption={false} />
          </div>
        )}

        {activeTab === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white mb-4">Recent Historical Data</h3>
            <SystemChart
              data={historyData}
              showConsumption={true}
              showBattery={true}
              showGrid={true}
            />
            {historyData.length === 0 && (
              <p className="text-sm text-zinc-500 mt-2">No historical data found. Try importing a CSV.</p>
            )}
          </div>
        )}

        {activeTab === 3 && (
          <ApplianceScheduler systemId={systemId} />
        )}
      </div>
    </div>
  );
}
