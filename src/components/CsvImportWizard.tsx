'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud, Zap, X, FileText, CheckCircle, AlertCircle,
  ChevronRight, ChevronLeft, Settings, AlertTriangle, Info, Loader2,
} from 'lucide-react';
import type { ColumnMapping, CsvParseResult, ValidationResult } from '@/lib/services/dataNormalizationService';

type NormalizedField =
  | 'timestamp' | 'solar_kwh' | 'consumption_kwh' | 'battery_soc_percent'
  | 'battery_charge_kwh' | 'battery_discharge_kwh' | 'grid_import_kwh' | 'grid_export_kwh' | 'ignore';

const FIELD_LABELS: Record<NormalizedField, string> = {
  timestamp: '📅 Timestamp / Date',
  solar_kwh: '☀️ Solar Generation (kWh)',
  consumption_kwh: '⚡ Energy Consumption (kWh)',
  battery_soc_percent: '🔋 Battery SOC (%)',
  battery_charge_kwh: '↑ Battery Charge (kWh)',
  battery_discharge_kwh: '↓ Battery Discharge (kWh)',
  grid_import_kwh: '🔌 Grid Import (kWh)',
  grid_export_kwh: '📤 Grid Export (kWh)',
  ignore: '✕ Ignore this column',
};

const STEP_LABELS = ['Upload', 'Map Columns', 'Validate', 'Done'];

interface CsvImportWizardProps {
  systemId: string;
  onComplete?: () => void;
}

export default function CsvImportWizard({ systemId, onComplete }: CsvImportWizardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<{ importedCount: number; sessionId: string } | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const reset = () => {
    setStep(0); setCsvFile(null); setCsvContent(''); setParseResult(null);
    setMappings([]); setValidation(null); setImportResult(null); setError('');
  };

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) { setError('Please upload a .csv file'); return; }
    const text = await file.text();
    setCsvFile(file);
    setCsvContent(text);
    setError('');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
  };

  // Step 1 → 2: Parse headers
  const parseHeaders = async () => {
    if (!csvContent) { setError('No CSV content'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/import', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemId, csvContent, filename: csvFile?.name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setParseResult(data);
      setMappings(data.columnMappings);
      setStep(1);
    } catch { setError('Failed to parse CSV'); }
    finally { setLoading(false); }
  };

  // Step 2 → 3: Validate
  const validateMapping = async () => {
    setLoading(true); setError('');
    try {
      // Call validate-only by doing a dry run (re-parse locally)
      // We send to the POST endpoint with a validation flag
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId, csvContent,
          filename: csvFile?.name ?? 'upload.csv',
          columnMappings: mappings,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setValidation(data.validation);
      setImportResult({ importedCount: data.importedCount, sessionId: data.sessionId });
      setStep(2);
    } catch { setError('Validation failed'); }
    finally { setLoading(false); }
  };

  const finish = () => {
    setStep(3);
    setTimeout(() => {
      setIsOpen(false); reset(); router.refresh();
      onComplete?.();
    }, 2000);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-semibold rounded-xl shadow-lg shadow-yellow-400/20 transition-all duration-200 hover:-translate-y-0.5"
      >
        <UploadCloud className="h-4 w-4" />
        Import CSV Data
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400/10 border border-yellow-400/20 p-2 rounded-lg">
              <UploadCloud className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Import Energy Data</h2>
              <p className="text-xs text-zinc-500">Step {step + 1} of 4 — {STEP_LABELS[step]}</p>
            </div>
          </div>
          <button onClick={() => { setIsOpen(false); reset(); }} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Progress */}
        <div className="px-5 py-3 flex items-center gap-2 border-b border-zinc-900">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                i < step ? 'bg-yellow-400 text-black' : i === step ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/50' : 'bg-zinc-800 text-zinc-500'
              }`}>{i < step ? '✓' : i + 1}</div>
              <span className={`text-xs hidden sm:block ${i === step ? 'text-yellow-400' : 'text-zinc-500'}`}>{label}</span>
              {i < STEP_LABELS.length - 1 && <ChevronRight className="h-3 w-3 text-zinc-700" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-950/60 border border-red-700/50 text-red-300 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* Step 0: Upload */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400 space-y-1">
                <p className="font-medium text-zinc-300 flex items-center gap-1"><Info className="h-4 w-4 text-blue-400" /> Accepted CSV formats</p>
                <p>• Any CSV with a date/time column and energy values</p>
                <p>• Columns auto-detected: solar, consumption, battery, grid</p>
                <p>• Units auto-detected: kWh or Wh, % for battery SOC</p>
                <p>• Date formats: ISO 8601, DD/MM/YYYY, MM/DD/YYYY, Unix epoch</p>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-yellow-400 bg-yellow-400/10' :
                  csvFile ? 'border-green-500/50 bg-green-500/5' :
                  'border-zinc-700 hover:border-yellow-400/50 hover:bg-zinc-800/30'
                }`}
              >
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                {csvFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-green-400" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-green-300">{csvFile.name}</p>
                      <p className="text-xs text-zinc-500">{(csvFile.size / 1024).toFixed(1)} KB · Click to replace</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="mx-auto h-10 w-10 mb-3 text-zinc-500" />
                    <p className="text-sm font-medium text-zinc-300">Drag & drop or click to upload</p>
                    <p className="text-xs text-zinc-600 mt-1">CSV files only</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Map Columns */}
          {step === 1 && parseResult && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">
                Found <span className="text-white font-medium">{parseResult.headers.length}</span> columns
                in <span className="text-white font-medium">{parseResult.rowCount.toLocaleString()}</span> rows.
                Review and adjust the auto-detected mappings:
              </p>
              <div className="space-y-2">
                {mappings.map((mapping, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-200">{mapping.originalName}</p>
                        <p className="text-xs text-zinc-500 font-mono">
                          Samples: {mapping.sample.slice(0, 3).join(' · ') || 'N/A'}
                        </p>
                        {mapping.confidence < 70 && (
                          <span className="text-[10px] text-yellow-400">⚠ Low confidence — please verify</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={mapping.mappedTo}
                          onChange={e => {
                            const updated = [...mappings];
                            updated[i] = { ...mapping, mappedTo: e.target.value as NormalizedField };
                            setMappings(updated);
                          }}
                          className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-yellow-400"
                        >
                          {(Object.keys(FIELD_LABELS) as NormalizedField[]).map(f => (
                            <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                          ))}
                        </select>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                          mapping.confidence >= 80 ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
                        }`}>{mapping.confidence}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-600">
                ⚠ You must have at least a <strong className="text-zinc-400">Timestamp</strong> column mapped. Solar and Consumption columns are optional but recommended.
              </p>
            </div>
          )}

          {/* Step 2: Validation results */}
          {step === 2 && validation && importResult && (
            <div className="space-y-4">
              <div className={`rounded-xl border p-4 ${
                validation.qualityScore >= 80 ? 'border-emerald-500/30 bg-emerald-950/30' :
                validation.qualityScore >= 50 ? 'border-yellow-500/30 bg-yellow-950/30' :
                'border-red-500/30 bg-red-950/30'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {validation.qualityScore >= 80 ? <CheckCircle className="h-6 w-6 text-emerald-400" /> : <AlertTriangle className="h-6 w-6 text-yellow-400" />}
                  <div>
                    <p className="text-sm font-bold text-white">Import {validation.isValid ? 'Successful' : 'Partial'}</p>
                    <p className="text-xs text-zinc-400">Data quality score: {validation.qualityScore}/100</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-lg font-black text-emerald-400">{importResult.importedCount}</p><p className="text-xs text-zinc-500">Imported</p></div>
                  <div><p className="text-lg font-black text-yellow-400">{validation.duplicateCount}</p><p className="text-xs text-zinc-500">Duplicates skipped</p></div>
                  <div><p className="text-lg font-black text-red-400">{validation.errorCount}</p><p className="text-xs text-zinc-500">Errors</p></div>
                </div>
              </div>

              {validation.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 bg-yellow-950/40 border border-yellow-700/40 rounded-xl px-4 py-3 text-sm text-yellow-300">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-400" /> {w.message}
                </div>
              ))}

              {validation.errors.slice(0, 5).map((e, i) => (
                <div key={i} className="text-xs text-red-400 bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2 font-mono">
                  Row {e.row}: {e.message}
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
              <div className="bg-yellow-400/10 border border-yellow-400/20 p-5 rounded-2xl">
                <CheckCircle className="h-12 w-12 text-yellow-400 mx-auto" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">Import Complete!</p>
                <p className="text-sm text-zinc-400 mt-1">Dashboard is refreshing with your data…</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 3 && (
          <div className="flex items-center justify-between p-5 border-t border-zinc-800">
            <button
              onClick={() => step > 0 ? setStep(step - 1) : (setIsOpen(false), reset())}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 transition-all"
            >
              <ChevronLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
            </button>

            <button
              onClick={step === 0 ? parseHeaders : step === 1 ? validateMapping : finish}
              disabled={loading || (step === 0 && !csvFile)}
              className="flex items-center gap-2 px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-400/40 text-black text-sm font-bold rounded-xl transition-all disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === 0 ? 'Detect Columns →' : step === 1 ? 'Import Data →' : 'Finish →'}
              {!loading && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
