'use client';

import { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Save, PlayCircle, Loader2 } from 'lucide-react';

interface Appliance {
  id: string;
  name: string;
  powerKw: number;
  durationMinutes: number;
  isFlexible: boolean;
  preferredStart: string | null;
  preferredEnd: string | null;
}

export default function ApplianceScheduler({ systemId }: { systemId: string }) {
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  // New appliance form state
  const [name, setName] = useState('');
  const [powerKw, setPowerKw] = useState('');
  const [duration, setDuration] = useState('60');
  const [start, setStart] = useState('06:00');
  const [end, setEnd] = useState('20:00');

  const fetchAppliances = () => {
    setLoading(true);
    fetch(`/api/appliances?systemId=${systemId}`)
      .then(res => res.json())
      .then(data => {
        setAppliances(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAppliances();
  }, [systemId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/appliances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemId,
        name,
        powerKw,
        durationMinutes: duration,
        isFlexible: true,
        preferredStart: start,
        preferredEnd: end,
      }),
    });
    setSaving(false);
    setIsAdding(false);
    setName(''); setPowerKw(''); setDuration('60');
    fetchAppliances();
  };

  if (loading) return <div className="animate-pulse h-32 bg-zinc-900 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-400" /> Managed Appliances
        </h3>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Appliance
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-zinc-900 border border-yellow-400/20 p-4 rounded-xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Appliance Name</label>
              <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Washing Machine"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Power Draw (kW)</label>
              <input required type="number" step="0.1" value={powerKw} onChange={e => setPowerKw(e.target.value)} placeholder="e.g. 2.5"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Duration (minutes)</label>
              <input required type="number" step="15" value={duration} onChange={e => setDuration(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Preferred Start</label>
                <input type="time" value={start} onChange={e => setStart(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Preferred End</label>
                <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-xs text-zinc-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold rounded-lg disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Appliance
            </button>
          </div>
        </form>
      )}

      {appliances.length === 0 && !isAdding ? (
        <div className="text-center py-8 bg-zinc-900 border border-zinc-800 rounded-xl">
          <PlayCircle className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">No appliances added yet.</p>
          <p className="text-xs text-zinc-500 mt-1">Add appliances to get AI scheduling recommendations.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {appliances.map(app => (
            <div key={app.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-white truncate pr-2">{app.name}</h4>
                  <button className="text-zinc-600 hover:text-red-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-400">Power: <strong className="text-zinc-200">{app.powerKw} kW</strong></p>
                <p className="text-xs text-zinc-400">Duration: <strong className="text-zinc-200">{app.durationMinutes} min</strong></p>
                <div className="mt-3 pt-3 border-t border-zinc-800/50">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Preferred Window</p>
                  <p className="text-xs font-mono text-zinc-300">
                    {app.preferredStart || '00:00'} - {app.preferredEnd || '23:59'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
