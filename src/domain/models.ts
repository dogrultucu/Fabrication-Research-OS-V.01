import { z } from 'zod';

export const SCHEMA_VERSION = 2;
export const APP_VERSION = '0.1.1';

/**
 * Canonical 17 Domain Entities of Fabrication Research OS (Schema v2 — v0.1.1):
 * 1. Project
 * 2. MaterialProfile
 * 3. HardwareProfile
 * 4. NodeDesign
 * 5. NodeFeatureDefinition
 * 6. Experiment
 * 7. Specimen
 * 8. ProcessParameterSet
 * 9. Measurement
 * 10. AssemblyVerification
 * 11. ProcessObservation
 * 12. CalibrationSession
 * 13. CalibrationTrial
 * 14. ResearchReference
 * 15. ProductionMetricRecord
 * 16. FileDatasetMetadata
 * 17. AuditEvent
 */
export const DOMAIN_ENTITY_NAMES = [
  'Project',
  'MaterialProfile',
  'HardwareProfile',
  'NodeDesign',
  'NodeFeatureDefinition',
  'Experiment',
  'Specimen',
  'ProcessParameterSet',
  'Measurement',
  'AssemblyVerification',
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
// CERAMIC NODE & PHYSICAL STAGE ENUMS (v0.1.1)
// ============================================================================

export const PhysicalStageEnum = z.enum([
  'GREEN',
  'DRY',
  'FIRED',
  'Stage Unknown',
  'Custom',
]);
export type PhysicalStage = z.infer<typeof PhysicalStageEnum>;

export const ResearchWorkflowTypeEnum = z.enum([
  'General Extrusion Research',
  'Ceramic Node Fabrication',
  'Shrinkage & Firing Study',
  'Joint Tolerance Study',
]);
export type ResearchWorkflowType = z.infer<typeof ResearchWorkflowTypeEnum>;

export const NodeTypeEnum = z.enum([
  'branching node',
  'angular joint',
  'socket connector',
  'spatial frame node',
  'multi-member connector',
  'custom node',
]);
export type NodeType = z.infer<typeof NodeTypeEnum>;

export const NodeFeatureCategoryEnum = z.enum([
  'socket diameter',
  'inner diameter',
  'outer diameter',
  'wall thickness',
  'branch angle',
  'joint axis angle',
  'socket depth',
  'insertion depth',
  'member clearance',
  'datum face',
  'center point',
  'overall height',
  'overall width',
  'shrinkage gauge length',
  'custom feature',
]);
export type NodeFeatureCategory = z.infer<typeof NodeFeatureCategoryEnum>;

export const SpecimenLifecycleStatusEnum = z.enum([
  'Planned',
  'Fabricated (Green)',
  'Dried',
  'Fired',
  'Inspected',
  'Assembly Tested',
  'Rejected',
  'Archived',
]);
export type SpecimenLifecycleStatus = z.infer<typeof SpecimenLifecycleStatusEnum>;

export const SpecimenAcceptanceStatusEnum = z.enum([
  'Inspection Pending',
  'Insufficient Data',
  'Geometrically Accepted',
  'Geometrically Rejected',
  'Assembly Accepted',
  'Assembly Rejected',
]);
export type SpecimenAcceptanceStatus = z.infer<typeof SpecimenAcceptanceStatusEnum>;

export const AssemblyFitClassificationEnum = z.enum([
  'Clearance Fit',
  'Transition / Snug Fit',
  'Interference / No-Go',
  'Excessive Play',
  'Cracked on Insertion',
  'Untested',
]);
export type AssemblyFitClassification = z.infer<typeof AssemblyFitClassificationEnum>;

export const AssemblyVerificationResultEnum = z.enum([
  'PASS',
  'FAIL',
  'CONDITIONAL_REWORK',
  'PENDING',
]);
export type AssemblyVerificationResult = z.infer<typeof AssemblyVerificationResultEnum>;

// ============================================================================
// 1. PROJECT
// ============================================================================

export const EvaluationCriterionSchema = z.object({
  id: z.string().min(1),
  metricName: z.string().min(1),
  unit: z.string().min(1),
  targetDirection: z.enum(['minimize', 'maximize', 'target_band']),
  baselineReference: z.string().min(1),
  thresholdDescription: z.string().min(1),
});
export type EvaluationCriterion = z.infer<typeof EvaluationCriterionSchema>;

export const ProjectRevisionEntrySchema = z.object({
  version: z.string().min(1),
  date: z.string().min(1),
  summary: z.string().min(1),
});
export type ProjectRevisionEntry = z.infer<typeof ProjectRevisionEntrySchema>;

export const ProjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  name: z.string().min(1),
  workingThesisTitle: z.string().min(1),
  workingResearchQuestion: z
    .string()
    .default(
      'How can feedforward process planning, stage-aware dimensional metrology, and checkpoint recalibration improve geometric accuracy and dry-joint assembly fit of robotically extruded ceramic structural nodes across green, dry, and fired states?'
    ),
  submittedAbstract: z.string(),
  researchQuestions: z.array(z.string()),
  hypotheses: z.array(z.string()),
  objectives: z.array(z.string()),
  evaluationCriteria: z.array(EvaluationCriterionSchema),
  revisionHistory: z
    .array(ProjectRevisionEntrySchema)
    .default([
      {
        version: '0.1.0',
        date: '2026-10-01',
        summary: 'Initial Phase A foundation for Feedforward Planning & Checkpoint Recalibration.',
      },
      {
        version: '0.1.1',
        date: '2026-10-23',
        summary: 'Extended workflow to Ceramic Node Fabrication, Stage-Aware Metrology (GREEN/DRY/FIRED), and Physical Assembly Verification.',
      },
    ]),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ============================================================================
// 2. MATERIAL PROFILE
// ============================================================================

export const MaterialTypeEnum = z.enum([
  'clay',
  'polymer',
  'ceramic',
  'concrete',
  'custom',
]);
export type MaterialType = z.infer<typeof MaterialTypeEnum>;

export const MeasuredMaterialPropertySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  unit: z.string().min(1),
  measurementMethod: z.string().optional(),
});
export type MeasuredMaterialProperty = z.infer<typeof MeasuredMaterialPropertySchema>;

export const MaterialProfileSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  materialType: MaterialTypeEnum,
  materialName: z.string().min(1),
  batchIdentifier: z.string().min(1),
  preparationNotes: z.string(),
  measuredMaterialProperties: z.array(MeasuredMaterialPropertySchema),
  propertyUnits: z.record(z.string(), z.string()),
  source: z.string(),
  expectedGreenToDryShrinkagePercent: z.number().min(0).max(50).optional(),
  expectedDryToFiredShrinkagePercent: z.number().min(0).max(50).optional(),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string(),
});
export type MaterialProfile = z.infer<typeof MaterialProfileSchema>;

// ============================================================================
// 3. HARDWARE PROFILE
// ============================================================================

export const EquipmentCategoryEnum = z.enum([
  'Industrial Robotic Cell',
  'Desktop 3D Printer / Testbed',
  'Small-Scale Extrusion Rig',
  'Metrology & Inspection Rig',
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
  id: z.string().min(1),
  name: z.string().min(1),
  modality: z.enum([
    'Digital Caliper',
    'Calibrated RGB Camera',
    'RGB-D Depth Camera',
    'Laser Line / Optical Sensor',
    'Pressure / Load Sensor',
    'Custom / Other',
  ]),
  readinessStatus: EquipmentReadinessStatusEnum,
  resolutionOrSpec: z.string(),
});
export type SensingHardwareItem = z.infer<typeof SensingHardwareItemSchema>;

export const HardwareProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: EquipmentCategoryEnum,
  readinessStatus: EquipmentReadinessStatusEnum,
  robotType: z.string().min(1),
  extruderType: z.string().min(1),
  nozzleDiameterMm: z.number().positive(),
  sensingHardware: z.array(SensingHardwareItemSchema),
  equipmentNotes: z.string(),
  configurationMetadata: z.record(z.string(), z.string()).optional(),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type HardwareProfile = z.infer<typeof HardwareProfileSchema>;

// ============================================================================
// 4. NODE DESIGN (NEW IN v0.1.1)
// ============================================================================

export const NodeDesignSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  nodeDesignId: z.string().min(1), // e.g., 'NODE-A'
  geometryVersion: z.string().min(1), // e.g., 'V01'
  title: z.string().min(1),
  nodeType: NodeTypeEnum.default('branching node'),
  branchCount: z.number().int().min(1).default(3),
  nominalBranchAnglesDeg: z.array(z.number()).default([90, 135, 135]),
  nominalSocketDiametersMm: z.array(z.number().positive()).default([20, 20]),
  nominalWallThicknessMm: z.number().positive().default(6.0),
  nominalSocketDepthMm: z.number().positive().default(25.0),
  nominalOverallDimensionsMm: z
    .object({
      x: z.number().positive(),
      y: z.number().positive(),
      z: z.number().positive(),
    })
    .default({ x: 110, y: 110, z: 85 }),
  shrinkageCompensationFactorApplied: z.number().positive().default(1.064),
  targetFitStage: PhysicalStageEnum.default('DRY'),
  cadFileReference: z.string().default(''),
  toolpathArchiveReference: z.string().default(''),
  notes: z.string().default(''),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NodeDesign = z.infer<typeof NodeDesignSchema>;

// ============================================================================
// 5. NODE FEATURE DEFINITION (NEW IN v0.1.1)
// ============================================================================

export const NodeFeatureDefinitionSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  nodeDesignRecordId: z.string().min(1), // FK to NodeDesign.id
  nodeDesignId: z.string().min(1), // e.g., 'NODE-A'
  geometryVersion: z.string().min(1), // e.g., 'V01'
  featureId: z.string().min(1), // e.g., 'SOCK-A', 'SOCK-B', 'AXIS-AB', 'DATUM-Z0'
  featureName: z.string().min(1),
  featureCategory: NodeFeatureCategoryEnum,
  nominalValue: z.number(),
  unit: z.string().min(1),
  toleranceLower: z.number(), // e.g., -0.5
  toleranceUpper: z.number(), // e.g., +0.5
  targetPhysicalStage: PhysicalStageEnum.default('DRY'),
  criticalForAssembly: z.boolean().default(true),
  coordinateFrame: z.string().default('wobjPrintTable_01'),
  nominalCoordsMm: z
    .object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    })
    .optional(),
  measurementInstructions: z.string().default(''),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NodeFeatureDefinition = z.infer<typeof NodeFeatureDefinitionSchema>;

// ============================================================================
// 6. PROCESS PARAMETER SET & EXPERIMENT
// ============================================================================

export const VolumetricFlowUnitEnum = z.enum([
  'mm³/s',
  'mL/min',
  'g/s',
  'not_characterized',
]);
export type VolumetricFlowUnit = z.infer<typeof VolumetricFlowUnitEnum>;

export const ParameterSourceEnum = z.enum([
  'Pre-Fabrication Baseline',
  'Feedforward Schedule',
  'Checkpoint Recalibration Update',
  'Manual Operator Override',
]);
export type ParameterSource = z.infer<typeof ParameterSourceEnum>;

export const MaterialParameterValueSchema = z.object({
  value: z.union([z.number(), z.string()]),
  unit: z.string(),
});

export const ProcessParameterSetSchema = z.object({
  id: z.string().min(1),
  experimentId: z.string().min(1),
  printSpeedMmPerSec: z.number().positive(),
  relativeFlowPercent: z.number().positive(),
  volumetricFlowValue: z.number().nonnegative().nullable(),
  volumetricFlowUnit: VolumetricFlowUnitEnum,
  layerHeightMm: z.number().positive(),
  targetBeadWidthMm: z.number().positive(),
  toolOrientation: z.string().min(1),
  nozzleDiameterMm: z.number().positive(),
  materialSpecificParameters: z.record(z.string(), MaterialParameterValueSchema),
  parameterSource: ParameterSourceEnum,
  isSampleFixture: z.boolean().optional(),
});
export type ProcessParameterSet = z.infer<typeof ProcessParameterSetSchema>;

export const ExperimentTypeEnum = z.enum([
  'Single-Bead Characterization',
  'Multi-Layer Wall Stability',
  'Overhang / Non-Planar Validation',
  'Checkpoint Recalibration Validation',
  'Feedforward Schedule Evaluation',
  'Batch Disturbance Robustness',
  'Ceramic Node Fabrication',
  'Shrinkage & Firing Study',
  'Joint Tolerance Study',
]);
export type ExperimentType = z.infer<typeof ExperimentTypeEnum>;

export const MethodClassificationEnum = z.enum([
  'Fixed-Parameter Baseline',
  'Manual Recalibration',
  'Feedforward Planning',
  'Checkpoint Recalibration',
  'Combined Feedforward + Checkpoint',
]);
export type MethodClassification = z.infer<typeof MethodClassificationEnum>;

export const ExperimentStatusEnum = z.enum([
  'Draft',
  'Planned',
  'In Progress',
  'Completed',
  'Failed / Aborted',
  'Invalidated',
]);
export type ExperimentStatus = z.infer<typeof ExperimentStatusEnum>;

export const TargetToleranceCriterionSchema = z.object({
  measurementType: z.string().min(1),
  targetValue: z.number(),
  tolerancePlusMinus: z.number().positive(),
  unit: z.string().min(1),
});
export type TargetToleranceCriterion = z.infer<typeof TargetToleranceCriterionSchema>;

export const ExperimentSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  experimentCode: z.string().min(1),
  title: z.string().min(1),
  researchWorkflowType: ResearchWorkflowTypeEnum.default('General Extrusion Research'),
  experimentGroup: z.string().default('Series A — Baseline'),
  researchObjective: z.string().min(1),
  hypothesis: z.string().min(1),
  materialProfileId: z.string().min(1),
  experimentType: ExperimentTypeEnum,
  baselineOrProposedMethod: MethodClassificationEnum,
  referenceBaselineExperimentId: z.string().optional(),
  status: ExperimentStatusEnum,
  plannedDate: z.string().min(1),
  actualDate: z.string().optional(),
  operator: z.string().min(1),
  hardwareProfileId: z.string().min(1),
  processParameters: ProcessParameterSetSchema,
  nodeDesignRecordId: z.string().optional(),
  nodeDesignId: z.string().optional(),
  geometryVersion: z.string().optional(),
  materialBatchIdentifier: z.string().optional(),
  plannedSpecimenCount: z.number().int().min(1).default(1),
  measurementProtocol: z
    .string()
    .default('Standard Digital Caliper & Optical Checkpoint Protocol'),
  targetGeometryReference: z.string(),
  evaluationCriteriaSnapshot: z.array(TargetToleranceCriterionSchema),
  primaryOutcomeSummary: z.string().optional(),
  notes: z.string(),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Experiment = z.infer<typeof ExperimentSchema>;

// ============================================================================
// 7. SPECIMEN (NEW IN v0.1.1)
// ============================================================================

export const SpecimenSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  experimentId: z.string().min(1),
  specimenCode: z.string().min(1), // e.g., 'EXP-004 / NODE-A-V01 / S01'
  specimenLabel: z.string().min(1), // e.g., 'S01'
  nodeDesignRecordId: z.string().optional(),
  nodeDesignId: z.string().default(''),
  geometryVersion: z.string().default(''),
  materialBatchIdentifier: z.string().default(''),
  currentPhysicalStage: PhysicalStageEnum.default('GREEN'),
  status: SpecimenLifecycleStatusEnum.default('Fabricated (Green)'),
  fabricationTimestamp: z.string(),
  dryingStartedAt: z.string().optional(),
  dryingCompletedAt: z.string().optional(),
  firingCompletedAt: z.string().optional(),
  ambientTempC: z.number().optional(),
  ambientHumidityPercent: z.number().optional(),
  greenMassG: z.number().positive().optional(),
  dryMassG: z.number().positive().optional(),
  firedMassG: z.number().positive().optional(),
  observations: z.string().default(''),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Specimen = z.infer<typeof SpecimenSchema>;

// ============================================================================
// 9. MEASUREMENT
// ============================================================================

export const MeasurementTypeEnum = z.enum([
  'bead width',
  'bead height',
  'layer height',
  'wall thickness',
  'overhang angle',
  'XYZ residual',
  'cross-section area',
  'socket diameter',
  'inner diameter',
  'outer diameter',
  'branch angle',
  'joint axis angle',
  'socket depth',
  'insertion depth',
  'member clearance',
  'datum face',
  'center point',
  'overall height',
  'overall width',
  'shrinkage linear',
  'shrinkage gauge length',
  'custom measurement',
]);
export type MeasurementType = z.infer<typeof MeasurementTypeEnum>;

export const MeasurementSourceTypeEnum = z.enum([
  'Manual',
  'Imported',
  'Computed',
  'Simulated',
  'AI-Assisted Annotation',
]);
export type MeasurementSourceType = z.infer<typeof MeasurementSourceTypeEnum>;

export const ProfileGeometryTypeEnum = z.enum([
  'Scalar Point Measurement (Schematic Only)',
  '2D Scanned Cross-Section Profile',
]);
export type ProfileGeometryType = z.infer<typeof ProfileGeometryTypeEnum>;

export const MeasurementSchema = z.object({
  id: z.string().min(1),
  experimentId: z.string().min(1),
  specimenRecordId: z.string().optional(),
  specimenId: z.string().min(1),
  nodeDesignId: z.string().optional(),
  geometryVersion: z.string().optional(),
  featureId: z.string().optional(),
  physicalStage: PhysicalStageEnum.default('Stage Unknown'),
  targetStage: PhysicalStageEnum.default('Stage Unknown'),
  layerIndex: z.number().int().nonnegative().optional(),
  xCoordMm: z.number().optional(),
  yCoordMm: z.number().optional(),
  zCoordMm: z.number().optional(),
  nominalXCoordMm: z.number().optional(),
  nominalYCoordMm: z.number().optional(),
  nominalZCoordMm: z.number().optional(),
  measurementType: MeasurementTypeEnum,
  customMeasurementLabel: z.string().optional(),
  measuredValue: z.number(),
  unit: z.string().min(1),
  targetValue: z.number(),
  tolerance: z.number().positive(),
  toleranceLower: z.number().optional(), // Asymmetric lower bound relative to targetValue (e.g., -0.5)
  toleranceUpper: z.number().optional(), // Asymmetric upper bound relative to targetValue (e.g., +0.8)
  timestamp: z.string().min(1),
  sourceType: MeasurementSourceTypeEnum,
  verifiedPhysicalMeasurement: z.boolean(),
  profileGeometryType: ProfileGeometryTypeEnum,
  scannedProfilePointsMm: z
    .array(z.object({ xMm: z.number(), zMm: z.number() }))
    .optional(),
  acquisitionMethod: z.string().min(1),
  algorithmVersion: z.string().min(1),
  coordinateFrame: z.string().min(1),
  uncertaintyMetadata: z.object({
    standardUncertainty: z.number().nonnegative(),
    confidenceLevelPercent: z.number().min(50).max(99.9),
    calibrationRef: z.string().min(1),
  }),
  sourceFileId: z.string().optional(),
  notes: z.string().optional(),
  isSampleFixture: z.boolean().optional(),
});
export type Measurement = z.infer<typeof MeasurementSchema>;

// ============================================================================
// 10. ASSEMBLY VERIFICATION (NEW IN v0.1.1)
// ============================================================================

export const AssemblyVerificationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  experimentId: z.string().min(1),
  specimenRecordId: z.string().optional(),
  specimenId: z.string().min(1), // e.g., 'EXP-004 / NODE-A-V01 / S01'
  nodeDesignId: z.string().min(1),
  geometryVersion: z.string().min(1),
  physicalStageAtTest: PhysicalStageEnum.default('DRY'),
  matingMemberType: z.string().default('Timber dowel Ø18.5 mm'),
  matingMemberNominalDiameterMm: z.number().positive().optional(),
  matingMemberActualDiameterMm: z.number().positive().optional(),
  targetSocketFeatureId: z.string().default('SOCK-A'),
  measuredSocketDiameterMm: z.number().positive().optional(),
  achievedInsertionDepthMm: z.number().nonnegative().optional(),
  targetInsertionDepthMm: z.number().positive().optional(),
  measuredAngularDeviationDeg: z.number().nonnegative().optional(),
  angularToleranceDeg: z.number().positive().optional(),
  fitClassification: AssemblyFitClassificationEnum.default('Transition / Snug Fit'),
  verificationResult: AssemblyVerificationResultEnum.default('PASS'),
  testedBy: z.string().default('O. B. Dogrultucu'),
  testedAt: z.string(),
  notes: z.string().default(''),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AssemblyVerification = z.infer<typeof AssemblyVerificationSchema>;

// ============================================================================
// 11. PROCESS OBSERVATION
// ============================================================================

export const ObservationTypeEnum = z.enum([
  'print_speed',
  'relative_flow',
  'volumetric_flow',
  'extrusion_pressure',
  'nozzle_temperature',
  'ambient_humidity',
  'z_standoff_offset',
  'checkpoint_recalibration_event',
  'slumping_observation',
  'cracking_observation',
  'socket_ovalization_observation',
]);
export type ObservationType = z.infer<typeof ObservationTypeEnum>;

export const ProcessObservationSchema = z.object({
  id: z.string().min(1),
  experimentId: z.string().min(1),
  specimenId: z.string().optional(),
  fabricationRunId: z.string().optional(),
  timestamp: z.string().min(1),
  elapsedTime: z.number().nonnegative(),
  clockSyncStatus: z.enum([
    'Synchronized NTP/PTP',
    'Manual Offset Aligned',
    'Unsynchronized Local Clock',
    'Unknown Synchronization',
  ]),
  clockOffsetMs: z.number(),
  coordinateFrame: z.string().min(1),
  layerIndex: z.number().int().nonnegative(),
  toolpathSegmentId: z.string().min(1),
  eventCategory: z
    .enum([
      'Process Telemetry',
      'Checkpoint Intervention',
      'Material Disturbance',
      'Geometric Anomaly',
      'Drying / Firing Observation',
    ])
    .optional(),
  observationType: ObservationTypeEnum,
  numericValue: z.number(),
  unit: z.string().min(1),
  acquisitionSource: z.string().min(1),
  annotationNote: z.string().optional(),
  isSampleFixture: z.boolean().optional(),
});
export type ProcessObservation = z.infer<typeof ProcessObservationSchema>;

// ============================================================================
// 12 & 13. CALIBRATION SESSION & TRIAL
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
  id: z.string().min(1),
  projectId: z.string().min(1),
  sessionCode: z.string().min(1),
  title: z.string().min(1),
  materialProfileId: z.string().min(1),
  referenceExperimentId: z.string().min(1),
  objective: z.string().min(1),
  decisionMethod: z.enum([
    'Deterministic Bounds & Kinematic Check',
    'Empirical Response Curve Interpolation (Requires >= 3 Validated Trials)',
    'Manual Operator Checkpoint Protocol',
  ]),
  parameterBounds: ParameterBoundsSchema,
  targetMetric: z.object({
    measurementType: z.string().min(1),
    targetValue: z.number(),
    tolerance: z.number().positive(),
    unit: z.string().min(1),
  }),
  status: z.enum(['Active', 'Converged', 'Inconclusive', 'Archived']),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string(),
});
export type CalibrationSession = z.infer<typeof CalibrationSessionSchema>;

export const CalibrationTrialSchema = z.object({
  id: z.string().min(1),
  calibrationSessionId: z.string().min(1),
  experimentId: z.string().min(1),
  specimenIds: z.array(z.string()).optional(),
  physicalMeasurementStage: PhysicalStageEnum.optional(),
  geometricAcceptanceResult: z
    .enum([
      'Accepted Within Tolerance',
      'Rejected — Out of Bounds',
      'Requires Shrinkage Compensation Update',
      'Pending Physical Verification',
    ])
    .optional(),
  trialNumber: z.number().int().positive(),
  checkpointLayerIndex: z.number().int().nonnegative(),
  recordOrigin: z.enum([
    'Observed Experimental Trial',
    'Unvalidated Empirical Interpolation Candidate',
  ]),
  parameterSet: z.object({
    printSpeedMmPerSec: z.number().positive(),
    relativeFlowPercent: z.number().positive(),
    volumetricFlowValue: z.number().nonnegative().nullable(),
    volumetricFlowUnit: VolumetricFlowUnitEnum,
    layerHeightMm: z.number().positive(),
    nozzleZOffsetMm: z.number(),
  }),
  measuredOutcome: z.object({
    measuredBeadWidthMm: z.number(),
    measuredBeadHeightMm: z.number(),
    dimensionalResidualMm: z.number(),
    surfaceStabilityScore: z.string(),
  }),
  constraintStatus: z.enum([
    'Within Bounds & Converged',
    'Within Bounds — Adjustment Needed',
    'Clamped by Safety Bounds',
    'Out of Bounds',
  ]),
  rationale: z.string().min(1),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string(),
});
export type CalibrationTrial = z.infer<typeof CalibrationTrialSchema>;

// ============================================================================
// 14. RESEARCH REFERENCE
// ============================================================================

export const MethodologicalCategoryEnum = z.enum([
  'Feedforward Process Planning',
  'Closed-Loop / Checkpoint Recalibration',
  'Material Rheology & Extrusion Physics',
  'Optical & Geometric Metrology',
  'Robotic Toolpath & Non-Planar Slicing',
  'Industrial Additive Construction',
  'Ceramic Shrinkage & Drying/Firing',
  'Architectural Node & Joint Tolerances',
]);
export type MethodologicalCategory = z.infer<typeof MethodologicalCategoryEnum>;

export const EvidenceLevelEnum = z.enum([
  'Peer-Reviewed Empirical Study',
  'Analytical / Physics Model',
  'Conference Case Study',
  'Technical Standard / Datasheet',
  'Internal MRAC Lab Note',
]);
export type EvidenceLevel = z.infer<typeof EvidenceLevelEnum>;

export const ResearchReferenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  authors: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  DOI: z.string(),
  URL: z.string(),
  publicationVenue: z.string(),
  abstractOrNotes: z.string(),
  methodologicalCategory: MethodologicalCategoryEnum,
  evidenceLevel: EvidenceLevelEnum,
  researchGapRelevance: z.string(),
  relatedExperimentIds: z.array(z.string()),
  linkedModuleTopics: z.array(z.string()).optional(),
  verificationStatus: z.enum([
    'DOI & Primary Source Verified',
    'Metadata Verified',
    'Unverified Draft',
  ]),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string(),
});
export type ResearchReference = z.infer<typeof ResearchReferenceSchema>;

// ============================================================================
// 15. PRODUCTION METRIC RECORD
// ============================================================================

export const ProductionMetricRecordSchema = z.object({
  id: z.string().min(1),
  experimentId: z.string().min(1),
  acceptedPartCount: z.number().int().nonnegative(),
  rejectedPartCount: z.number().int().nonnegative(),
  greenAcceptedCount: z.number().int().nonnegative().optional(),
  dryAcceptedCount: z.number().int().nonnegative().optional(),
  firedAcceptedCount: z.number().int().nonnegative().optional(),
  assemblyAcceptedCount: z.number().int().nonnegative().optional(),
  reworkCount: z.number().int().nonnegative().optional(),
  materialUsed: z.number().nonnegative(),
  materialWaste: z.number().nonnegative(),
  setupDuration: z.number().nonnegative(),
  printDuration: z.number().nonnegative(),
  calibrationDuration: z.number().nonnegative(),
  dryingAndFiringDuration: z.number().nonnegative().optional(),
  downtime: z.number().nonnegative(),
  energyUsed: z.number().nonnegative(),
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
  provenance: z.enum(['Logged from Lab Run', 'Estimated / Projected']),
  notes: z.string(),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string(),
});
export type ProductionMetricRecord = z.infer<typeof ProductionMetricRecordSchema>;

// ============================================================================
// 16. FILE DATASET METADATA
// ============================================================================

export const FileDatasetMetadataSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  experimentId: z.string().optional(),
  filename: z.string().min(1),
  fileType: z.enum(['CSV', 'JSON', 'RAPID', 'GCODE', 'OTHER']),
  fileSize: z.number().int().nonnegative(),
  checksum: z.string().min(1),
  uploadDate: z.string().min(1),
  datasetSchema: z.string().min(1),
  sourceType: z.enum(['User Upload', 'System Export', 'Sample Fixture']),
  fileAvailability: z.enum(['IndexedDB Cached', 'External Reference']),
  storageReference: z.string().min(1),
  recordCount: z.number().int().nonnegative(),
  isSampleFixture: z.boolean().optional(),
});
export type FileDatasetMetadata = z.infer<typeof FileDatasetMetadataSchema>;

// ============================================================================
// 17. AUDIT EVENT
// ============================================================================

export type AuditEntityType = DomainEntityName | 'System';

export const AuditEventSchema = z.object({
  id: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  action: z.enum([
    'CREATE',
    'UPDATE',
    'DELETE',
    'IMPORT',
    'EXPORT',
    'SEED_SAMPLE',
    'REMOVE_SAMPLE',
    'RESTORE_BACKUP',
    'SCHEMA_MIGRATION',
  ]),
  timestamp: z.string().min(1),
  summary: z.string().min(1),
  actor: z.string().min(1),
  source: z.string().min(1),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ============================================================================
// WORKSPACE SNAPSHOT (VERSIONED BACKUP & RESTORE)
// ============================================================================

export interface ResearchWorkspaceSnapshot {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  project: Project;
  materialProfiles: MaterialProfile[];
  hardwareProfiles: HardwareProfile[];
  nodeDesigns: NodeDesign[];
  nodeFeatureDefinitions: NodeFeatureDefinition[];
  experiments: Experiment[];
  specimens: Specimen[];
  processParameterSets: ProcessParameterSet[];
  measurements: Measurement[];
  assemblyVerifications: AssemblyVerification[];
  processObservations: ProcessObservation[];
  calibrationSessions: CalibrationSession[];
  calibrationTrials: CalibrationTrial[];
  researchReferences: ResearchReference[];
  productionMetrics: ProductionMetricRecord[];
  fileMetadata: FileDatasetMetadata[];
  auditEvents: AuditEvent[];
}
