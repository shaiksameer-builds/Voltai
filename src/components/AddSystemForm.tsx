'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, Zap, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';

export default function AddSystemForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setResult({ success: false, message: 'Please upload a valid .csv file.' });
      return;
    }
    setResult(null);
    setCsvFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFileChange(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setResult({ success: false, message: 'Property name is required.' });
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      let csvContent: string | undefined;

      if (csvFile) {
        csvContent = await csvFile.text();
      }

      const res = await fetch('/api/systems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), csvContent }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult({
          success: true,
          message: `Property "${name}" created successfully!${data.logsImported > 0 ? ` Imported ${data.logsImported} consumption log entries from CSV.` : ''}`,
        });
        setName('');
        setCsvFile(null);
        setTimeout(() => {
          setIsOpen(false);
          setResult(null);
          router.refresh();
        }, 2000);
      } else {
        const err = await res.json();
        setResult({ success: false, message: err.error || 'Failed to create property.' });
      }
    } catch {
      setResult({ success: false, message: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-semibold rounded-xl shadow-lg shadow-yellow-400/20 transition-all duration-200 hover:shadow-yellow-400/40 hover:-translate-y-0.5"
      >
        <Zap className="h-4 w-4 fill-black" />
        Add Property
      </button>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mt-4 shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-400/10 p-2 rounded-lg border border-yellow-400/20">
            <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Add New Property</h3>
        </div>
        <button
          onClick={() => { setIsOpen(false); setResult(null); }}
          className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Property Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Property Name <span className="text-yellow-400">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Home Roof, Office Building"
            className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-colors"
          />
        </div>

        {/* CSV Upload */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            CSV Data File <span className="text-zinc-500">(optional)</span>
          </label>
          <p className="text-xs text-zinc-500 mb-2">
            CSV may include metadata rows (e.g. <code className="text-yellow-400/80">capacity_kw, 5</code>) and/or data rows with columns: <code className="text-yellow-400/80">date, kwh_consumed</code>
          </p>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? 'border-yellow-400 bg-yellow-400/10'
                : csvFile
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-zinc-700 hover:border-yellow-400/50 hover:bg-zinc-800/60 bg-zinc-800/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
            />
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
                <UploadCloud className={`mx-auto h-10 w-10 mb-3 transition-colors ${dragOver ? 'text-yellow-400' : 'text-zinc-500'}`} />
                <p className="text-sm font-medium text-zinc-300">
                  {dragOver ? 'Drop to upload' : 'Drag & drop or click to upload CSV'}
                </p>
                <p className="text-xs text-zinc-600 mt-1">Only .csv files are accepted</p>
              </>
            )}
          </div>
        </div>

        {/* Feedback */}
        {result && (
          <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm border ${
            result.success
              ? 'bg-green-950/60 border-green-700/50 text-green-300'
              : 'bg-red-950/60 border-red-700/50 text-red-300'
          }`}>
            {result.success
              ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-green-400" />
              : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
            }
            {result.message}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => { setIsOpen(false); setResult(null); }}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white bg-transparent border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-400/40 text-black text-sm font-semibold rounded-xl shadow-lg shadow-yellow-400/10 transition-all duration-200 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 fill-black" />
                Create Property
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
