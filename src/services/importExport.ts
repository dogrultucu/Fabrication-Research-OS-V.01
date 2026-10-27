import {
  APP_VERSION,
  AssemblyVerificationSchema,
  AuditEventSchema,
  CalibrationSessionSchema,
  CalibrationTrialSchema,
  Experiment,
  ExperimentSchema,
  FileDatasetMetadataSchema,
  HardwareProfileSchema,
  MaterialProfileSchema,
  Measurement,
  MeasurementSchema,
  MeasurementSourceTypeEnum,
  MeasurementTypeEnum,
  NodeDesignSchema,
  NodeFeatureDefinitionSchema,
  PhysicalStageEnum,
  ProcessObservationSchema,
  ProcessParameterSetSchema,
  ProductionMetricRecordSchema,
  ProjectSchema,
  ResearchReferenceSchema,
  ResearchWorkspaceSnapshot,
  SCHEMA_VERSION,
  SpecimenSchema,
} from '../domain/models';

export async function computeSha256Checksum(content: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hashHex}`;
  }
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

/**
 * RFC-4180 compliant CSV line splitter supporting quoted fields with embedded commas and escaped quotes.
 */
export function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export function exportExperimentsToCsv(experiments: Experiment[]): string {
  const headers = [
    'experimentCode',
    'title',
    'researchWorkflowType',
    'experimentGroup',
    'status',
    'experimentType',
    'baselineOrProposedMethod',
    'nodeDesignId',
    'geometryVersion',
    'plannedSpecimenCount',
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
    e.researchWorkflowType || 'General Extrusion Research',
    e.experimentGroup || '',
    e.status,
    e.experimentType,
    e.baselineOrProposedMethod,
    e.nodeDesignId || '',
    e.geometryVersion || '',
    e.plannedSpecimenCount ?? 1,
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
    'specimenRecordId',
    'nodeDesignId',
    'geometryVersion',
    'featureId',
    'physicalStage',
    'targetStage',
    'layerIndex',
    'xCoordMm',
    'yCoordMm',
    'zCoordMm',
    'measurementType',
    'customMeasurementLabel',
    'measuredValue',
    'targetValue',
    'tolerance',
    'toleranceLower',
    'toleranceUpper',
    'unit',
    'sourceType',
    'verifiedPhysicalMeasurement',
    'acquisitionMethod',
    'algorithmVersion',
    'coordinateFrame',
    'standardUncertainty',
    'confidenceLevelPercent',
    'calibrationRef',
    'notes',
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
    m.specimenRecordId ?? '',
    m.nodeDesignId ?? '',
    m.geometryVersion ?? '',
    m.featureId ?? '',
    m.physicalStage ?? 'Stage Unknown',
    m.targetStage ?? 'Stage Unknown',
    m.layerIndex ?? '',
    m.xCoordMm ?? '',
    m.yCoordMm ?? '',
    m.zCoordMm ?? '',
    m.measurementType,
    m.customMeasurementLabel ?? '',
    m.measuredValue,
    m.targetValue,
    m.tolerance,
    m.toleranceLower ?? m.lowerTolerance ?? '',
    m.toleranceUpper ?? m.upperTolerance ?? '',
    m.unit,
    m.sourceType,
    m.verifiedPhysicalMeasurement,
    m.acquisitionMethod,
    m.algorithmVersion,
    m.coordinateFrame,
    m.uncertaintyMetadata.standardUncertainty,
    m.uncertaintyMetadata.confidenceLevelPercent,
    m.uncertaintyMetadata.calibrationRef,
    m.notes ?? '',
    m.timestamp,
  ]);

  return [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
}

export interface CsvMeasurementParseResult {
  validMeasurements: Measurement[];
  errors: string[];
}

function parseStrictFiniteNumber(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return NaN;
  return Number(trimmed);
}

/**
 * Parses a CSV file of physical or node feature measurements and validates each row with Zod.
 * Supports both v0.1.0 camelCase headers and v0.1.1 snake_case ceramic node headers:
 * experiment_id, specimen_id, node_design_id, geometry_version, feature_id, physical_stage,
 * measurement_type, nominal_value, measured_value, unit, tolerance_lower, tolerance_upper,
 * acquisition_method, coordinate_frame, timestamp, uncertainty, notes.
 */
export function parseMeasurementsCsv(
  csvText: string,
  targetExperimentId: string,
  sourceFileId?: string
): CsvMeasurementParseResult {
  const normalizedCsv = csvText.replace(/^\uFEFF/, '');
  const lines = normalizedCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      validMeasurements: [],
      errors: ['CSV file must contain a header row and at least one data row.'],
    };
  }

  const rawHeaders = splitCsvLine(lines[0]);
  const colIndex = (...names: string[]) => {
    for (const name of names) {
      const idx = rawHeaders.findIndex((h) => h.toLowerCase() === name.toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const validMeasurements: Measurement[] = [];
  const errors: string[] = [];
  const seenBatchIds = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rowValues = splitCsvLine(lines[i]);
    const getVal = (names: string | string[], fallback = '') => {
      const nameList = Array.isArray(names) ? names : [names];
      const idx = colIndex(...nameList);
      return idx >= 0 && idx < rowValues.length ? rowValues[idx] : fallback;
    };

    const rawMeasuredStr = getVal(['measuredValue', 'measured_value'], '');
    const rawTargetStr = getVal(['targetValue', 'nominal_value', 'nominalValue'], '');
    const rawTolLowerStr = getVal(['toleranceLower', 'lowerTolerance', 'tolerance_lower'], '');
    const rawTolUpperStr = getVal(['toleranceUpper', 'upperTolerance', 'tolerance_upper'], '');
    const rawTolStr = getVal(['tolerance', 'tolerancePlusMinus'], '');

    const measuredValue = parseStrictFiniteNumber(rawMeasuredStr);
    const targetValue = parseStrictFiniteNumber(rawTargetStr);

    if (!Number.isFinite(measuredValue)) {
      errors.push(`Row ${i + 1}: Missing or non-numeric measuredValue ("${rawMeasuredStr}").`);
      continue;
    }
    if (!Number.isFinite(targetValue)) {
      errors.push(`Row ${i + 1}: Missing or non-numeric targetValue/nominal_value ("${rawTargetStr}").`);
      continue;
    }

    let toleranceLower: number | undefined;
    let toleranceUpper: number | undefined;

    if (rawTolLowerStr !== '') {
      const parsedLower = parseStrictFiniteNumber(rawTolLowerStr);
      if (!Number.isFinite(parsedLower)) {
        errors.push(`Row ${i + 1}: Invalid toleranceLower ("${rawTolLowerStr}").`);
        continue;
      }
      toleranceLower = parsedLower <= 0 ? parsedLower : -Math.abs(parsedLower);
    }

    if (rawTolUpperStr !== '') {
      const parsedUpper = parseStrictFiniteNumber(rawTolUpperStr);
      if (!Number.isFinite(parsedUpper) || parsedUpper < 0) {
        errors.push(`Row ${i + 1}: Invalid toleranceUpper ("${rawTolUpperStr}").`);
        continue;
      }
      toleranceUpper = parsedUpper;
    }

    let tolerance: number;
    if (rawTolStr !== '') {
      tolerance = parseStrictFiniteNumber(rawTolStr);
      if (!Number.isFinite(tolerance) || tolerance <= 0) {
        errors.push(`Row ${i + 1}: Tolerance must be a positive number ("${rawTolStr}").`);
        continue;
      }
    } else if (toleranceLower !== undefined || toleranceUpper !== undefined) {
      const maxSpan = Math.max(
        Math.abs(toleranceLower ?? 0),
        Math.abs(toleranceUpper ?? 0)
      );
      if (maxSpan <= 0) {
        errors.push(`Row ${i + 1}: Tolerance span must be positive.`);
        continue;
      }
      tolerance = maxSpan;
    } else {
      errors.push(
        `Row ${i + 1}: Missing tolerance specification (provide tolerance or toleranceLower/toleranceUpper).`
      );
      continue;
    }

    const rawType = getVal(['measurementType', 'measurement_type'], 'bead width');
    const parsedTypeResult = MeasurementTypeEnum.safeParse(rawType);
    const measurementType = parsedTypeResult.success
      ? parsedTypeResult.data
      : 'custom measurement';
    const explicitCustomLabel = getVal('customMeasurementLabel', '');
    const customMeasurementLabel =
      explicitCustomLabel || (!parsedTypeResult.success ? rawType : undefined);

    const rawPhysStage = getVal(['physicalStage', 'physical_stage'], 'Stage Unknown');
    const parsedPhysStage = PhysicalStageEnum.safeParse(rawPhysStage);
    if (rawPhysStage !== '' && !parsedPhysStage.success) {
      errors.push(
        `Row ${i + 1}: Invalid physical_stage "${rawPhysStage}". Expected GREEN, DRY, FIRED, Stage Unknown, or Custom.`
      );
      continue;
    }
    const physicalStage = parsedPhysStage.success ? parsedPhysStage.data : 'Stage Unknown';

    const rawTargetStage = getVal(['targetStage', 'target_stage'], '');
    const parsedTargetStage = PhysicalStageEnum.safeParse(rawTargetStage);
    const targetStage = parsedTargetStage.success
      ? parsedTargetStage.data
      : physicalStage !== 'Stage Unknown'
      ? physicalStage
      : 'Stage Unknown';

    const layerIdxRaw = getVal(['layerIndex', 'layer_index'], '');
    const layerIndex =
      layerIdxRaw !== '' ? parseStrictFiniteNumber(layerIdxRaw) : undefined;
    if (layerIndex !== undefined && (!Number.isInteger(layerIndex) || layerIndex < 0)) {
      errors.push(`Row ${i + 1}: layerIndex must be a non-negative integer ("${layerIdxRaw}").`);
      continue;
    }

    const parseOptionalCoord = (colNames: string[]): { ok: boolean; val?: number } => {
      const raw = getVal(colNames, '');
      if (raw === '') return { ok: true, val: undefined };
      const num = parseStrictFiniteNumber(raw);
      if (!Number.isFinite(num)) {
        errors.push(`Row ${i + 1}: ${colNames[0]} must be a finite number ("${raw}").`);
        return { ok: false };
      }
      return { ok: true, val: num };
    };

    const xRes = parseOptionalCoord(['xCoordMm', 'x_coord_mm', 'xMm']);
    const yRes = parseOptionalCoord(['yCoordMm', 'y_coord_mm', 'yMm']);
    const zRes = parseOptionalCoord(['zCoordMm', 'z_coord_mm', 'zMm']);
    if (!xRes.ok || !yRes.ok || !zRes.ok) continue;

    const uncertaintyRaw = getVal(['standardUncertainty', 'uncertainty'], '0.05');
    const uncertainty =
      uncertaintyRaw !== '' ? parseStrictFiniteNumber(uncertaintyRaw) : 0.05;
    if (!Number.isFinite(uncertainty) || uncertainty < 0) {
      errors.push(
        `Row ${i + 1}: standardUncertainty must be a non-negative number ("${uncertaintyRaw}").`
      );
      continue;
    }

    const confRaw = getVal(['confidenceLevelPercent', 'confidence_level_percent'], '95');
    const confidenceLevelPercent =
      confRaw !== '' ? parseStrictFiniteNumber(confRaw) : 95;
    if (
      !Number.isFinite(confidenceLevelPercent) ||
      confidenceLevelPercent < 50 ||
      confidenceLevelPercent > 99.9
    ) {
      errors.push(
        `Row ${i + 1}: confidenceLevelPercent must be between 50 and 99.9 ("${confRaw}").`
      );
      continue;
    }

    const rawSourceType = getVal(['sourceType', 'source_type'], 'Imported');
    const parsedSourceResult = MeasurementSourceTypeEnum.safeParse(rawSourceType);
    const sourceType = parsedSourceResult.success ? parsedSourceResult.data : 'Imported';

    const rawVerifiedStr = getVal('verifiedPhysicalMeasurement', '').toLowerCase();
    let verifiedPhysicalMeasurement =
      sourceType === 'Manual' || sourceType === 'Imported';
    if (rawVerifiedStr === 'false' || rawVerifiedStr === '0') {
      verifiedPhysicalMeasurement = false;
    }
    if (
      sourceType === 'AI-Assisted Annotation' ||
      sourceType === 'Computed'
    ) {
      verifiedPhysicalMeasurement = false;
    }

    const unitStr = getVal('unit', '');
    if (!unitStr) {
      errors.push(`Row ${i + 1}: Explicit physical unit is required.`);
      continue;
    }

    const candidateId = getVal('id', '') || `meas-imp-${Date.now()}-${i}`;
    if (seenBatchIds.has(candidateId)) {
      errors.push(`Row ${i + 1}: Duplicate measurement id "${candidateId}" in CSV batch.`);
      continue;
    }
    seenBatchIds.add(candidateId);

    const specimenRecordId =
      getVal(['specimenRecordId', 'specimen_record_id'], '') || undefined;
    const nodeDesignId = getVal(['nodeDesignId', 'node_design_id'], '') || undefined;
    const geometryVersion = getVal(['geometryVersion', 'geometry_version'], '') || undefined;
    const featureId = getVal(['featureId', 'feature_id'], '') || undefined;

    const candidate: Measurement = {
      id: candidateId,
      experimentId: targetExperimentId,
      specimenId: getVal(['specimenId', 'specimen_id'], '') || `SPEC-IMP-${i}`,
      specimenRecordId,
      nodeDesignId,
      geometryVersion,
      featureId,
      physicalStage,
      targetStage,
      layerIndex,
      xCoordMm: xRes.val,
      yCoordMm: yRes.val,
      zCoordMm: zRes.val,
      measurementType,
      customMeasurementLabel,
      measuredValue,
      unit: unitStr,
      targetValue,
      tolerance,
      toleranceLower,
      toleranceUpper,
      lowerTolerance: toleranceLower,
      upperTolerance: toleranceUpper,
      timestamp: getVal('timestamp', '') || new Date().toISOString(),
      sourceType,
      verifiedPhysicalMeasurement,
      profileGeometryType: 'Scalar Point Measurement (Schematic Only)',
      acquisitionMethod:
        getVal(['acquisitionMethod', 'acquisition_method'], '') || 'CSV Instrument Import',
      algorithmVersion: getVal(['algorithmVersion', 'algorithm_version'], '') || 'csv-import-v2',
      coordinateFrame:
        getVal(['coordinateFrame', 'coordinate_frame'], '') || 'wobjPrintTable_01',
      uncertaintyMetadata: {
        standardUncertainty: uncertainty,
        confidenceLevelPercent,
        calibrationRef: getVal(['calibrationRef', 'calibration_ref'], '') || 'IMPORTED-CSV',
      },
      sourceFileId,
      notes: getVal('notes', '') || undefined,
      isSampleFixture: false,
    };

    const validation = MeasurementSchema.safeParse(candidate);
    if (!validation.success) {
      errors.push(
        `Row ${i + 1}: ${validation.error.issues
          .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
          .join('; ')}`
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
 * Validates and non-destructively migrates a JSON workspace backup snapshot (v1 -> v2),
 * enforcing entity-level Zod validation and cross-entity relational integrity across all 17 entities.
 * Never fabricates GREEN stage labels for legacy v0.1.0 measurements: missing physicalStage defaults to 'Stage Unknown'.
 */
export function validateAndMigrateWorkspaceSnapshot(
  rawJson: string
): BackupValidationResult {
  try {
    const normalizedJson = rawJson.replace(/^\uFEFF/, '');
    const parsed = JSON.parse(normalizedJson);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, errors: ['Root JSON payload must be an object.'] };
    }

    const errors: string[] = [];

    const projParse = ProjectSchema.safeParse({
      ...parsed.project,
      schemaVersion: SCHEMA_VERSION,
    });
    if (!projParse.success) {
      return {
        valid: false,
        errors: [
          `Invalid Project entity: ${projParse.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
        ],
      };
    }

    const incomingVersion =
      typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;

    const validateArray = <T>(
      arr: unknown,
      schema: {
        safeParse: (v: unknown) => {
          success: boolean;
          data?: T;
          error?: { issues: Array<{ path: PropertyKey[]; message: string }> };
        };
      },
      entityLabel: string
    ): T[] => {
      if (arr === undefined || arr === null) return [];
      if (!Array.isArray(arr)) {
        errors.push(`${entityLabel} must be an array.`);
        return [];
      }
      const validItems: T[] = [];
      const seenIds = new Set<string>();
      arr.forEach((item, idx) => {
        const res = schema.safeParse(item);
        if (!res.success) {
          errors.push(
            `${entityLabel}[${idx}]: ${res.error?.issues
              .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
              .join('; ')}`
          );
        } else {
          const id = (res.data as { id?: string }).id;
          if (id) {
            if (seenIds.has(id)) {
              errors.push(`${entityLabel}[${idx}]: Duplicate ID "${id}" detected.`);
              return;
            }
            seenIds.add(id);
          }
          validItems.push(res.data as T);
        }
      });
      return validItems;
    };

    const materialProfiles = validateArray(
      parsed.materialProfiles,
      MaterialProfileSchema,
      'materialProfiles'
    );
    const hardwareProfiles = validateArray(
      parsed.hardwareProfiles,
      HardwareProfileSchema,
      'hardwareProfiles'
    );
    const nodeDesigns = validateArray(
      parsed.nodeDesigns,
      NodeDesignSchema,
      'nodeDesigns'
    );
    const nodeFeatureDefinitions = validateArray(
      parsed.nodeFeatureDefinitions,
      NodeFeatureDefinitionSchema,
      'nodeFeatureDefinitions'
    );
    const normalizedRawExperiments = Array.isArray(parsed.experiments)
      ? parsed.experiments.map((e: any) =>
          incomingVersion === 1 && e && typeof e === 'object'
            ? {
                ...e,
                researchWorkflowType:
                  e.researchWorkflowType || 'General Extrusion Research',
              }
            : e
        )
      : parsed.experiments;
    const experiments = validateArray(
      normalizedRawExperiments,
      ExperimentSchema,
      'experiments'
    );
    const specimens = validateArray(
      parsed.specimens,
      SpecimenSchema,
      'specimens'
    );
    const rawProcessParameterSets = validateArray(
      parsed.processParameterSets,
      ProcessParameterSetSchema,
      'processParameterSets'
    );
    const normalizedRawMeasurements = Array.isArray(parsed.measurements)
      ? parsed.measurements.map((m: any) =>
          m && typeof m === 'object'
            ? {
                ...m,
                physicalStage: m.physicalStage || 'Stage Unknown',
              }
            : m
        )
      : parsed.measurements;
    const measurements = validateArray(
      normalizedRawMeasurements,
      MeasurementSchema,
      'measurements'
    );
    const assemblyVerifications = validateArray(
      parsed.assemblyVerifications,
      AssemblyVerificationSchema,
      'assemblyVerifications'
    );
    const processObservations = validateArray(
      parsed.processObservations,
      ProcessObservationSchema,
      'processObservations'
    );
    const calibrationSessions = validateArray(
      parsed.calibrationSessions,
      CalibrationSessionSchema,
      'calibrationSessions'
    );
    const calibrationTrials = validateArray(
      parsed.calibrationTrials,
      CalibrationTrialSchema,
      'calibrationTrials'
    );
    const researchReferences = validateArray(
      parsed.researchReferences,
      ResearchReferenceSchema,
      'researchReferences'
    );
    const productionMetrics = validateArray(
      parsed.productionMetrics,
      ProductionMetricRecordSchema,
      'productionMetrics'
    );
    const fileMetadata = validateArray(
      parsed.fileMetadata,
      FileDatasetMetadataSchema,
      'fileMetadata'
    );
    const auditEvents = validateArray(
      parsed.auditEvents,
      AuditEventSchema,
      'auditEvents'
    );

    // Relational integrity & uniqueness verification across entities
    const matIds = new Set(materialProfiles.map((m) => m.id));
    const hwIds = new Set(hardwareProfiles.map((h) => h.id));
    const nodeDesignIds = new Set(nodeDesigns.map((nd) => nd.id));
    const expIds = new Set(experiments.map((e) => e.id));
    const specIds = new Set(specimens.map((s) => s.id));
    const specCodes = new Set(specimens.map((s) => s.specimenCode));
    const sessIds = new Set(calibrationSessions.map((s) => s.id));
    const seenExpCodes = new Set<string>();

    for (const feat of nodeFeatureDefinitions) {
      const parentId = feat.nodeDesignRecordId || feat.nodeDesignId;
      if (parentId && !nodeDesignIds.has(parentId)) {
        errors.push(
          `Relational Integrity Error: NodeFeatureDefinition "${feat.featureCode || feat.featureId}" references missing NodeDesign "${parentId}".`
        );
      }
    }

    for (const exp of experiments) {
      const codeNorm = exp.experimentCode.trim().toLowerCase();
      if (seenExpCodes.has(codeNorm)) {
        errors.push(
          `Duplicate experimentCode "${exp.experimentCode}" detected in backup.`
        );
      }
      seenExpCodes.add(codeNorm);

      if (!matIds.has(exp.materialProfileId)) {
        errors.push(
          `Relational Integrity Error: Experiment "${exp.experimentCode}" references missing materialProfileId "${exp.materialProfileId}".`
        );
      }
      if (!hwIds.has(exp.hardwareProfileId)) {
        errors.push(
          `Relational Integrity Error: Experiment "${exp.experimentCode}" references missing hardwareProfileId "${exp.hardwareProfileId}".`
        );
      }
      if (exp.nodeDesignId && !nodeDesignIds.has(exp.nodeDesignId)) {
        errors.push(
          `Relational Integrity Error: Experiment "${exp.experimentCode}" references missing nodeDesignId "${exp.nodeDesignId}".`
        );
      }
      if (
        exp.referenceBaselineExperimentId &&
        !expIds.has(exp.referenceBaselineExperimentId)
      ) {
        errors.push(
          `Relational Integrity Error: Experiment "${exp.experimentCode}" references missing referenceBaselineExperimentId "${exp.referenceBaselineExperimentId}".`
        );
      }
    }

    for (const spec of specimens) {
      if (!expIds.has(spec.experimentId)) {
        errors.push(
          `Relational Integrity Error: Specimen "${spec.specimenCode}" references missing experimentId "${spec.experimentId}".`
        );
      }
      if (spec.nodeDesignId && !nodeDesignIds.has(spec.nodeDesignId)) {
        errors.push(
          `Relational Integrity Error: Specimen "${spec.specimenCode}" references missing nodeDesignId "${spec.nodeDesignId}".`
        );
      }
    }

    for (const meas of measurements) {
      if (!expIds.has(meas.experimentId)) {
        errors.push(
          `Relational Integrity Error: Measurement "${meas.id}" references missing experimentId "${meas.experimentId}".`
        );
      }
      if (meas.specimenRecordId && !specIds.has(meas.specimenRecordId)) {
        errors.push(
          `Relational Integrity Error: Measurement "${meas.id}" references missing specimenRecordId "${meas.specimenRecordId}".`
        );
      }
    }

    for (const assm of assemblyVerifications) {
      if (!expIds.has(assm.experimentId)) {
        errors.push(
          `Relational Integrity Error: AssemblyVerification "${assm.id}" references missing experimentId "${assm.experimentId}".`
        );
      }
      if (assm.nodeDesignId && !nodeDesignIds.has(assm.nodeDesignId)) {
        errors.push(
          `Relational Integrity Error: AssemblyVerification "${assm.id}" references missing nodeDesignId "${assm.nodeDesignId}".`
        );
      }
      if (
        assm.specimenRecordId &&
        !specIds.has(assm.specimenRecordId)
      ) {
        errors.push(
          `Relational Integrity Error: AssemblyVerification "${assm.id}" references missing specimenRecordId "${assm.specimenRecordId}".`
        );
      } else if (
        !assm.specimenRecordId &&
        assm.specimenId &&
        !specIds.has(assm.specimenId) &&
        !specCodes.has(assm.specimenId)
      ) {
        errors.push(
          `Relational Integrity Error: AssemblyVerification "${assm.id}" references missing specimenId "${assm.specimenId}".`
        );
      }
    }

    for (const obs of processObservations) {
      if (!expIds.has(obs.experimentId)) {
        errors.push(
          `Relational Integrity Error: ProcessObservation "${obs.id}" references missing experimentId "${obs.experimentId}".`
        );
      }
    }

    for (const sess of calibrationSessions) {
      if (!matIds.has(sess.materialProfileId)) {
        errors.push(
          `Relational Integrity Error: CalibrationSession "${sess.sessionCode}" references missing materialProfileId "${sess.materialProfileId}".`
        );
      }
      if (!expIds.has(sess.referenceExperimentId)) {
        errors.push(
          `Relational Integrity Error: CalibrationSession "${sess.sessionCode}" references missing referenceExperimentId "${sess.referenceExperimentId}".`
        );
      }
    }

    for (const trial of calibrationTrials) {
      if (!sessIds.has(trial.calibrationSessionId)) {
        errors.push(
          `Relational Integrity Error: CalibrationTrial "${trial.id}" references missing calibrationSessionId "${trial.calibrationSessionId}".`
        );
      }
      if (!expIds.has(trial.experimentId)) {
        errors.push(
          `Relational Integrity Error: CalibrationTrial "${trial.id}" references missing experimentId "${trial.experimentId}".`
        );
      }
    }

    for (const prod of productionMetrics) {
      if (!expIds.has(prod.experimentId)) {
        errors.push(
          `Relational Integrity Error: ProductionMetricRecord "${prod.id}" references missing experimentId "${prod.experimentId}".`
        );
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const ppsMap = new Map(rawProcessParameterSets.map((p) => [p.id, p]));
    for (const exp of experiments) {
      ppsMap.set(exp.processParameters.id, exp.processParameters);
    }
    const processParameterSets = Array.from(ppsMap.values()).filter((p) =>
      expIds.has(p.experimentId)
    );

    const snapshot: ResearchWorkspaceSnapshot = {
      schemaVersion: SCHEMA_VERSION,
      appVersion: parsed.appVersion || APP_VERSION,
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      project: projParse.data,
      materialProfiles,
      hardwareProfiles,
      nodeDesigns,
      nodeFeatureDefinitions,
      experiments,
      specimens,
      processParameterSets,
      measurements,
      assemblyVerifications,
      processObservations,
      calibrationSessions,
      calibrationTrials,
      researchReferences,
      productionMetrics,
      fileMetadata,
      auditEvents,
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
        `Failed to parse JSON backup: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ],
    };
  }
}

export function exportNodeDesignsToCsv(
  nodeDesigns: Array<import('../domain/models').NodeDesign>,
  _features?: Array<import('../domain/models').NodeFeatureDefinition>
): string {
  const headers = [
    'id',
    'nodeDesignCode',
    'geometryVersion',
    'title',
    'geometrySource',
    'coordinateSystem',
    'unitSystem',
    'intendedMaterialType',
    'notes',
    'createdAt',
  ];
  const escapeCsv = (val: unknown) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = nodeDesigns.map((n) => [
    n.id,
    n.nodeDesignCode || n.designCode || n.nodeDesignId || '',
    n.geometryVersion,
    n.title || n.designName || '',
    n.geometrySource ?? '',
    n.coordinateSystem ?? '',
    n.unitSystem ?? '',
    n.intendedMaterialType ?? '',
    n.notes ?? '',
    n.createdAt,
  ]);
  return [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
}

export function exportSpecimensToCsv(
  specimens: Array<import('../domain/models').Specimen>
): string {
  const headers = [
    'id',
    'specimenCode',
    'experimentId',
    'nodeDesignId',
    'geometryVersion',
    'materialBatchIdentifier',
    'currentPhysicalStage',
    'specimenStatus',
    'fabricationTimestamp',
    'notes',
  ];
  const escapeCsv = (val: unknown) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = specimens.map((s) => [
    s.id,
    s.specimenCode,
    s.experimentId,
    s.nodeDesignId ?? '',
    s.geometryVersion ?? '',
    s.materialBatchIdentifier ?? '',
    s.currentPhysicalStage,
    s.acceptanceStatus || s.specimenStatus || s.status || '',
    s.fabricationTimestamp,
    s.notes || s.observations || '',
  ]);
  return [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
}

export function exportAssemblyVerificationsToCsv(
  verifications: Array<import('../domain/models').AssemblyVerification>
): string {
  const headers = [
    'id',
    'experimentId',
    'specimenId',
    'nodeDesignId',
    'geometryVersion',
    'physicalStageAtTest',
    'connectedMatingComponentId',
    'internalFeatureDiameterMm',
    'matingExternalDiameterMm',
    'measuredClearanceMm',
    'insertionDepthMm',
    'passFailStatus',
    'operatorNotes',
    'createdAt',
  ];
  const escapeCsv = (val: unknown) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = verifications.map((v) => [
    v.id,
    v.experimentId,
    v.specimenId,
    v.nodeDesignId,
    v.geometryVersion,
    v.physicalStageAtTest,
    v.connectedMatingComponentId || v.matingMemberType || '',
    v.internalFeatureDiameterMm ?? v.measuredSocketDiameterMm ?? '',
    v.matingExternalDiameterMm ?? v.matingMemberActualDiameterMm ?? '',
    v.measuredClearanceMm ?? '',
    v.insertionDepthMm ?? v.achievedInsertionDepthMm ?? '',
    v.passFailStatus || v.verificationResult || '',
    v.operatorNotes || v.notes || '',
    v.createdAt,
  ]);
  return [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
}
