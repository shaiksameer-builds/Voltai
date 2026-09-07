'use client';

import { useState } from 'react';
import { Zap, Battery, Sun, Zap as GridIcon, TrendingUp, TrendingDown, Clock, DollarSign, AlertTriangle, Cloud, Droplets, CheckCircle2, Info } from 'lucide-react';
import type { EnergyDecisionResult, ActionCode, EnergyRecommendation } from '@/lib/services/energyDecisionEngine';

const ACTION_CONFIG: Record<ActionCode, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  SOLAR_DIRECT: {
    label: 'Use Solar Directly',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
    icon: <Sun className="h-5 w-5 text-yellow-400" />,
  },
  CHARGE_BATTERY: {
    label: 'Charge Battery',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/30',
    icon: <Battery className="h-5 w-5 text-emerald-400" />,
  },
  USE_BATTERY: {
    label: 'Use Battery Power',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/30',
    icon: <Battery className="h-5 w-5 text-green-400" />,
  },
  USE_GRID: {
    label: 'Use Grid Power',
    color: 'text-zinc-400',
    bg: 'bg-zinc-800/60',
    border: 'border-zinc-700',
    icon: <Zap className="h-5 w-5 text-zinc-400" />,
  },
  EXPORT_SOLAR: {
    label: 'Export to Grid',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/30',
    icon: <TrendingUp className="h-5 w-5 text-blue-400" />,
  },
  PRESERVE_BATTERY: {
    label: 'Preserve Battery',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    border: 'border-orange-400/30',
    icon: <Battery className="h-5 w-5 text-orange-400" />,
  },
  NO_ACTION: {
    label: 'No Action Needed',
    color: 'text-zinc-500',
    bg: 'bg-zinc-900',
    border: 'border-zinc-800',
    icon: <CheckCircle2 className="h-5 w-5 text-zinc-500" />,
  },
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 80 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    : confidence >= 60 ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    : 'text-red-400 bg-red-400/10 border-red-400/20';
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${color}`}>
      {confidence}% confidence
    </span>
  );
}

function DataQualityBadge({ quality }: { quality: 'measured' | 'estimated' | 'forecast' }) {
  const config = {
    measured: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    estimated: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
    forecast: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  };
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${config[quality]}`}>
      {quality}
    </span>
  );
}

function RecommendationCard({ rec, isExpanded, onToggle }: {
  rec: EnergyRecommendation;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const cfg = ACTION_CONFIG[rec.action];
  return (
    <div
      className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 cursor-pointer transition-all duration-200 hover:opacity-90`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {cfg.icon}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
              {rec.priority === 'high' && (
                <span className="text-[10px] font-semibold text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded-full">HIGH</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Clock className="h-3 w-3 text-zinc-500" />
              <span className="text-xs text-zinc-500 font-mono">{rec.timeWindow}</span>
              <ConfidenceBadge confidence={rec.confidence} />
              <DataQualityBadge quality={rec.dataQuality} />
            </div>
          </div>
        </div>
        {rec.estimatedSavingRs > 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs text-zinc-500">Est. saving</p>
            <p className="text-sm font-bold text-emerald-400">₹{rec.estimatedSavingRs.toFixed(0)}</p>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-zinc-800/60">
          <p className="text-sm text-zinc-300 leading-relaxed">{rec.reason}</p>
          {rec.estimatedEnergyImpactKwh > 0 && (
            <p className="text-xs text-zinc-500 mt-2 font-mono">
              Energy impact: {rec.estimatedEnergyImpactKwh.toFixed(2)} kWh
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface EnergyDashboardProps {
  data: EnergyDecisionResult;
}

export default function EnergyDashboard({ data }: EnergyDashboardProps) {
  const [expandedRec, setExpandedRec] = useState<number>(0);
  const { currentStatus, primaryRecommendation, recommendations, todaySummary, weatherImpact, warnings, applianceWindows } = data;
  const primaryCfg = ACTION_CONFIG[primaryRecommendation.action];

  return (
    <div className="space-y-5">
      {/* ── Warnings ── */}
      {warnings.length > 0 && (
        <div className="flex flex-col gap-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 bg-yellow-950/40 border border-yellow-700/40 rounded-xl px-4 py-3 text-sm text-yellow-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-400" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* ── Current Energy Status ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sun className="h-4 w-4 text-yellow-400" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Solar</span>
          </div>
          <p className="text-2xl font-black text-yellow-400">{currentStatus.solarKw.toFixed(1)}</p>
          <p className="text-xs text-zinc-500">kW</p>
          <DataQualityBadge quality={currentStatus.dataQuality} />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Load</span>
          </div>
          <p className="text-2xl font-black text-blue-400">{currentStatus.loadKw.toFixed(1)}</p>
          <p className="text-xs text-zinc-500">kW</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Battery className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Battery</span>
          </div>
          {currentStatus.batterySocPercent !== null ? (
            <>
              <p className="text-2xl font-black text-emerald-400">{currentStatus.batterySocPercent.toFixed(0)}%</p>
              <p className="text-xs text-zinc-500">{currentStatus.batteryAvailableKwh?.toFixed(1)} kWh avail.</p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-zinc-600">N/A</p>
              <p className="text-xs text-zinc-600">No battery data</p>
            </>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <GridIcon className="h-4 w-4 text-zinc-400" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Grid</span>
          </div>
          <p className={`text-lg font-bold capitalize ${
            currentStatus.gridStatus === 'exporting' ? 'text-emerald-400'
            : currentStatus.gridStatus === 'importing' ? 'text-red-400'
            : 'text-zinc-500'
          }`}>
            {currentStatus.gridStatus}
          </p>
          <p className={`text-xs ${currentStatus.surplusKw >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {currentStatus.surplusKw >= 0 ? '+' : ''}{currentStatus.surplusKw.toFixed(1)} kW
          </p>
        </div>
      </div>

      {/* ── Primary Recommendation ── */}
      <div className={`rounded-2xl border-2 ${primaryCfg.border} ${primaryCfg.bg} p-5`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-2 rounded-lg bg-black/20`}>{primaryCfg.icon}</div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono">AI Recommendation — Now</p>
            <h2 className={`text-lg font-black ${primaryCfg.color}`}>{primaryCfg.label}</h2>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1">
            <ConfidenceBadge confidence={primaryRecommendation.confidence} />
            <DataQualityBadge quality={primaryRecommendation.dataQuality} />
          </div>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">{primaryRecommendation.reason}</p>
        {primaryRecommendation.estimatedSavingRs > 0 && (
          <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <DollarSign className="h-4 w-4" />
            Estimated saving: ₹{primaryRecommendation.estimatedSavingRs.toFixed(0)}
          </div>
        )}
      </div>

      {/* ── Today Summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Expected Solar', value: `${todaySummary.expectedSolarKwh.toFixed(1)} kWh`, color: 'text-yellow-400' },
          { label: 'Expected Load', value: `${todaySummary.expectedConsumptionKwh.toFixed(1)} kWh`, color: 'text-blue-400' },
          { label: 'Est. Grid Use', value: `${todaySummary.estimatedGridUsageKwh.toFixed(1)} kWh`, color: 'text-red-400' },
          { label: 'Est. Savings', value: `₹${todaySummary.estimatedSavingsRs.toFixed(0)}`, color: 'text-emerald-400' },
          { label: 'Peak Solar Hour', value: `${todaySummary.peakSolarHour}:00`, color: 'text-orange-400' },
        ].map(item => (
          <div key={item.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-xs text-zinc-500 mb-1">{item.label}</p>
            <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── All Recommendations ── */}
      {recommendations.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Info className="h-4 w-4" /> Full Recommendation Timeline
          </h3>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <RecommendationCard
                key={i}
                rec={rec}
                isExpanded={expandedRec === i}
                onToggle={() => setExpandedRec(expandedRec === i ? -1 : i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Weather Impact ── */}
      {weatherImpact && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Weather Impact</span>
          </div>
          <p className="text-sm text-zinc-300">{weatherImpact}</p>
        </div>
      )}

      {/* ── Appliance Schedule ── */}
      {applianceWindows.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Smart Appliance Schedule
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {applianceWindows.map((w, i) => (
              <div key={i} className="bg-zinc-900 border border-yellow-400/20 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-white">{w.applianceName}</p>
                    <p className="text-xs text-zinc-500">{w.powerKw} kW · {w.durationMinutes} min</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Best time</p>
                    <p className="text-sm font-mono font-bold text-yellow-400">
                      {w.recommendedStartHour}:00 – {w.recommendedEndHour}:00
                    </p>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{w.reason}</p>
                <div className="mt-2 flex items-center gap-2">
                  <ConfidenceBadge confidence={w.confidence} />
                  {w.estimatedSavingRs > 0 && (
                    <span className="text-xs text-emerald-400">Save ₹{w.estimatedSavingRs.toFixed(0)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
