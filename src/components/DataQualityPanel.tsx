'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, Info, ShieldCheck, Activity } from 'lucide-react';
import type { ValidationResult } from '@/lib/services/dataNormalizationService';

interface DataQualityPanelProps {
  systemId: string;
}

interface QualityData {
  sessions: any[];
  latestValidation: ValidationResult | null;
  overallScore: number;
}

export default function DataQualityPanel({ systemId }: DataQualityPanelProps) {
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/import?systemId=${systemId}`)
      .then(res => res.json())
      .then(res => {
        if (res.sessions && res.sessions.length > 0) {
          const latest = res.sessions[0];
          setData({
            sessions: res.sessions,
            latestValidation: {
              isValid: latest.status === 'completed',
              rowCount: latest.rowCount,
              importedCount: latest.importedCount,
              errorCount: latest.errorCount,
              errors: [],
              warnings: [],
              qualityScore: latest.qualityScore ?? 0,
              coveragePercent: 0,
              duplicateCount: 0,
              nighttimeSolarCount: 0,
            },
            overallScore: latest.qualityScore ?? 0,
          });
        } else {
          setData(null);
        }
        setLoading(false);
      });
  }, [systemId]);

  if (loading) {
    return <div className="animate-pulse h-32 bg-zinc-900 rounded-xl" />;
  }

  if (!data) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
        <ShieldCheck className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-white">No Data Quality Stats</h3>
        <p className="text-xs text-zinc-400 mt-1">Import some data to see quality metrics.</p>
      </div>
    );
  }

  const { latestValidation, overallScore } = data;
  const isGood = overallScore >= 80;
  const isWarning = overallScore >= 50 && overallScore < 80;

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className={`rounded-xl border p-5 flex items-center gap-4 ${
        isGood ? 'border-emerald-500/30 bg-emerald-950/20' :
        isWarning ? 'border-yellow-500/30 bg-yellow-950/20' :
        'border-red-500/30 bg-red-950/20'
      }`}>
        <div className={`p-3 rounded-full ${
          isGood ? 'bg-emerald-400/20 text-emerald-400' :
          isWarning ? 'bg-yellow-400/20 text-yellow-400' :
          'bg-red-400/20 text-red-400'
        }`}>
          {isGood ? <CheckCircle className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
        </div>
        <div>
          <h3 className={`text-lg font-black ${
            isGood ? 'text-emerald-400' : isWarning ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {isGood ? 'Good Quality' : isWarning ? 'Acceptable Quality' : 'Poor Quality'}
          </h3>
          <p className="text-sm text-zinc-400">
            Overall data quality score: <strong className="text-white">{Math.round(overallScore)}/100</strong>
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1.5"><Activity className="h-3 w-3" /> Rows Imported</p>
          <p className="text-xl font-bold text-white">{latestValidation?.importedCount.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-red-400" /> Errors</p>
          <p className="text-xl font-bold text-red-400">{latestValidation?.errorCount.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1.5"><Info className="h-3 w-3" /> Total Source Rows</p>
          <p className="text-xl font-bold text-zinc-300">{latestValidation?.rowCount.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1.5"><Clock className="h-3 w-3" /> Last Import</p>
          <p className="text-xs font-bold text-zinc-300 mt-1">
            {new Date(data.sessions[0].createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Warnings / Fixes */}
      {!isGood && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white mb-3">Recommendations to Improve Quality</h4>
          <ul className="space-y-2 text-sm text-zinc-400">
            {latestValidation && latestValidation.errorCount > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">•</span>
                Your last import had {latestValidation.errorCount} errors. Ensure your CSV does not contain empty or malformed rows.
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">•</span>
              Make sure to map all available data columns (Solar, Consumption, Battery, Grid) for the best AI recommendations.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
