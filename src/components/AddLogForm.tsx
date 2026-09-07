'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

export default function AddLogForm({ systemId }: { systemId: string }) {
  const [date, setDate] = useState('');
  const [kwh, setKwh] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemId, date, kwhConsumed: kwh }),
      });

      if (res.ok) {
        setDate('');
        setKwh('');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add log');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-end">
      <div className="flex-1">
        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Date</label>
        <input
          type="date"
          required
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-colors [color-scheme:dark]"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Consumption (kWh)</label>
        <input
          type="number"
          step="0.1"
          min="0"
          required
          value={kwh}
          onChange={e => setKwh(e.target.value)}
          placeholder="e.g. 12.5"
          className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-colors"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-400/40 text-black text-sm font-bold rounded-xl shadow-lg shadow-yellow-400/10 transition-all disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          {loading ? 'Adding...' : 'Add Log'}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </form>
  );
}
