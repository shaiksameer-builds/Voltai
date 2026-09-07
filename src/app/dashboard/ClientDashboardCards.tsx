'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Zap, Sun, Battery, Loader2, Info, Trash2 } from 'lucide-react';
import type { EnergyDecisionResult } from '@/lib/services/energyDecisionEngine';

export default function ClientDashboardCards({ systems }: { systems: any[] }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [systemStates, setSystemStates] = useState<Record<string, EnergyDecisionResult | null | undefined>>({});

  useEffect(() => {
    systems.forEach(system => {
      fetch(`/api/recommendations?systemId=${system.id}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setSystemStates(prev => ({ ...prev, [system.id]: data }));
          } else {
            setSystemStates(prev => ({ ...prev, [system.id]: null }));
          }
        })
        .catch(() => setSystemStates(prev => ({ ...prev, [system.id]: null })));
    });
  }, [systems]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'SOLAR_DIRECT': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'CHARGE_BATTERY': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'USE_BATTERY': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'USE_GRID': return 'text-zinc-400 bg-zinc-800/60 border-zinc-700';
      case 'EXPORT_SOLAR': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'PRESERVE_BATTERY': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      default: return 'text-zinc-500 bg-zinc-900 border-zinc-800';
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // Prevent navigating to system page
    if (!confirm('Are you sure you want to delete this property entirely? This cannot be undone.')) return;
    
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/systems/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to delete property');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting property');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {systems.map(system => {
        const state = systemStates[system.id];
        const primary = state?.primaryRecommendation;

        return (
          <Link key={system.id} href={`/systems/${system.id}`} className="group block">
            <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-yellow-400/50 hover:shadow-xl hover:shadow-yellow-400/10 transition-all duration-300 flex flex-col h-full">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="bg-yellow-400/10 border border-yellow-400/20 p-2.5 rounded-xl">
                  <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDelete(e, system.id)}
                    disabled={isDeleting === system.id}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Delete Property"
                  >
                    {isDeleting === system.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                  <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-yellow-400 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
              </div>

              {/* Name */}
              <h3 className="text-base font-bold text-white mb-1 truncate group-hover:text-yellow-400 transition-colors">
                {system.name}
              </h3>

              {/* Specs */}
              <div className="flex flex-wrap gap-2 mt-2 mb-4">
                <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-lg">
                  {system.capacityKw} kW
                </span>
                <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-lg">
                  ₹{system.electricityRate}/kWh
                </span>
              </div>

              {/* AI Status */}
              <div className="mt-auto pt-4 border-t border-zinc-800/60">
                {state === undefined ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading AI status...
                  </div>
                ) : state === null ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Info className="h-3 w-3" /> No AI data available
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">Current Action</span>
                    </div>
                    <div className={`px-3 py-2 rounded-xl border text-sm font-bold flex items-center justify-between ${getActionColor(primary?.action ?? '')}`}>
                      <span>{primary?.action.replace(/_/g, ' ')}</span>
                      <span className="text-xs opacity-80">{state.currentStatus.surplusKw >= 0 ? '+' : ''}{state.currentStatus.surplusKw.toFixed(1)} kW</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
