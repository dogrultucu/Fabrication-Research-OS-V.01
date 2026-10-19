import {
  APP_VERSION,
  Experiment,
  Measurement,
  MeasurementSchema,
  MeasurementTypeEnum,
  ProcessObservation,
  ProcessObservationSchema,
  ResearchWorkspaceSnapshot,
  SCHEMA_VERSION,
} from '../domain/models';

export async function computeSha256Checksum(content: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hashHex}`;
  }
  // Deterministic fallback hash if WebCrypto unavailable
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `fnv1a:${(h >>> 0).toString(16).padStart(8, '0')}`;
}

export function triggerBrowserDownload(
  filename: string,
  content: string,
  mimeType = 'application/json;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportExperimentsToCsv(experiments: Experiment[]): string {
  const headers = [
    'experimentCode',
    'title',
    'status',
    'experimentType',
    'baselineOrProposedMethod',
    'materialProfileId',
    'hardwareProfileId',
    'printSpeedMmPerSec',
    'relativeFlowPercent',
    'volumetricFlowValue',
    'volumetricFlowUnit',
    'layerHeightMm',
    'targetBeadWidthMm',
    'nozzleDiameterMm',
    'plannedDate',
    'operator',
  ];

  const escapeCsv = (val: unknown) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = experiments.map((e) => [
    e.experimentCode,
    e.title,
    e.status,
    e.experimentType,
    e.baselineOrProposedMethod,
    e.materialProfileId,
    e.hardwareProfileId,
    e.processParameters.printSpeedMmPerSec,
    e.processParameters.relativeFlowPercent,
    e.processParameters.volumetricFlowValue ?? '',
    e.processParameters.volumetricFlowUnit,
    e.processParameters.layerHeightMm,
    e.processParameters.targetBeadWidthMm,
    e.processParameters.nozzleDiameterMm,
    e.plannedDate,
    e.operator,
  ]);

  return [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
}

export function exportMeasurementsToCsv(measurements: Measurement[]): string {
  const headers = [
    'id',
    'experimentId',
    'specimenId',
    'layerIndex',
    'measurementType',
    'measuredValue',
    'targetValue',
    'tolerance',
    'unit',
    'sourceType',
    'verifiedPhysicalMeasurement',
    'acquisitionMethod',
    'coordinateFrame',
    'standardUncertainty',
    'timestamp',
  ];

  const escapeCsv = (val: unknown) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = measurements.map((m) => [
    m.id,
    m.experimentId,
    m.specimenId,
    m.layerIndex ?? '',
    m.measurementType,
    m.measuredValue,
    m.targetValue,
    m.tolerance,
    m.unit,
    m.sourceType,
    m.verifiedPhysicalMeasurement,
    m.acquisitionMethod,
    m.coordinateFrame,
    m.uncertaintyMetadata.standardUncertainty,
    m.timestamp,
  ]);

  return [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
}

export interface CsvMeasurementParseResult {
  validMeasurements: Measurement[];
  errors: string[];
}

/**
 * Parses a CSV file of physical measurements and validates each row with Zod.
 * Expected columns (case-insensitive):
 * specimenId, layerIndex, measurementType, measuredValue, targetValue, tolerance, unit, acquisitionMethod, coordinateFrame, standardUncertainty
 */
export function parseMeasurementsCsv(
  csvText: string,
  targetExperimentId: string,
  sourceFileId?: string
): CsvMeasurementParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      validMeasurements: [],
      errors: ['CSV file must contain a header row and at least one data row.'],
    };
  }

  const rawHeaders = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const colIndex = (name: string) =>
    rawHeaders.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const validMeasurements: Measurement[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowValues = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const getVal = (name: string, fallback = '') => {
      const idx = colIndex(name);
      return idx >= 0 && idx < rowValues.length ? rowValues[idx] : fallback;
    };

    const rawType = getVal('measurementType', 'bead width');
    const parsedTypeResult = MeasurementTypeEnum.safeParse(rawType);
    const measurementType = parsedTypeResult.success ? parsedTypeResult.data : 'custom measurement';

    const measuredValue = Number(getVal('measuredValue', 'NaN'));
    const targetValue = Number(getVal('targetValue', 'NaN'));
    const tolerance = Number(getVal('tolerance', '0.5'));
    const layerIdxRaw = getVal('layerIndex', '');
    const layerIndex = layerIdxRaw !== '' ? Number(layerIdxRaw) : undefined;
    const uncertainty = Number(getVal('standardUncertainty', '0.05'));

    const candidate: Measurement = {
      id: `meas-imp-${Date.now()}-${i}`,
      experimentId: targetExperimentId,
      specimenId: getVal('specimenId', `SPEC-IMP-${i}`),
      layerIndex: Number.isFinite(layerIndex) ? layerIndex : undefined,
      measurementType,
      customMeasurementLabel: !parsedTypeResult.success ? rawType : undefined,
      measuredValue,
      unit: getVal('unit', 'mm') || 'mm',
      targetValue,
      tolerance: tolerance > 0 ? tolerance : 0.5,
      timestamp: getVal('timestamp', new Date().toISOString()) || new Date().toISOString(),
      sourceType: 'Imported',
      verifiedPhysicalMeasurement: true,
      profileGeometryType: 'Scalar Point Measurement (Schematic Only)',
      acquisitionMethod: getVal('acquisitionMethod', 'CSV Instrument Import'),
      algorithmVersion: 'csv-import-v1',
      coordinateFrame: getVal('coordinateFrame', 'wobjPrintTable_01'),
      uncertaintyMetadata: {
        standardUncertainty: Number.isFinite(uncertainty) && uncertainty >= 0 ? uncertainty : 0.05,
        confidenceLevelPercent: 95,
        calibrationRef: 'IMPORTED-CSV',
      },
      sourceFileId,
      isSampleFixture: false,
    };

    const validation = MeasurementSchema.safeParse(candidate);
    if (!validation.success) {
      errors.push(
        `Row ${i + 1}: ${validation.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ')}`
      );
    } else {
      validMeasurements.push(validation.data);
    }
  }

  return { validMeasurements, errors };
}

export interface BackupValidationResult {
  valid: boolean;
  snapshot?: ResearchWorkspaceSnapshot;
  errors: string[];
  migratedFromVersion?: number;
}

/**
 * Validates and non-destructively migrates a JSON workspace backup snapshot.
 */
export function validateAndMigrateWorkspaceSnapshot(
  rawJson: string
): BackupValidationResult {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, errors: ['Root JSON payload must be an object.'] };
    }

    if (!parsed.project || typeof parsed.project.id !== 'string') {
      return {
        valid: false,
        errors: ['Snapshot is missing a valid Project record (`project.id`).'],
      };
    }

    const incomingVersion =
      typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0;

    // Non-destructive defaults for any missing arrays
    const snapshot: ResearchWorkspaceSnapshot = {
      schemaVersion: SCHEMA_VERSION,
      appVersion: parsed.appVersion || APP_VERSION,
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      project: {
        ...parsed.project,
        schemaVersion: SCHEMA_VERSION,
      },
      materialProfiles: Array.isArray(parsed.materialProfiles)
        ? parsed.materialProfiles
        : [],
      hardwareProfiles: Array.isArray(parsed.hardwareProfiles)
        ? parsed.hardwareProfiles
        : [],
      experiments: Array.isArray(parsed.experiments) ? parsed.experiments : [],
      processParameterSets: Array.isArray(parsed.processParameterSets)
        ? parsed.processParameterSets
        : [],
      measurements: Array.isArray(parsed.measurements) ? parsed.measurements : [],
      processObservations: Array.isArray(parsed.processObservations)
        ? parsed.processObservations
        : [],
      calibrationSessions: Array.isArray(parsed.calibrationSessions)
        ? parsed.calibrationSessions
        : [],
      calibrationTrials: Array.isArray(parsed.calibrationTrials)
        ? parsed.calibrationTrials
        : [],
      researchReferences: Array.isArray(parsed.researchReferences)
        ? parsed.researchReferences
        : [],
      productionMetrics: Array.isArray(parsed.productionMetrics)
        ? parsed.productionMetrics
        : [],
      fileMetadata: Array.isArray(parsed.fileMetadata) ? parsed.fileMetadata : [],
      auditEvents: Array.isArray(parsed.auditEvents) ? parsed.auditEvents : [],
    };

    return {
      valid: true,
      snapshot,
      errors: [],
      migratedFromVersion:
        incomingVersion !== SCHEMA_VERSION ? incomingVersion : undefined,
    };
  } catch (err) {
    return {
      valid: false,
      errors: [
        `Failed to parse JSON backup: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }
}
