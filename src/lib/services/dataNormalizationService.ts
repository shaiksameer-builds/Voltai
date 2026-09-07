/**
 * dataNormalizationService.ts
 *
 * Handles CSV column detection, smart mapping, validation, and normalization
 * into the standard EnergyReading schema.
 */

export type NormalizedField =
  | 'timestamp'
  | 'solar_kwh'
  | 'consumption_kwh'
  | 'battery_soc_percent'
  | 'battery_charge_kwh'
  | 'battery_discharge_kwh'
  | 'grid_import_kwh'
  | 'grid_export_kwh'
  | 'ignore';

export interface ColumnMapping {
  originalName: string;
  mappedTo: NormalizedField;
  unit: string;
  confidence: number; // 0-100, how confident we are in auto-detection
  sample: string[];   // first 5 sample values
}

export interface ParsedRow {
  timestamp: Date;
  solarKwh: number | null;
  consumptionKwh: number | null;
  batterySocPercent: number | null;
  batteryChargeKwh: number | null;
  batteryDischargeKwh: number | null;
  gridImportKwh: number | null;
  gridExportKwh: number | null;
}

export interface ValidationResult {
  isValid: boolean;
  rowCount: number;
  importedCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
  warnings: Array<{ type: string; message: string; count: number }>;
  qualityScore: number; // 0-100
  coveragePercent: number;
  duplicateCount: number;
  nighttimeSolarCount: number; // suspicious: solar > 0 at night
}

export interface CsvParseResult {
  headers: string[];
  columnMappings: ColumnMapping[];
  sampleRows: Record<string, string>[]; // first 5 rows
  rowCount: number;
}

// ── Column Auto-Detection ─────────────────────────────────────────────────────

const TIMESTAMP_PATTERNS = [
  /^(date|time|timestamp|datetime|ts|recorded|period|interval)/i,
  /^(dt|date_time|reading_time|log_time|event_time)/i,
];

const SOLAR_PATTERNS = [
  /^(solar|pv|generation|generated|produced|production)/i,
  /^(solar_energy|solar_kwh|pv_energy|pv_kwh|gen_kwh|yield)/i,
  /^(e_pv|e_solar|solar_export|panel|array)/i,
];

const CONSUMPTION_PATTERNS = [
  /^(consumption|consumed|load|demand|usage|use|household)/i,
  /^(energy_consumed|kwh_consumed|house_load|total_load|e_load)/i,
  /^(home_consumption|net_consumption|energy_use)/i,
];

const BATTERY_SOC_PATTERNS = [
  /^(soc|battery_soc|battery_percent|soc_percent|state_of_charge|charge_level)/i,
  /^(batt_soc|batt_percent|battery_level)/i,
];

const BATTERY_CHARGE_PATTERNS = [
  /^(battery_charge|charge_kwh|batt_charge|charging|battery_in)/i,
];

const BATTERY_DISCHARGE_PATTERNS = [
  /^(battery_discharge|discharge_kwh|batt_discharge|discharging|battery_out)/i,
];

const GRID_IMPORT_PATTERNS = [
  /^(grid_import|grid_buy|grid_purchased|import|grid_in|from_grid|mains)/i,
  /^(energy_import|grid_energy|e_grid|utility)/i,
];

const GRID_EXPORT_PATTERNS = [
  /^(grid_export|grid_sell|export|grid_out|to_grid|feed_in|feedin)/i,
  /^(energy_export|e_export)/i,
];

function detectField(header: string): { field: NormalizedField; confidence: number } {
  const h = header.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  
  for (const p of TIMESTAMP_PATTERNS) if (p.test(h)) return { field: 'timestamp', confidence: 90 };
  for (const p of SOLAR_PATTERNS) if (p.test(h)) return { field: 'solar_kwh', confidence: 85 };
  for (const p of CONSUMPTION_PATTERNS) if (p.test(h)) return { field: 'consumption_kwh', confidence: 85 };
  for (const p of BATTERY_SOC_PATTERNS) if (p.test(h)) return { field: 'battery_soc_percent', confidence: 85 };
  for (const p of BATTERY_CHARGE_PATTERNS) if (p.test(h)) return { field: 'battery_charge_kwh', confidence: 80 };
  for (const p of BATTERY_DISCHARGE_PATTERNS) if (p.test(h)) return { field: 'battery_discharge_kwh', confidence: 80 };
  for (const p of GRID_IMPORT_PATTERNS) if (p.test(h)) return { field: 'grid_import_kwh', confidence: 80 };
  for (const p of GRID_EXPORT_PATTERNS) if (p.test(h)) return { field: 'grid_export_kwh', confidence: 80 };
  
  return { field: 'ignore', confidence: 50 };
}

function detectUnit(samples: string[], field: NormalizedField): string {
  if (field === 'battery_soc_percent') return '%';
  if (field === 'timestamp') return '';
  // Check if values look like Wh (large numbers) vs kWh (small)
  const nums = samples.map(s => parseFloat(s)).filter(n => !isNaN(n));
  if (nums.length === 0) return 'kWh';
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return avg > 500 ? 'Wh' : 'kWh'; // auto-detect unit scale
}

// ── CSV Parsing ───────────────────────────────────────────────────────────────

export function parseCsvHeaders(csvText: string): CsvParseResult {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], columnMappings: [], sampleRows: [], rowCount: 0 };

  // Detect delimiter
  const firstLine = lines[0];
  const delim = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

  const parseRow = (line: string): string[] =>
    line.split(delim).map(cell => cell.trim().replace(/^["']|["']$/g, ''));

  const headers = parseRow(lines[0]);
  const dataLines = lines.slice(1);
  const sampleRows: Record<string, string>[] = dataLines.slice(0, 5).map(line => {
    const cells = parseRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });

  const columnMappings: ColumnMapping[] = headers.map(header => {
    const { field, confidence } = detectField(header);
    const samples = sampleRows.map(row => row[header] ?? '').filter(Boolean);
    const unit = detectUnit(samples, field);
    return { originalName: header, mappedTo: field, unit, confidence, sample: samples };
  });

  return {
    headers,
    columnMappings,
    sampleRows,
    rowCount: dataLines.length,
  };
}

// ── Data Normalization ────────────────────────────────────────────────────────

function parseTimestamp(raw: string): Date | null {
  if (!raw || raw.trim() === '') return null;
  
  // Try various formats
  const formats = [
    // ISO-like
    (s: string) => new Date(s),
    // DD/MM/YYYY HH:MM
    (s: string) => {
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(\d{1,2}):(\d{2})(:(\d{2}))?/);
      if (!m) return null;
      return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00`);
    },
    // MM/DD/YYYY HH:MM
    (s: string) => {
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(\d{1,2}):(\d{2})/);
      if (!m) return null;
      return new Date(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00`);
    },
    // Unix epoch
    (s: string) => {
      const n = parseInt(s, 10);
      if (!isNaN(n) && n > 1e9) return new Date(n * 1000);
      return null;
    },
  ];

  for (const parser of formats) {
    try {
      const d = parser(raw.trim());
      if (d && !isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
        return d;
      }
    } catch {}
  }
  return null;
}

function parseNumeric(raw: string, unit: string): number | null {
  if (!raw || raw.trim() === '' || raw.toLowerCase() === 'null' || raw === '-') return null;
  const cleaned = raw.replace(/[,\s]/g, '').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  // Convert Wh to kWh
  return unit === 'Wh' ? n / 1000 : n;
}

export function normalizeRows(
  csvText: string,
  mappings: ColumnMapping[]
): { rows: ParsedRow[]; validation: ValidationResult } {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  const firstLine = lines[0];
  const delim = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const parseRow = (line: string): string[] =>
    line.split(delim).map(cell => cell.trim().replace(/^["']|["']$/g, ''));

  const dataLines = lines.slice(1);
  const tsMapping = mappings.find(m => m.mappedTo === 'timestamp');

  const rows: ParsedRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  const seenTimestamps = new Set<string>();
  let duplicateCount = 0;
  let nighttimeSolarCount = 0;
  const solarMapping = mappings.find(m => m.mappedTo === 'solar_kwh');

  for (let i = 0; i < dataLines.length; i++) {
    const cells = parseRow(dataLines[i]);
    const rowNum = i + 2;
    if (cells.every(c => c === '')) continue;

    // Parse timestamp
    let timestamp: Date | null = null;
    if (tsMapping) {
      const headerIdx = mappings.findIndex(m => m === tsMapping);
      timestamp = parseTimestamp(cells[headerIdx] ?? '');
    }
    if (!timestamp) {
      errors.push({ row: rowNum, message: `Cannot parse timestamp from: "${cells[tsMapping ? mappings.findIndex(m => m === tsMapping) : 0] ?? ''}"` });
      continue;
    }

    // Deduplicate
    const tsKey = timestamp.toISOString();
    if (seenTimestamps.has(tsKey)) {
      duplicateCount++;
      continue;
    }
    seenTimestamps.add(tsKey);

    const getValue = (field: NormalizedField): number | null => {
      const m = mappings.find(mp => mp.mappedTo === field);
      if (!m) return null;
      const idx = mappings.indexOf(m);
      return parseNumeric(cells[idx] ?? '', m.unit);
    };

    const solarKwh = getValue('solar_kwh');

    // Night solar check: hour 0-5 or 20-23 with solar > 0
    const hour = timestamp.getUTCHours();
    if (solarKwh !== null && solarKwh > 0 && (hour < 5 || hour > 20)) {
      nighttimeSolarCount++;
    }

    rows.push({
      timestamp,
      solarKwh,
      consumptionKwh: getValue('consumption_kwh'),
      batterySocPercent: getValue('battery_soc_percent'),
      batteryChargeKwh: getValue('battery_charge_kwh'),
      batteryDischargeKwh: getValue('battery_discharge_kwh'),
      gridImportKwh: getValue('grid_import_kwh'),
      gridExportKwh: getValue('grid_export_kwh'),
    });
  }

  const warnings: ValidationResult['warnings'] = [];
  if (duplicateCount > 0) {
    warnings.push({ type: 'duplicates', message: `${duplicateCount} duplicate timestamps were skipped`, count: duplicateCount });
  }
  if (nighttimeSolarCount > 0) {
    warnings.push({
      type: 'nighttime_solar',
      message: `⚠ Solar generation recorded during nighttime hours (UTC 20:00–05:00) in ${nighttimeSolarCount} rows. This may indicate a timezone mismatch. Verify the timestamp column's timezone.`,
      count: nighttimeSolarCount,
    });
  }

  const nonNullFields = rows.filter(r => r.solarKwh !== null || r.consumptionKwh !== null).length;
  const coveragePercent = rows.length > 0 ? Math.round((nonNullFields / rows.length) * 100) : 0;
  const qualityScore = Math.max(0, coveragePercent - (errors.length / Math.max(1, dataLines.length)) * 50 - (duplicateCount > 0 ? 5 : 0));

  return {
    rows,
    validation: {
      isValid: rows.length > 0,
      rowCount: dataLines.length,
      importedCount: rows.length,
      errorCount: errors.length,
      errors: errors.slice(0, 20), // cap error list
      warnings,
      qualityScore: Math.round(qualityScore),
      coveragePercent,
      duplicateCount,
      nighttimeSolarCount,
    },
  };
}
