import { z } from 'zod';

export const SCHEMA_VERSION = 1;
export const APP_VERSION = '0.1.0';

/**
 * Canonical 13 Domain Entities of Fabrication Research OS:
 * 1. Project
 * 2. MaterialProfile
 * 3. HardwareProfile
 * 4. Experiment
 * 5. ProcessParameterSet
 * 6. Measurement
 * 7. ProcessObservation
 * 8. CalibrationSession
 * 9. CalibrationTrial
 * 10. ResearchReference
 * 11. ProductionMetricRecord
 * 12. FileDatasetMetadata
 * 13. AuditEvent
 */
export const DOMAIN_ENTITY_NAMES = [
  'Project',
  'MaterialProfile',
  'HardwareProfile',
  'Experiment',
  'ProcessParameterSet',
  'Measurement',
  'ProcessObservation',
  'CalibrationSession',
  'CalibrationTrial',
  'ResearchReference',
  'ProductionMetricRecord',
  'FileDatasetMetadata',
  'AuditEvent',
] as const;

export type DomainEntityName = (typeof DOMAIN_ENTITY_NAMES)[number];

// ============================================================================
// 1. PROJECT
// ============================================================================
export const EvaluationCriterionSchema = z.object({
  id: z.string(),
  metricName: z.string().min(1, 'Metric name is required'),
  unit: z.string().min(1, 'Unit is required'),
  targetDirection: z.enum(['minimize', 'maximize', 'target_band']),
  baselineReference: z.string(),
  thresholdDescription: z.string(),
});

export type EvaluationCriterion = z.infer<typeof EvaluationCriterionSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  schemaVersion: z.number().default(SCHEMA_VERSION),
  name: z.string().min(1, 'Project name is required'),
  workingThesisTitle: z.string(),
  submittedAbstract: z.string(),
  researchQuestions: z.array(z.string()),
  hypotheses: z.array(z.string()),
  objectives: z.array(z.string()),
  evaluationCriteria: z.array(EvaluationCriterionSchema),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof ProjectSchema>;

// ============================================================================
// 2. MATERIAL PROFILE
// ============================================================================
export const MaterialTypeEnum = z.enum(['clay', 'ceramic', 'polymer', 'custom']);
export type MaterialType = z.infer<typeof MaterialTypeEnum>;

export const MeasuredMaterialPropertySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().min(1),
  measurementMethod: z.string().optional(),
});

export type MeasuredMaterialProperty = z.infer<typeof MeasuredMaterialPropertySchema>;

export const MaterialProfileSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  materialType: MaterialTypeEnum,
  materialName: z.string().min(1, 'Material name is required'),
  batchIdentifier: z.string().min(1, 'Batch identifier is required'),
  preparationNotes: z.string(),
  measuredMaterialProperties: z.array(MeasuredMaterialPropertySchema),
  propertyUnits: z.record(z.string(), z.string()),
  source: z.string().min(1, 'Material source is required'),
  isSampleFixture: z.boolean().default(false),
  createdAt: z.string(),
});

export type MaterialProfile = z.infer<typeof MaterialProfileSchema>;

// ============================================================================
// 3. HARDWARE PROFILE
// ============================================================================
export const EquipmentCategoryEnum = z.enum([
  'Industrial Robotic Cell',
  'Desktop 3D Printer / Testbed',
  'Hybrid / Custom Setup',
]);
export type EquipmentCategory = z.infer<typeof EquipmentCategoryEnum>;

export const EquipmentReadinessStatusEnum = z.enum([
  'Planned',
  'Available',
  'Configured',
  'Connected',
]);
export type EquipmentReadinessStatus = z.infer<typeof EquipmentReadinessStatusEnum>;

export const SensingHardwareItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  modality: z.enum([
    'Digital Caliper',
    'Calibrated RGB Camera',
    'RGB-D Depth Camera',
    'Laser Line / Optical Sensor',
    'Pressure / Load Cell',
    'Environmental Sensor',
    'Custom Sensor',
  ]),
  readinessStatus: EquipmentReadinessStatusEnum,
  resolutionOrSpec: z.string(),
});

export type SensingHardwareItem = z.infer<typeof SensingHardwareItemSchema>;

export const HardwareProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Hardware profile name is required'),
  category: EquipmentCategoryEnum,
  readinessStatus: EquipmentReadinessStatusEnum,
  robotType: z.string().min(1, 'Motion platform / robot type is required'),
  extruderType: z.string().min(1, 'Extruder type is required'),
  nozzleDiameterMm: z.number().positive('Nozzle diameter must be > 0 mm'),
  sensingHardware: z.array(SensingHardwareItemSchema),
  equipmentNotes: z.string(),
  configurationMetadata: z.record(z.string(), z.string()).optional(),
  isSampleFixture: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type HardwareProfile = z.infer<typeof HardwareProfileSchema>;

// ============================================================================
// 4. PROCESS PARAMETER SET
// ============================================================================
export const VolumetricFlowUnitEnum = z.enum(['mm³/s', 'mL/min', 'cm³/min', 'g/min']);
export type VolumetricFlowUnit = z.infer<typeof VolumetricFlowUnitEnum>;

export const ParameterSourceEnum = z.enum([
  'Pre-Fabrication Baseline',
  'Manual Operator Adjustment',
  'Feedforward Model Output',
  'Checkpoint Recalibration Update',
  'Calibration Trial Sweep',
]);
export type ParameterSource = z.infer<typeof ParameterSourceEnum>;

export const ProcessParameterSetSchema = z.object({
  id: z.string(),
  experimentId: z.string(),
  printSpeedMmPerSec: z.number().positive('Print speed must be > 0 mm/s'),
  relativeFlowPercent: z.number().min(0, 'Relative flow % must be >= 0'),
  volumetricFlowValue: z.number().nonnegative().nullable(),
  volumetricFlowUnit: VolumetricFlowUnitEnum,
  layerHeightMm: z.number().positive('Layer height must be > 0 mm'),
  targetBeadWidthMm: z.number().positive('Target bead width must be > 0 mm'),
  toolOrientation: z.string().min(1, 'Tool orientation is required (e.g. Planar Z-normal)'),
  nozzleDiameterMm: z.number().positive('Nozzle diameter must be > 0 mm'),
  materialSpecificParameters: z.record(
    z.string(),
    z.object({
      value: z.union([z.number(), z.string()]),
      unit: z.string(),
    })
  ),
  parameterSource: ParameterSourceEnum,
  isSampleFixture: z.boolean().default(false),
});

export type ProcessParameterSet = z.infer<typeof ProcessParameterSetSchema>;

// ============================================================================
// 5. EXPERIMENT
// ============================================================================
export const ExperimentStatusEnum = z.enum(['Planned', 'In Progress', 'Completed', 'Aborted']);
export type ExperimentStatus = z.infer<typeof ExperimentStatusEnum>;

export const MethodClassificationEnum = z.enum([
  'Fixed-Parameter Baseline',
  'Manual Recalibration Workflow',
  'Feedforward Planning',
  'Checkpoint Recalibration',
  'Hybrid Feedforward + Checkpoint',
]);
export type MethodClassification = z.infer<typeof MethodClassificationEnum>;

export const ExperimentTypeEnum = z.enum([
  'Single-Bead Characterization',
  'Multi-Layer Wall Stability',
  'Overhang / Tool Orientation Test',
  'Batch Disturbance & Recovery',
  'Checkpoint Recalibration Validation',
  'Production Benchmark Run',
]);
export type ExperimentType = z.infer<typeof ExperimentTypeEnum>;

export const TargetToleranceCriterionSchema = z.object({
  measurementType: z.enum([
    'bead width',
    'bead height',
    'XYZ residual',
    'surface deviation',
    'dimensional error',
    'custom measurement',
  ]),
  targetValue: z.number(),
  tolerancePlusMinus: z.number().positive(),
  unit: z.string().min(1),
});

export type TargetToleranceCriterion = z.infer<typeof TargetToleranceCriterionSchema>;

export const ExperimentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  experimentCode: z.string().min(1, 'Experiment code is required'),
  title: z.string().min(1, 'Title is required'),
  researchObjective: z.string().min(1, 'Research objective is required'),
  hypothesis: z.string().min(1, 'Hypothesis is required'),
  materialProfileId: z.string().min(1, 'Material profile is required'),
  experimentType: ExperimentTypeEnum,
  baselineOrProposedMethod: MethodClassificationEnum,
  referenceBaselineExperimentId: z.string().optional(),
  status: ExperimentStatusEnum,
  plannedDate: z.string(),
  actualDate: z.string().optional(),
  operator: z.string().min(1, 'Operator is required'),
  hardwareProfileId: z.string().min(1, 'Hardware profile is required'),
  processParameters: ProcessParameterSetSchema,
  targetGeometryReference: z.string().min(1, 'Target geometry reference is required'),
  evaluationCriteriaSnapshot: z.array(TargetToleranceCriterionSchema),
  primaryOutcomeSummary: z.string().optional(),
  notes: z.string(),
  isSampleFixture: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Experiment = z.infer<typeof ExperimentSchema>;

// ============================================================================
// 6. MEASUREMENT
// ============================================================================
export const MeasurementTypeEnum = z.enum([
  'bead width',
  'bead height',
  'XYZ residual',
  'surface deviation',
  'dimensional error',
  'custom measurement',
]);
export type MeasurementType = z.infer<typeof MeasurementTypeEnum>;

export const MeasurementSourceTypeEnum = z.enum([
  'Manual',
  'Imported',
  'Computed',
  'AI-Assisted Annotation',
]);
export type MeasurementSourceType = z.infer<typeof MeasurementSourceTypeEnum>;

export const ProfileGeometryTypeEnum = z.enum([
  'Scalar Point Measurement (Schematic Only)',
  'Imported Scanned Cross-Section Profile',
]);
export type ProfileGeometryType = z.infer<typeof ProfileGeometryTypeEnum>;

export const MeasurementSchema = z.object({
  id: z.string(),
  experimentId: z.string(),
  specimenId: z.string().min(1, 'Specimen ID is required'),
  layerIndex: z.number().int().nonnegative().optional(),
  xCoordMm: z.number().optional(),
  yCoordMm: z.number().optional(),
  zCoordMm: z.number().optional(),
  measurementType: MeasurementTypeEnum,
  customMeasurementLabel: z.string().optional(),
  measuredValue: z.number(),
  unit: z.string().min(1, 'Unit is required'),
  targetValue: z.number(),
  tolerance: z.number().positive('Tolerance must be > 0'),
  timestamp: z.string(),
  sourceType: MeasurementSourceTypeEnum,
  verifiedPhysicalMeasurement: z.boolean(),
  profileGeometryType: ProfileGeometryTypeEnum.default('Scalar Point Measurement (Schematic Only)'),
  scannedProfilePointsMm: z
    .array(z.object({ xMm: z.number(), zMm: z.number() }))
    .optional(),
  acquisitionMethod: z.string().min(1, 'Acquisition method is required'),
  algorithmVersion: z.string(),
  coordinateFrame: z.string().min(1, 'Coordinate frame is required'),
  uncertaintyMetadata: z.object({
    standardUncertainty: z.number().nonnegative(),
    confidenceLevelPercent: z.number().min(50).max(99.9),
    calibrationRef: z.string(),
  }),
  sourceFileId: z.string().optional(),
  notes: z.string().optional(),
  isSampleFixture: z.boolean().default(false),
});

export type Measurement = z.infer<typeof MeasurementSchema>;

// ============================================================================
// 7. PROCESS OBSERVATION
// ============================================================================
export const ObservationTypeEnum = z.enum([
  'extrusion_pressure',
  'print_speed',
  'relative_flow',
  'volumetric_flow',
  'nozzle_height_z',
  'bead_width_in_situ',
  'temperature',
  'ambient_humidity',
  'checkpoint_recalibration_event',
]);
export type ObservationType = z.infer<typeof ObservationTypeEnum>;

export const ProcessObservationSchema = z.object({
  id: z.string(),
  experimentId: z.string(),
  timestamp: z.string(),
  elapsedTime: z.number().nonnegative(), // seconds
  clockSyncStatus: z.enum(['Synchronized NTP/PTP', 'Manual Offset Aligned', 'Unsynchronized Local Clock']).default('Unsynchronized Local Clock'),
  clockOffsetMs: z.number().default(0),
  coordinateFrame: z.string().default('Robot Base Frame (WCS)'),
  layerIndex: z.number().int().nonnegative(),
  toolpathSegmentId: z.string().min(1),
  observationType: ObservationTypeEnum,
  numericValue: z.number(),
  unit: z.string().min(1),
  acquisitionSource: z.string().min(1),
  annotationNote: z.string().optional(),
  isSampleFixture: z.boolean().default(false),
});

export type ProcessObservation = z.infer<typeof ProcessObservationSchema>;

// ============================================================================
// 8. CALIBRATION SESSION & 9. CALIBRATION TRIAL
// ============================================================================
export const ParameterBoundsSchema = z.object({
  minPrintSpeedMmPerSec: z.number().positive(),
  maxPrintSpeedMmPerSec: z.number().positive(),
  minRelativeFlowPercent: z.number().positive(),
  maxRelativeFlowPercent: z.number().positive(),
  minLayerHeightMm: z.number().positive(),
  maxLayerHeightMm: z.number().positive(),
  maxPressureKpa: z.number().positive().optional(),
});

export type ParameterBounds = z.infer<typeof ParameterBoundsSchema>;

export const CalibrationSessionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sessionCode: z.string().min(1),
  title: z.string().min(1),
  materialProfileId: z.string(),
  referenceExperimentId: z.string(),
  objective: z.string().min(1),
  decisionMethod: z.enum([
    'Empirical Trial Comparison (No Extrapolation)',
    'Deterministic Bounds & Tolerance Check',
    'Rule-Based Checkpoint Proportional Correction (Experimental)',
    'Empirical Response Curve Interpolation (Requires >= 3 Validated Trials)',
  ]),
  parameterBounds: ParameterBoundsSchema,
  targetMetric: z.object({
    measurementType: MeasurementTypeEnum,
    targetValue: z.number(),
    tolerance: z.number().positive(),
    unit: z.string(),
  }),
  status: z.enum(['Active', 'Converged', 'Archived']),
  isSampleFixture: z.boolean().default(false),
  createdAt: z.string(),
});

export type CalibrationSession = z.infer<typeof CalibrationSessionSchema>;

export const CalibrationTrialSchema = z.object({
  id: z.string(),
  calibrationSessionId: z.string(),
  experimentId: z.string(),
  trialNumber: z.number().int().positive(),
  checkpointLayerIndex: z.number().int().nonnegative(),
  recordOrigin: z.enum(['Observed Experimental Trial', 'Theoretical / Unvalidated Candidate']).default('Observed Experimental Trial'),
  parameterSet: z.object({
    printSpeedMmPerSec: z.number().positive(),
    relativeFlowPercent: z.number().positive(),
    volumetricFlowValue: z.number().nullable(),
    volumetricFlowUnit: VolumetricFlowUnitEnum,
    layerHeightMm: z.number().positive(),
    nozzleZOffsetMm: z.number(),
  }),
  measuredOutcome: z.object({
    measuredBeadWidthMm: z.number().positive(),
    measuredBeadHeightMm: z.number().positive(),
    dimensionalResidualMm: z.number(),
    surfaceStabilityScore: z.string(),
  }),
  constraintStatus: z.enum([
    'Within Bounds & Converged',
    'Within Bounds — Adjustment Needed',
    'Boundary Violation — Clamped',
    'Instability / Tearing Observed',
  ]),
  rationale: z.string(),
  isSampleFixture: z.boolean().default(false),
  createdAt: z.string(),
});

export type CalibrationTrial = z.infer<typeof CalibrationTrialSchema>;

// ============================================================================
// 10. RESEARCH REFERENCE
// ============================================================================
export const MethodologicalCategoryEnum = z.enum([
  'Feedforward Process Planning',
  'Closed-Loop / Checkpoint Recalibration',
  'Material Rheology & Extrusion Physics',
  'In-Situ Vision & Optical Metrology',
  'Robotic Toolpath & Kinematics',
  'Industrial Additive Manufacturing Benchmarks',
]);
export type MethodologicalCategory = z.infer<typeof MethodologicalCategoryEnum>;

export const EvidenceLevelEnum = z.enum([
  'Peer-Reviewed Empirical Study',
  'Industrial Benchmark / Case Study',
  'Simulation / Theoretical Model',
  'Preprint / Working Technical Report',
  'Internal Lab Observation',
]);
export type EvidenceLevel = z.infer<typeof EvidenceLevelEnum>;

export const ResearchReferenceSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required'),
  authors: z.string().min(1, 'Authors are required'),
  year: z.number().int().min(1950).max(2035),
  DOI: z.string(),
  URL: z.string(),
  publicationVenue: z.string().min(1, 'Publication venue is required'),
  abstractOrNotes: z.string(),
  methodologicalCategory: MethodologicalCategoryEnum,
  evidenceLevel: EvidenceLevelEnum,
  researchGapRelevance: z.string().min(1, 'Research gap relevance is required'),
  relatedExperimentIds: z.array(z.string()),
  verificationStatus: z.enum(['DOI & Primary Source Verified', 'Metadata Verified', 'Unverified Draft']),
  isSampleFixture: z.boolean().default(false),
  createdAt: z.string(),
});

export type ResearchReference = z.infer<typeof ResearchReferenceSchema>;

// ============================================================================
// 11. PRODUCTION METRIC RECORD
// ============================================================================
export const ProductionMetricRecordSchema = z.object({
  id: z.string(),
  experimentId: z.string(),
  acceptedPartCount: z.number().int().nonnegative(),
  rejectedPartCount: z.number().int().nonnegative(),
  materialUsed: z.number().nonnegative(), // g
  materialWaste: z.number().nonnegative(), // g
  setupDuration: z.number().nonnegative(), // min
  printDuration: z.number().nonnegative(), // min
  calibrationDuration: z.number().nonnegative(), // min
  downtime: z.number().nonnegative(), // min
  energyUsed: z.number().nonnegative(), // kWh
  manuallyEnteredCostInputs: z.object({
    materialCostPerKgEur: z.number().nonnegative(),
    machineHourlyRateEur: z.number().nonnegative(),
    operatorHourlyRateEur: z.number().nonnegative(),
  }),
  metricUnits: z.object({
    massUnit: z.literal('g'),
    durationUnit: z.literal('min'),
    energyUnit: z.literal('kWh'),
    currencyUnit: z.literal('EUR'),
  }),
  provenance: z.enum(['Logged from Lab Run', 'Imported Production Log', 'Estimated Benchmark']),
  notes: z.string(),
  isSampleFixture: z.boolean().default(false),
  createdAt: z.string(),
});

export type ProductionMetricRecord = z.infer<typeof ProductionMetricRecordSchema>;

// ============================================================================
// 12. FILE AND DATASET METADATA
// ============================================================================
export const FileDatasetMetadataSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  experimentId: z.string().optional(),
  filename: z.string().min(1),
  fileType: z.enum(['CSV', 'JSON', 'GCode / Rapid', 'PointCloudRef', 'ImageRef']),
  fileSize: z.number().nonnegative(),
  checksum: z.string(),
  uploadDate: z.string(),
  datasetSchema: z.string(),
  sourceType: z.enum(['User Upload', 'Instrument Export', 'System Export', 'Sample Fixture']),
  fileAvailability: z.enum(['IndexedDB Cached', 'Metadata & Summary Only', 'External Archive']),
  storageReference: z.string(),
  recordCount: z.number().int().nonnegative(),
  isSampleFixture: z.boolean().default(false),
});

export type FileDatasetMetadata = z.infer<typeof FileDatasetMetadataSchema>;

// ============================================================================
// 13. AUDIT EVENT
// ============================================================================
export const AuditEntityTypeEnum = z.enum([
  'Project',
  'MaterialProfile',
  'HardwareProfile',
  'Experiment',
  'ProcessParameterSet',
  'Measurement',
  'ProcessObservation',
  'CalibrationSession',
  'CalibrationTrial',
  'ResearchReference',
  'ProductionMetricRecord',
  'FileDatasetMetadata',
  'AuditEvent',
  'System',
]);
export type AuditEntityType = z.infer<typeof AuditEntityTypeEnum>;

export const AuditEventSchema = z.object({
  id: z.string(),
  entityType: AuditEntityTypeEnum,
  entityId: z.string(),
  action: z.enum([
    'CREATE',
    'UPDATE',
    'DELETE',
    'IMPORT',
    'EXPORT',
    'SEED_SAMPLE',
    'REMOVE_SAMPLE',
    'RESTORE_BACKUP',
  ]),
  timestamp: z.string(),
  summary: z.string(),
  oldValueSnippet: z.string().optional(),
  newValueSnippet: z.string().optional(),
  actor: z.string(),
  source: z.string(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ============================================================================
// WORKSPACE SNAPSHOT (VERSIONED FOR BACKUP/RESTORE)
// ============================================================================
export interface ResearchWorkspaceSnapshot {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  project: Project;
  materialProfiles: MaterialProfile[];
  hardwareProfiles: HardwareProfile[];
  experiments: Experiment[];
  processParameterSets: ProcessParameterSet[];
  measurements: Measurement[];
  processObservations: ProcessObservation[];
  calibrationSessions: CalibrationSession[];
  calibrationTrials: CalibrationTrial[];
  researchReferences: ResearchReference[];
  productionMetrics: ProductionMetricRecord[];
  fileMetadata: FileDatasetMetadata[];
  auditEvents: AuditEvent[];
}
