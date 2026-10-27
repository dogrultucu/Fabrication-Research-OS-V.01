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
  'AS_PRINTED_POLYMER',
  'Stage Unknown',
  'Custom',
]);
export type PhysicalStage = z.infer<typeof PhysicalStageEnum>;

export const ResearchWorkflowTypeEnum = z.enum([
  'General Extrusion Research',
  'General Extrusion Experiment',
  'Calibration Experiment',
  'Ceramic Node Fabrication',
  'Shrinkage & Firing Study',
  'Shrinkage Study',
  'Joint Tolerance Study',
  'Joint / Socket Fit Study',
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
  'Assembled',
  'Rejected',
  'Archived',
]);
export type SpecimenLifecycleStatus = z.infer<typeof SpecimenLifecycleStatusEnum>;

export const SpecimenAcceptanceStatusEnum = z.enum([
  'Not Tested',
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
  'Not Tested',
]);
export type AssemblyFitClassification = z.infer<typeof AssemblyFitClassificationEnum>;

export const AssemblyVerificationResultEnum = z.enum([
  'PASS',
  'FAIL',
  'CONDITIONAL',
  'CONDITIONAL_REWORK',
  'PENDING',
  'NOT_TESTED',
]);
export type AssemblyVerificationResult = z.infer<typeof AssemblyVerificationResultEnum>;

export const ShrinkageCompensationStatusEnum = z.enum([
  'Not Applied',
  'Hypothesis / Unverified',
  'Empirically Verified',
]);
export type ShrinkageCompensationStatus = z.infer<typeof ShrinkageCompensationStatusEnum>;

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
  revisionId: z.string().optional(),
  version: z.string().optional(),
  date: z.string().optional(),
  timestamp: z.string().default(() => new Date().toISOString()),
  summary: z.string().min(1),
  rationale: z.string().optional(),
  actor: z.string().optional(),
});
export type ProjectRevisionEntry = z.infer<typeof ProjectRevisionEntrySchema>;

export const ProjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  name: z.string().min(1),
  workingThesisTitle: z.string().min(1),
  workingResearchQuestion: z.string().optional(),
  submittedAbstract: z.string(),
  researchQuestions: z.array(z.string()),
  hypotheses: z.array(z.string()),
  objectives: z.array(z.string()),
  evaluationCriteria: z.array(EvaluationCriterionSchema),
  revisionHistory: z.array(ProjectRevisionEntrySchema).optional(),
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
  expectedGreenToDryShrinkagePercent: z.number().min(0).max(50).nullable().optional(),
  expectedDryToFiredShrinkagePercent: z.number().min(0).max(50).nullable().optional(),
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
  nodeDesignCode: z.string().min(1),
  designCode: z.string().optional(),
  nodeDesignId: z.string().optional(),
  geometryVersion: z.string().min(1),
  title: z.string().min(1),
  designName: z.string().optional(),
  nodeType: NodeTypeEnum.optional(),
  geometryDescription: z.string().optional(),
  geometrySource: z.string().optional(),
  nominalGeometryFileReference: z.string().optional(),
  coordinateSystem: z.string().min(1),
  unitSystem: z.string().min(1),
  intendedMaterialType: z.string().optional(),
  branchCount: z.number().int().min(1).nullable().optional(),
  nominalBranchAnglesDeg: z.array(z.number()).optional(),
  nominalSocketDiametersMm: z.array(z.number().positive()).optional(),
  nominalWallThicknessMm: z.number().positive().nullable().optional(),
  nominalSocketDepthMm: z.number().positive().nullable().optional(),
  nominalOverallDimensionsMm: z
    .object({
      x: z.number().positive(),
      y: z.number().positive(),
      z: z.number().positive(),
    })
    .nullable()
    .optional(),
  shrinkageCompensationStatus: ShrinkageCompensationStatusEnum.optional(),
  shrinkageCompensationFactorApplied: z.number().positive().nullable().optional(),
  targetFitStage: PhysicalStageEnum.optional(),
  cadFileReference: z.string().optional(),
  toolpathArchiveReference: z.string().optional(),
  notes: z.string(),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type NodeDesign = z.infer<typeof NodeDesignSchema>;

// ============================================================================
// 5. NODE FEATURE DEFINITION (NEW IN v0.1.1)
// ============================================================================

export const NodeFeatureStageTargetSchema = z.object({
  stage: PhysicalStageEnum,
  targetValue: z.number(),
  tolerancePlusMinus: z.number().positive().optional(),
  toleranceLower: z.number().optional(),
  toleranceUpper: z.number().optional(),
  lowerTolerance: z.number().optional(),
  upperTolerance: z.number().optional(),
  rationale: z.string().optional(),
});

export const NodeFeatureDefinitionSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1).optional(),
  nodeDesignRecordId: z.string().optional(),
  nodeDesignId: z.string().min(1),
  geometryVersion: z.string().min(1),
  featureCode: z.string().min(1),
  featureId: z.string().min(1).optional(),
  featureName: z.string().min(1),
  featureType: z.string().min(1).optional(),
  featureCategory: NodeFeatureCategoryEnum.optional(),
  coordinateFrame: z.string().min(1),
  nominalPosition: z
    .object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    })
    .optional(),
  nominalOrientation: z
    .object({
      dx: z.number(),
      dy: z.number(),
      dz: z.number(),
      azimuthDeg: z.number().optional(),
      elevationDeg: z.number().optional(),
    })
    .optional(),
  nominalDimensions: z
    .object({
      primaryDimensionName: z.string().min(1),
      primaryDimensionValue: z.number(),
      secondaryDimensionName: z.string().optional(),
      secondaryDimensionValue: z.number().optional(),
      unit: z.string().min(1),
    })
    .optional(),
  stageTargets: z.array(NodeFeatureStageTargetSchema).optional(),
  targetEvaluatedStage: PhysicalStageEnum.optional(),
  geometricToleranceDefinition: z
    .object({
      symmetry: z.enum(['symmetric', 'asymmetric']),
      tolerancePlusMinus: z.number().positive().optional(),
      lowerDeviation: z.number().optional(),
      upperDeviation: z.number().optional(),
      lowerTolerance: z.number().optional(),
      upperTolerance: z.number().optional(),
      unit: z.string().min(1),
    })
    .optional(),
  nominalValue: z.number().optional(),
  unit: z.string().min(1).optional(),
  toleranceLower: z.number().optional(),
  toleranceUpper: z.number().optional(),
  lowerTolerance: z.number().optional(),
  upperTolerance: z.number().optional(),
  targetPhysicalStage: PhysicalStageEnum.optional(),
  criticalForAssembly: z.boolean().optional(),
  assemblyCritical: z.boolean(),
  measurementMethod: z.string().min(1),
  measurementInstructions: z.string().optional(),
  notes: z.string().optional(),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string().min(1).optional(),
  updatedAt: z.string().min(1).optional(),
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
  'Ceramic Node Geometric Qualification',
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
  'Hybrid Feedforward + Checkpoint',
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
  featureCode: z.string().optional(),
  physicalStage: PhysicalStageEnum.optional(),
});
export type TargetToleranceCriterion = z.infer<typeof TargetToleranceCriterionSchema>;

export const ExperimentSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  experimentCode: z.string().min(1),
  title: z.string().min(1),
  researchWorkflowType: ResearchWorkflowTypeEnum.optional(),
  experimentGroup: z.string().optional(),
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
  plannedSpecimenCount: z.number().int().min(1).optional(),
  measurementProtocol: z.string().optional(),
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
  projectId: z.string().min(1).optional(),
  experimentId: z.string().min(1),
  specimenCode: z.string().min(1), // e.g., 'EXP-004 / NODE-A-V01 / S01'
  specimenLabel: z.string().optional(),
  nodeDesignRecordId: z.string().optional(),
  nodeDesignId: z.string().optional(),
  geometryVersion: z.string().optional(),
  materialProfileId: z.string().min(1),
  materialBatchIdentifier: z.string().min(1),
  hardwareProfileId: z.string().min(1),
  fabricationRunIdentifier: z.string().min(1),
  fabricationTimestamp: z.string().min(1),
  processParameterSetId: z.string().min(1),
  currentPhysicalStage: PhysicalStageEnum,
  status: SpecimenLifecycleStatusEnum,
  currentStatus: SpecimenLifecycleStatusEnum.optional(),
  acceptanceStatus: SpecimenAcceptanceStatusEnum,
  specimenStatus: SpecimenAcceptanceStatusEnum.optional(),
  requiresAssemblyVerification: z.boolean(),
  dryingStartedAt: z.string().optional(),
  dryingCompletedAt: z.string().optional(),
  firingCompletedAt: z.string().optional(),
  ambientTempC: z.number().optional(),
  ambientHumidityPercent: z.number().optional(),
  greenMassG: z.number().positive().optional(),
  dryMassG: z.number().positive().optional(),
  firedMassG: z.number().positive().optional(),
  observations: z.string().optional(),
  notes: z.string().optional(),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
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
  'Imported Scanned Cross-Section Profile',
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
  physicalStage: PhysicalStageEnum.optional(),
  targetStage: PhysicalStageEnum.optional(),
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
  toleranceLower: z.number().optional(),
  toleranceUpper: z.number().optional(),
  lowerTolerance: z.number().optional(),
  upperTolerance: z.number().optional(),
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
  projectId: z.string().min(1).optional(),
  experimentId: z.string().min(1),
  specimenRecordId: z.string().min(1).optional(),
  specimenId: z.string().min(1),
  specimenCode: z.string().optional(),
  nodeDesignId: z.string().min(1),
  geometryVersion: z.string().min(1),
  featureId: z.string().optional(),
  targetSocketFeatureId: z.string().optional(),
  connectedMatingComponentId: z.string().optional(),
  matingComponentId: z.string().optional(),
  matingMemberType: z.string().optional(),
  matingComponentType: z.string().optional(),
  relevantFeatureIds: z.array(z.string()).optional(),
  physicalStageAtTest: PhysicalStageEnum,
  evaluatedStage: PhysicalStageEnum.optional(),
  assemblyTestDate: z.string().optional(),
  verifiedAt: z.string().optional(),
  testedAt: z.string().optional(),
  verificationTimestamp: z.string().optional(),
  assemblyMethod: z.string().optional(),
  internalFeatureDiameterMm: z.number().positive().nullable().optional(),
  measuredSocketDiameterMm: z.number().positive().nullable().optional(),
  matingExternalDiameterMm: z.number().positive().nullable().optional(),
  matingMemberNominalDiameterMm: z.number().positive().nullable().optional(),
  matingMemberActualDiameterMm: z.number().positive().nullable().optional(),
  measuredClearanceMm: z.number().nullable().optional(),
  insertionDepthMm: z.number().nonnegative().nullable().optional(),
  measuredInsertionDepthMm: z.number().nonnegative().nullable().optional(),
  achievedInsertionDepthMm: z.number().nonnegative().nullable().optional(),
  targetInsertionDepthMm: z.number().positive().nullable().optional(),
  measuredAngularDeviationDeg: z.number().nonnegative().nullable().optional(),
  measuredAngularAlignmentErrorDeg: z.number().nonnegative().nullable().optional(),
  angularToleranceDeg: z.number().positive().nullable().optional(),
  alignmentResult: z.string().optional(),
  physicalFitResult: z.string().optional(),
  insertionResult: z.string().optional(),
  fitClassification: AssemblyFitClassificationEnum,
  passFailStatus: z.enum(['PASS', 'FAIL', 'CONDITIONAL', 'PENDING', 'NOT_TESTED']),
  verificationResult: AssemblyVerificationResultEnum,
  reworkRequired: z.boolean(),
  operatorNotes: z.string().optional(),
  notes: z.string().optional(),
  testedBy: z.string().optional(),
  evidenceFiles: z.array(z.string()).optional(),
  isSampleFixture: z.boolean().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().optional(),
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
  materialBatchIdentifier: z.string().optional(),
  parameterSetId: z.string().optional(),
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
      'Fabrication Start',
      'Checkpoint Inspection',
      'Parameter Adjustment',
      'Continuous Telemetry',
      'Process Telemetry',
      'Checkpoint Intervention',
      'Material Disturbance',
      'Geometric Anomaly',
      'Drying / Firing Observation',
      'General',
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
  nodeDesignId: z.string().optional(),
  geometryVersion: z.string().optional(),
  objective: z.string().min(1),
  decisionMethod: z.enum([
    'Deterministic Bounds & Kinematic Check',
    'Deterministic Bounds & Tolerance Check',
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
  materialBatchIdentifier: z.string().optional(),
  physicalMeasurementStage: PhysicalStageEnum.optional(),
  geometricAcceptanceResult: z
    .enum([
      'Pass',
      'Fail',
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
    'Theoretical / Unvalidated Candidate',
    'Unvalidated Empirical Interpolation Candidate',
  ]),
  changedParametersSummary: z.string().optional(),
  fixedParametersSummary: z.string().optional(),
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
    measuredSocketErrorMm: z.number().optional(),
    surfaceStabilityScore: z.string(),
  }),
  constraintStatus: z.enum([
    'Within Bounds & Converged',
    'Within Bounds — Adjustment Needed',
    'Boundary Violation — Clamped',
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
  linkedTopicAreas: z.array(z.string()).optional(),
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
  calibrationTrialCount: z.number().int().nonnegative().optional(),
  materialUsed: z.number().nonnegative(),
  materialWaste: z.number().nonnegative(),
  setupDuration: z.number().nonnegative(),
  printDuration: z.number().nonnegative(),
  calibrationDuration: z.number().nonnegative(),
  dryingAndFiringDuration: z.number().nonnegative().optional(),
  dryingAndFiringDurationMin: z.number().nonnegative().optional(),
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
  sourceType: z.enum(['User Upload', 'System Export', 'Sample Fixture', 'Instrument Export']),
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
    'MIGRATE',
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

export const DOMAIN_ENTITY_SCHEMA_MAP: Record<DomainEntityName, z.ZodTypeAny> = {
  Project: ProjectSchema,
  MaterialProfile: MaterialProfileSchema,
  HardwareProfile: HardwareProfileSchema,
  NodeDesign: NodeDesignSchema,
  NodeFeatureDefinition: NodeFeatureDefinitionSchema,
  Experiment: ExperimentSchema,
  Specimen: SpecimenSchema,
  ProcessParameterSet: ProcessParameterSetSchema,
  Measurement: MeasurementSchema,
  AssemblyVerification: AssemblyVerificationSchema,
  ProcessObservation: ProcessObservationSchema,
  CalibrationSession: CalibrationSessionSchema,
  CalibrationTrial: CalibrationTrialSchema,
  ResearchReference: ResearchReferenceSchema,
  ProductionMetricRecord: ProductionMetricRecordSchema,
  FileDatasetMetadata: FileDatasetMetadataSchema,
  AuditEvent: AuditEventSchema,
};

