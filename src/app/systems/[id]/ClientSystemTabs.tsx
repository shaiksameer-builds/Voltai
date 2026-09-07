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

  // History state
  const [historyRange, setHistoryRange] = useState('hourly');
  const [historyDate, setHistoryDate] = useState('');
  const [dynamicHistoryData, setDynamicHistoryData] = useState(historyData);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetch(`/api/recommendations?systemId=${systemId}`)
      .then(res => res.json())
      .then(data => {
        setAiData(data);
        setLoading(false);
      });
  }, [systemId]);

  useEffect(() => {
    if (activeTab !== 2) return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        let url = `/api/systems/${systemId}/history?range=${historyRange}`;
        if (historyRange === 'hourly' && historyDate) {
          url += `&date=${historyDate}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (!data.error) setDynamicHistoryData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [systemId, historyRange, historyDate, activeTab]);

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-white">Historical Data</h3>
              <div className="flex gap-2">
                {historyRange === 'hourly' && (
                  <input 
                    type="date" 
                    value={historyDate}
                    onChange={(e) => setHistoryDate(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 text-sm rounded-lg px-3 py-1.5 text-zinc-300"
                  />
                )}
                <select 
                  value={historyRange} 
                  onChange={(e) => setHistoryRange(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 text-sm rounded-lg px-3 py-1.5 text-zinc-300"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            
            {loadingHistory ? (
              <div className="flex items-center justify-center h-64 text-zinc-500 gap-2 border border-zinc-800 rounded-xl bg-zinc-900/60">
                <Loader2 className="h-5 w-5 animate-spin" /> Fetching history...
              </div>
            ) : (
              <SystemChart
                data={dynamicHistoryData}
                showConsumption={true}
                showBattery={true}
                showGrid={true}
              />
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
