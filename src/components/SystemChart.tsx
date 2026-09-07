'use client';

import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';

interface ForecastPoint {
  hour: number;
  estimatedKwh: number;
  isEstimated: boolean;
  consumptionKwh?: number;
  batterySocPercent?: number;
  gridImportKwh?: number;
  gridExportKwh?: number;
  solarActualKwh?: number; // measured value if available
}

interface SystemChartProps {
  data: ForecastPoint[];
  currentHour?: number;
  showConsumption?: boolean;
  showBattery?: boolean;
  showGrid?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs shadow-xl min-w-[160px]">
      <p className="text-zinc-400 font-mono mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex justify-between gap-4 mb-1">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="text-white font-semibold">
            {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            {entry.dataKey === 'batterySocPercent' ? '%' : ' kWh'}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function SystemChart({
  data,
  currentHour,
  showConsumption = true,
  showBattery = false,
  showGrid = false,
}: SystemChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-zinc-900/60 border border-zinc-800 rounded-xl gap-2">
        <AlertTriangle className="h-6 w-6 text-yellow-400" />
        <p className="text-zinc-500 text-sm">No forecast data available</p>
      </div>
    );
  }

  // Separate actual vs estimated for visual distinction
  const chartData = data.map(d => ({
    time: `${d.hour}:00`,
    hour: d.hour,
    'Solar (Est.)': d.isEstimated && d.solarActualKwh == null
      ? Number(Math.max(0, d.estimatedKwh).toFixed(2))
      : null,
    'Solar (Actual)': d.solarActualKwh != null
      ? Number(Math.max(0, d.solarActualKwh).toFixed(2))
      : null,
    ...(showConsumption && d.consumptionKwh != null
      ? { 'Consumption': Number(d.consumptionKwh.toFixed(2)) }
      : {}),
    ...(showBattery && d.batterySocPercent != null
      ? { 'Battery SOC': Number(d.batterySocPercent.toFixed(1)) }
      : {}),
    ...(showGrid && d.gridImportKwh != null
      ? { 'Grid Import': Number(d.gridImportKwh.toFixed(2)) }
      : {}),
    ...(showGrid && d.gridExportKwh != null
      ? { 'Grid Export': Number(d.gridExportKwh.toFixed(2)) }
      : {}),
  }));

  const hasActual = data.some(d => d.solarActualKwh != null);
  const hasConsumption = showConsumption && data.some(d => d.consumptionKwh != null);
  const hasBattery = showBattery && data.some(d => d.batterySocPercent != null);
  const hasGrid = showGrid && data.some(d => d.gridImportKwh != null || d.gridExportKwh != null);

  const nightHours = data.filter(d => d.estimatedKwh === 0).map(d => d.hour);

  return (
    <div>
      {/* Legend explaining actual vs forecast */}
      <div className="flex flex-wrap gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-400 opacity-50" />
          <span className="text-zinc-400">Solar forecast</span>
        </div>
        {hasActual && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-yellow-400" />
            <span className="text-zinc-400">Solar measured</span>
          </div>
        )}
        {hasConsumption && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded bg-blue-400" style={{ borderTop: '2px solid #60a5fa' }} />
            <span className="text-zinc-400">Consumption</span>
          </div>
        )}
        {hasBattery && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded" style={{ borderTop: '2px dashed #34d399' }} />
            <span className="text-zinc-400">Battery SOC</span>
          </div>
        )}
        <span className="text-zinc-600 ml-auto italic">Night hours show 0 kWh (correct)</span>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
            <XAxis
              dataKey="time"
              stroke="#52525b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#71717a' }}
              interval={2}
            />
            <YAxis
              stroke="#52525b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#71717a' }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Current hour reference line */}
            {currentHour !== undefined && (
              <ReferenceLine
                x={`${currentHour}:00`}
                stroke="#facc15"
                strokeDasharray="4 2"
                strokeWidth={1.5}
                label={{ value: 'Now', fill: '#facc15', fontSize: 10 }}
              />
            )}

            {/* Solar forecast bars (semi-transparent) */}
            <Bar
              dataKey="Solar (Est.)"
              fill="#facc15"
              fillOpacity={0.4}
              radius={[3, 3, 0, 0]}
              name="Solar (Est.)"
            />

            {/* Solar actual bars (solid) */}
            {hasActual && (
              <Bar
                dataKey="Solar (Actual)"
                fill="#facc15"
                fillOpacity={1}
                radius={[3, 3, 0, 0]}
                name="Solar (Actual)"
              />
            )}

            {/* Consumption line */}
            {hasConsumption && (
              <Line
                type="monotone"
                dataKey="Consumption"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
                strokeDasharray="0"
                name="Consumption"
              />
            )}

            {/* Battery SOC line */}
            {hasBattery && (
              <Line
                type="monotone"
                dataKey="Battery SOC"
                stroke="#34d399"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
                name="Battery SOC"
              />
            )}

            {/* Grid import */}
            {hasGrid && (
              <Bar
                dataKey="Grid Import"
                fill="#f87171"
                fillOpacity={0.5}
                radius={[2, 2, 0, 0]}
                name="Grid Import"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
