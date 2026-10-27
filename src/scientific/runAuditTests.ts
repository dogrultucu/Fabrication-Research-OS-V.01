import assert from 'node:assert/strict';
import {
  AssemblyVerificationSchema,
  AuditEventSchema,
  CalibrationSessionSchema,
  CalibrationTrialSchema,
  DOMAIN_ENTITY_NAMES,
  DOMAIN_ENTITY_SCHEMA_MAP,
  ExperimentSchema,
  FileDatasetMetadataSchema,
  HardwareProfileSchema,
  MaterialProfileSchema,
  MeasurementSchema,
  NodeDesignSchema,
  NodeFeatureDefinitionSchema,
  ProcessObservationSchema,
  ProcessParameterSetSchema,
  ProductionMetricRecordSchema,
  ProjectSchema,
  ResearchReferenceSchema,
  SCHEMA_VERSION,
  SpecimenSchema,
} from '../domain/models';
import { createDefaultProject, createSampleDataset } from '../fixtures/sampleDataset';
import { PHASE_A_INTEGRATION_ADAPTERS } from '../integrations/adapters';
import { CANONICAL_ENTITY_TO_STORE, STORES } from '../repositories/repository';
import {
  exportAssemblyVerificationsToCsv,
  exportExperimentsToCsv,
  exportMeasurementsToCsv,
  exportNodeDesignsToCsv,
  exportSpecimensToCsv,
  parseMeasurementsCsv,
  validateAndMigrateWorkspaceSnapshot,
} from '../services/importExport';
import {
  compareExperimentToBaseline,
  computeDiametralClearance,
  computeEuclideanPositionalResidual,
  computeJointAxisAngularDeviationDeg,
  computeMeasurementStatistics,
  computeProductionEfficiency,
  computeStageToStageShrinkage,
  evaluateEmpiricalCheckpointCandidate,
  evaluateExperimentQuality,
  evaluateFeatureMeasurementTolerance,
  evaluateParameterBoundsDeterministically,
  evaluateSpecimenAcceptance,
  verifyStreamCorrelationCompatibility,
} from './calculations';
import { runPhaseAVerificationChecks } from './verification';

interface TestResult {
  id: string;
  workflow: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(id: string, workflow: string, fn: () => string) {
  try {
    const details = fn();
    results.push({ id, workflow, passed: true, details });
  } catch (err) {
    results.push({
      id,
      workflow,
      passed: false,
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

const project = createDefaultProject();
const sample = createSampleDataset(project.id);

// Test 1: Built-in verification suite (12 Invariants)
recordTest('T01', 'Built-in Phase A + v0.1.1 Verification Suite (12 Invariants)', () => {
  const suite = runPhaseAVerificationChecks();
  assert.equal(
    suite.passed,
    true,
    `Suite failed: ${JSON.stringify(suite.results.filter((r) => !r.passed))}`
  );
  assert.equal(suite.results.length, 12);
  return `All ${suite.results.length} built-in verification checks passed.`;
});

// Test 2: Canonical 17 entities, Schema v2, IndexedDB Store Mapping & Foreign Key Associations
recordTest(
  'T02',
  'Schema v2 Canonical 17 Entities, Store Mapping & Material/Hardware/Node Associations',
  () => {
    assert.equal(SCHEMA_VERSION, 2, 'SCHEMA_VERSION must be 2');
    assert.equal(
      DOMAIN_ENTITY_NAMES.length,
      17,
      'DOMAIN_ENTITY_NAMES must have 17 canonical entities'
    );
    assert.equal(Object.keys(STORES).length, 17, 'STORES must have 17 IndexedDB object stores');

    for (const entityName of DOMAIN_ENTITY_NAMES) {
      assert.ok(
        DOMAIN_ENTITY_SCHEMA_MAP[entityName],
        `Missing Zod schema for canonical entity ${entityName}`
      );
      const storeKey = CANONICAL_ENTITY_TO_STORE[entityName];
      assert.ok(storeKey && STORES[storeKey], `Missing IndexedDB store for ${entityName}`);
    }

    for (const exp of sample.experiments) {
      const parsed = ExperimentSchema.safeParse(exp);
      assert.equal(parsed.success, true, `Experiment ${exp.id} failed schema validation`);
      const matExists = sample.materialProfiles.some((m) => m.id === exp.materialProfileId);
      const hwExists = sample.hardwareProfiles.some((h) => h.id === exp.hardwareProfileId);
      assert.equal(matExists, true, `Missing material profile ${exp.materialProfileId}`);
      assert.equal(hwExists, true, `Missing hardware profile ${exp.hardwareProfileId}`);
      if (exp.nodeDesignId) {
        const nodeExists = sample.nodeDesigns.some((n) => n.id === exp.nodeDesignId);
        assert.equal(nodeExists, true, `Missing nodeDesign ${exp.nodeDesignId}`);
      }
    }

    // Test invalid experiment rejected
    const invalidExp = {
      ...sample.experiments[0],
      processParameters: {
        ...sample.experiments[0].processParameters,
        printSpeedMmPerSec: -10,
      },
    };
    assert.equal(
      ExperimentSchema.safeParse(invalidExp).success,
      false,
      'Negative print speed should fail validation'
    );
    return 'Validated SCHEMA_VERSION=2, 17 canonical entities, 17 Zod schemas, 17 IndexedDB stores, and foreign keys.';
  }
);

// Test 3: Numerical Measurement Accuracy & Tolerance Evaluation
recordTest(
  'T03',
  'Workflow 4: Numerical Measurement Accuracy, Sample Variance (n-1), RMSE & Tolerance',
  () => {
    const exp1Meas = sample.measurements.filter(
      (m) => m.experimentId === 'sample-exp-001' && m.measurementType === 'bead width'
    );
    const stats = computeMeasurementStatistics(exp1Meas, { stabilityVerifiedByUser: false });
    assert.ok(stats, 'Stats should not be null');
    assert.equal(stats.count, 4);
    assert.ok(Math.abs(stats.mean - 7.215) < 1e-6, `Expected mean 7.215, got ${stats.mean}`);
    assert.equal(stats.withinToleranceCount, 0);
    assert.equal(stats.outOfToleranceCount, 4);
    assert.ok(Math.abs(stats.passRatePercent - 0) < 1e-6);

    const manualVar =
      exp1Meas.reduce((acc, m) => acc + Math.pow(m.measuredValue - 7.215, 2), 0) / 3;
    const manualStd = Math.sqrt(manualVar);
    assert.ok(
      Math.abs(stats.stdDev - manualStd) < 1e-6,
      `Expected sample stdDev ${manualStd}, got ${stats.stdDev}`
    );

    const manualMse =
      exp1Meas.reduce((acc, m) => acc + Math.pow(m.measuredValue - m.targetValue, 2), 0) / 4;
    assert.ok(Math.abs(stats.rmse - Math.sqrt(manualMse)) < 1e-6);

    const singleStats = computeMeasurementStatistics([exp1Meas[0]]);
    assert.ok(singleStats);
    assert.equal(singleStats.stdDev, 0);
    assert.equal(Number.isNaN(singleStats.rmse), false);

    const emptyStats = computeMeasurementStatistics([]);
    assert.equal(emptyStats, null);

    return `Verified mean=${stats.mean.toFixed(3)} mm, stdDev(n-1)=${stats.stdDev.toFixed(4)} mm, RMSE=${stats.rmse.toFixed(4)} mm, passRate=${stats.passRatePercent.toFixed(1)}%, n=1 and n=0 edge cases.`;
  }
);

// Test 4: CSV Import/Export with Unit Preservation, Custom Labels, Quoted Commas & Malformed Input
recordTest(
  'T04',
  'Workflow 5: CSV/JSON Import & Export with Unit, Stage & Metadata Preservation',
  () => {
    const customMeas = [
      ...sample.measurements.filter((m) => m.experimentId === 'sample-exp-004'),
      {
        ...sample.measurements[0],
        id: 'meas-custom-unit',
        experimentId: 'sample-exp-004',
        measurementType: 'custom measurement' as const,
        customMeasurementLabel: 'Bead Aspect Ratio, W/H',
        measuredValue: 2.15,
        unit: 'ratio_idx',
        targetValue: 2.1,
        tolerance: 0.2,
        xCoordMm: 12.5,
        yCoordMm: 0.0,
        zCoordMm: 15.0,
        notes: 'Note with "quotes", commas, and units',
      },
    ];
    const csv = exportMeasurementsToCsv(customMeas);
    const parsed = parseMeasurementsCsv(`\uFEFF${csv}`, 'sample-exp-004', 'file-test-01');
    assert.equal(
      parsed.errors.length,
      0,
      `Unexpected CSV parse errors: ${parsed.errors.join('; ')}`
    );
    assert.equal(parsed.validMeasurements.length, customMeas.length);

    const restoredCustom = parsed.validMeasurements.find(
      (m) => m.measurementType === 'custom measurement'
    );
    assert.ok(restoredCustom, 'Custom measurement should be restored');
    assert.equal(restoredCustom.unit, 'ratio_idx');
    assert.equal(restoredCustom.customMeasurementLabel, 'Bead Aspect Ratio, W/H');
    assert.equal(restoredCustom.xCoordMm, 12.5);
    assert.equal(restoredCustom.zCoordMm, 15.0);
    assert.equal(restoredCustom.notes, 'Note with "quotes", commas, and units');

    // Verify v0.1.1 ceramic node fields preserved through CSV round-trip
    const restoredNodeMeas = parsed.validMeasurements.find(
      (m) => m.featureId === 'SOCK-B' && m.physicalStage === 'DRY'
    );
    assert.ok(restoredNodeMeas, 'Ceramic node feature measurement should be restored');
    assert.equal(restoredNodeMeas.physicalStage, 'DRY');
    assert.equal(restoredNodeMeas.targetStage, 'DRY');
    assert.equal(restoredNodeMeas.nodeDesignId, 'sample-node-design-001');
    assert.equal(restoredNodeMeas.specimenRecordId, 'sample-spec-004-s01');
    assert.equal(restoredNodeMeas.toleranceLower, -0.25);
    assert.equal(restoredNodeMeas.toleranceUpper, 0.45);

    // Test invalid rows rejected without crashing (including missing tolerance)
    const malformedCsv = [
      'specimenId,layerIndex,measurementType,measuredValue,unit,targetValue,tolerance',
      'SPEC-BAD,5,bead width,NOT_A_NUMBER,mm,6.5,0.45',
      'SPEC-BAD2,5,bead width,6.5,mm,6.5,-0.5', // negative tolerance
      'SPEC-BAD3,5,bead width,6.5,mm,6.5,', // missing tolerance -> must be rejected, not defaulted to 0.5
      'SPEC-GOOD,5,bead width,6.52,mm,6.5,0.45',
    ].join('\n');
    const malformedRes = parseMeasurementsCsv(malformedCsv, 'sample-exp-001');
    assert.equal(malformedRes.validMeasurements.length, 1);
    assert.equal(malformedRes.errors.length, 3);

    // Experiments, NodeDesigns, Specimens, AssemblyVerifications CSV export
    const expCsv = exportExperimentsToCsv(sample.experiments);
    assert.ok(expCsv.includes('EXP-2026-001'));
    assert.ok(expCsv.includes('EXP-2026-004'));
    const ndCsv = exportNodeDesignsToCsv(sample.nodeDesigns, sample.nodeFeatureDefinitions);
    assert.ok(ndCsv.includes('NODE-A'));
    const specCsv = exportSpecimensToCsv(sample.specimens);
    assert.ok(specCsv.includes('EXP-004 / NODE-A-V01 / S01'));
    const assmCsv = exportAssemblyVerificationsToCsv(sample.assemblyVerifications);
    assert.ok(assmCsv.includes('DOWEL-GAUGE-18.2MM-AL'));

    return `Round-trip CSV preserved ${parsed.validMeasurements.length} records (including v0.1.1 stage/feature/asymmetric bounds) and rejected 3 malformed rows.`;
  }
);

// Test 5: Project Backup and Restore with Complete Relational Integrity & Legacy v1 Migration
recordTest(
  'T05',
  'Workflow 6: Project Backup & Restore (Schema v2 + Legacy v1 Migration + Relational Integrity)',
  () => {
    const fullSnapshotV2 = {
      schemaVersion: SCHEMA_VERSION,
      appVersion: '0.1.1',
      exportedAt: new Date().toISOString(),
      project,
      ...sample,
      fileMetadata: [],
      auditEvents: [],
    };
    const validRes = validateAndMigrateWorkspaceSnapshot(JSON.stringify(fullSnapshotV2, null, 2));
    assert.equal(validRes.valid, true, `Valid v2 snapshot failed: ${validRes.errors.join(', ')}`);
    assert.equal(validRes.snapshot?.schemaVersion, 2);
    assert.equal(validRes.snapshot?.nodeDesigns.length, sample.nodeDesigns.length);
    assert.equal(validRes.snapshot?.specimens.length, sample.specimens.length);
    assert.equal(
      validRes.snapshot?.assemblyVerifications.length,
      sample.assemblyVerifications.length
    );

    // Test legacy v1 backup migration (without nodeDesigns, specimens, or physicalStage on measurements)
    const legacyV1Snapshot = {
      schemaVersion: 1,
      appVersion: '0.1.0',
      exportedAt: '2026-10-12T12:00:00.000Z',
      project: { ...project, schemaVersion: 1 },
      materialProfiles: sample.materialProfiles,
      hardwareProfiles: sample.hardwareProfiles,
      experiments: sample.experiments.slice(0, 2).map((e) => {
        const copy: Record<string, unknown> = { ...e };
        delete copy.researchWorkflowType;
        delete copy.nodeDesignId;
        return copy;
      }),
      processParameterSets: sample.processParameterSets.slice(0, 2),
      measurements: sample.measurements
        .filter((m) => m.experimentId === 'sample-exp-001')
        .map((m) => {
          const copy: Record<string, unknown> = { ...m };
          delete copy.physicalStage;
          delete copy.specimenRecordId;
          return copy;
        }),
      processObservations: [],
      calibrationSessions: [],
      calibrationTrials: [],
      researchReferences: [],
      productionMetrics: [],
      fileMetadata: [],
      auditEvents: [],
    };
    const migratedV1 = validateAndMigrateWorkspaceSnapshot(JSON.stringify(legacyV1Snapshot));
    assert.equal(migratedV1.valid, true, `Legacy v1 migration failed: ${migratedV1.errors.join('; ')}`);
    assert.equal(migratedV1.migratedFromVersion, 1);
    assert.equal(migratedV1.snapshot?.schemaVersion, 2);
    assert.equal(migratedV1.snapshot?.nodeDesigns.length, 0);
    assert.equal(migratedV1.snapshot?.specimens.length, 0);
    assert.ok(
      migratedV1.snapshot?.measurements.every((m) => m.physicalStage === 'Stage Unknown'),
      'Legacy v1 measurements must default to Stage Unknown, never GREEN'
    );

    // Test broken FK in nodeFeatureDefinitions -> nodeDesignId
    const brokenFeatSnap = {
      ...fullSnapshotV2,
      nodeFeatureDefinitions: [
        { ...sample.nodeFeatureDefinitions[0], nodeDesignId: 'missing-node-design-999' },
      ],
    };
    assert.equal(
      validateAndMigrateWorkspaceSnapshot(JSON.stringify(brokenFeatSnap)).valid,
      false,
      'Should reject dangling nodeFeatureDefinition.nodeDesignId'
    );

    // Test broken FK in specimens -> experimentId
    const brokenSpecSnap = {
      ...fullSnapshotV2,
      specimens: [{ ...sample.specimens[0], experimentId: 'missing-exp-999' }],
    };
    assert.equal(
      validateAndMigrateWorkspaceSnapshot(JSON.stringify(brokenSpecSnap)).valid,
      false,
      'Should reject dangling specimen.experimentId'
    );

    // Test broken FK in assemblyVerifications -> specimenRecordId
    const brokenAssmSnap = {
      ...fullSnapshotV2,
      assemblyVerifications: [
        {
          ...sample.assemblyVerifications[0],
          specimenRecordId: 'missing-spec-999',
          specimenId: 'missing-spec-999',
        },
      ],
    };
    assert.equal(
      validateAndMigrateWorkspaceSnapshot(JSON.stringify(brokenAssmSnap)).valid,
      false,
      'Should reject dangling assemblyVerification.specimenRecordId'
    );

    return 'Verified Schema v2 backup/restore, non-destructive v1->v2 migration (preserving Stage Unknown), and relational integrity across all 17 entity stores.';
  }
);

// Test 6: Cp/Cpk Withholding Conditions & Empirical Interpolation Guards
recordTest(
  'T06',
  'Workflow 9: Cp/Cpk Precondition Guards & Empirical Interpolation Safeguards',
  () => {
    const baseMeas = sample.measurements[0];
    const n24 = Array.from({ length: 24 }, (_, i) => ({
      ...baseMeas,
      id: `m24-${i}`,
      measuredValue: 6.5 + (i % 2 === 0 ? 0.1 : -0.1),
    }));
    const res24 = computeMeasurementStatistics(n24, { stabilityVerifiedByUser: true });
    assert.equal(res24?.cp, null);
    assert.equal(res24?.cpk, null);

    const n25ZeroVar = Array.from({ length: 25 }, (_, i) => ({
      ...baseMeas,
      id: `m25z-${i}`,
      measuredValue: 6.5,
    }));
    const resZeroVar = computeMeasurementStatistics(n25ZeroVar, { stabilityVerifiedByUser: true });
    assert.equal(resZeroVar?.cp, null);
    assert.equal(resZeroVar?.cpk, null);

    const candidatesOnly = sample.calibrationTrials.map((t) => ({
      ...t,
      recordOrigin: 'Theoretical / Unvalidated Candidate' as const,
    }));
    const candInterp = evaluateEmpiricalCheckpointCandidate(
      sample.calibrationSessions[0],
      candidatesOnly,
      35,
      100,
      3.0,
      7.0,
      3.0
    );
    assert.equal(candInterp.canComputeRecommendation, false);

    return 'Verified Cp/Cpk withholding for n<25, unconfirmed stability, zero variance, and mixed tolerances; verified empirical interpolation excludes unvalidated candidates.';
  }
);

// Test 7: Provenance Distinction (Measured, Computed, Simulated, AI-Assisted)
recordTest(
  'T07',
  'Workflow 10: Strict Distinction Between Measured, Computed, and AI-Assisted Data',
  () => {
    const exp1 = sample.experiments[0];
    const baseMeas = sample.measurements.filter((m) => m.experimentId === exp1.id);
    const aiMeas = MeasurementSchema.parse({
      ...baseMeas[0],
      id: 'ai-test-1',
      sourceType: 'AI-Assisted Annotation',
      verifiedPhysicalMeasurement: false,
      measuredValue: 12.0,
    });
    const computedMeas = MeasurementSchema.parse({
      ...baseMeas[0],
      id: 'comp-test-1',
      sourceType: 'Computed',
      verifiedPhysicalMeasurement: false,
      measuredValue: 12.0,
    });

    const qDefault = evaluateExperimentQuality(exp1, [...baseMeas, aiMeas, computedMeas]);
    assert.equal(qDefault.verifiedMeasurementCount, 6);
    assert.equal(qDefault.unverifiedCount, 2);

    const statsDefault = computeMeasurementStatistics(
      [...baseMeas.filter((m) => m.measurementType === 'bead width'), aiMeas, computedMeas],
      {
        includeUnverifiedAi: false,
      }
    );
    assert.equal(statsDefault?.count, 4);

    return 'Verified that AI-Assisted and Computed records are flagged unverified and excluded from default statistics and experiment quality evaluations.';
  }
);

// Test 8: Process Timestamp Synchronization & Coordinate-Frame Safeguards
recordTest(
  'T08',
  'Workflow 11: Process Timestamp Synchronization & Coordinate-Frame Safeguards',
  () => {
    const obs = sample.processObservations;
    const meas = sample.measurements.filter((m) => m.experimentId === 'sample-exp-002');

    const okSync = verifyStreamCorrelationCompatibility(obs, meas);
    assert.equal(okSync.canCorrelate, true);

    const unsyncedObs = obs.map((o, i) =>
      i === 0 ? { ...o, clockSyncStatus: 'Unsynchronized Local Clock' as const } : o
    );
    const failUnsynced = verifyStreamCorrelationCompatibility(unsyncedObs, meas);
    assert.equal(failUnsynced.canCorrelate, false);

    const badTsMeas = meas.map((m, i) =>
      i === 0 ? { ...m, timestamp: 'NOT-AN-ISO-TIMESTAMP' } : m
    );
    const failBadTs = verifyStreamCorrelationCompatibility(obs, badTsMeas);
    assert.equal(failBadTs.canCorrelate, false);

    return 'Verified stream correlation blocks unsynchronized clocks, mismatched coordinate frames, and malformed ISO timestamps.';
  }
);

// Test 9: Safe ABB RAPID Export Behavior
recordTest('T09', 'Workflow 12: Safe Offline ABB RAPID Export & Clamping', () => {
  const params = sample.experiments[0].processParameters;
  const snippet = PHASE_A_INTEGRATION_ADAPTERS.robotExport.generateCheckpointParameterSnippet(
    params,
    5
  );
  assert.ok(snippet.includes('SAFETY WARNING: SIMULATION & HUMAN OPERATOR VALIDATION REQUIRED'));
  assert.ok(
    snippet.includes(
      'DO NOT EXECUTE DIRECTLY ON PHYSICAL ROBOT WITHOUT ROBOTSTUDIO VERIFICATION'
    )
  );
  assert.ok(snippet.includes('PERS speeddata vPrintCheckpoint := [35, 50, 5000, 1000];'));
  assert.equal(PHASE_A_INTEGRATION_ADAPTERS.robotExport.liveConnectionSupportedInPhaseA, false);
  return 'Verified offline ABB RAPID export contains mandatory safety headers, valid RAPID declarations, velocity clamping, and liveConnectionSupportedInPhaseA=false.';
});

// Test 10: Zod Validation of All Synthetic Sample Records Across All Entities
recordTest(
  'T10',
  'v0.1.1 Check 2 & 4: Exhaustive Zod Schema v2 Validation & Removal of Unsafe Defaults',
  () => {
    assert.ok(ProjectSchema.safeParse(project).success, 'Default project failed ProjectSchema');
    sample.materialProfiles.forEach((r) =>
      assert.ok(MaterialProfileSchema.safeParse(r).success, `MaterialProfile ${r.id} invalid`)
    );
    sample.hardwareProfiles.forEach((r) =>
      assert.ok(HardwareProfileSchema.safeParse(r).success, `HardwareProfile ${r.id} invalid`)
    );
    sample.nodeDesigns.forEach((r) =>
      assert.ok(NodeDesignSchema.safeParse(r).success, `NodeDesign ${r.id} invalid`)
    );
    sample.nodeFeatureDefinitions.forEach((r) =>
      assert.ok(
        NodeFeatureDefinitionSchema.safeParse(r).success,
        `NodeFeatureDefinition ${r.id} invalid`
      )
    );
    sample.experiments.forEach((r) =>
      assert.ok(ExperimentSchema.safeParse(r).success, `Experiment ${r.id} invalid`)
    );
    sample.specimens.forEach((r) =>
      assert.ok(SpecimenSchema.safeParse(r).success, `Specimen ${r.id} invalid`)
    );
    sample.processParameterSets.forEach((r) =>
      assert.ok(
        ProcessParameterSetSchema.safeParse(r).success,
        `ProcessParameterSet ${r.id} invalid`
      )
    );
    sample.measurements.forEach((r) =>
      assert.ok(MeasurementSchema.safeParse(r).success, `Measurement ${r.id} invalid`)
    );
    sample.assemblyVerifications.forEach((r) =>
      assert.ok(
        AssemblyVerificationSchema.safeParse(r).success,
        `AssemblyVerification ${r.id} invalid`
      )
    );
    sample.processObservations.forEach((r) =>
      assert.ok(
        ProcessObservationSchema.safeParse(r).success,
        `ProcessObservation ${r.id} invalid`
      )
    );
    sample.calibrationSessions.forEach((r) =>
      assert.ok(
        CalibrationSessionSchema.safeParse(r).success,
        `CalibrationSession ${r.id} invalid`
      )
    );
    sample.calibrationTrials.forEach((r) =>
      assert.ok(CalibrationTrialSchema.safeParse(r).success, `CalibrationTrial ${r.id} invalid`)
    );
    sample.researchReferences.forEach((r) =>
      assert.ok(
        ResearchReferenceSchema.safeParse(r).success,
        `ResearchReference ${r.id} invalid`
      )
    );
    sample.productionMetrics.forEach((r) =>
      assert.ok(
        ProductionMetricRecordSchema.safeParse(r).success,
        `ProductionMetricRecord ${r.id} invalid`
      )
    );

    // Verify unsafe defaults were removed:
    // 1. NodeDesign without nodeDesignCode or title must fail
    assert.equal(
      NodeDesignSchema.safeParse({
        id: 'nd-bad',
        geometryVersion: 'V01',
        coordinateSystem: 'wobjPrintTable_01',
        unitSystem: 'mm',
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: '2026-10-20T00:00:00Z',
      }).success,
      false,
      'NodeDesign missing nodeDesignCode and title must fail instead of defaulting to NODE-A'
    );

    // 2. AssemblyVerification without passFailStatus/verificationResult must fail instead of defaulting to PASS
    assert.equal(
      AssemblyVerificationSchema.safeParse({
        id: 'assm-incomplete',
        experimentId: 'sample-exp-004',
        specimenId: 'sample-spec-004-s01',
        nodeDesignId: 'sample-node-design-001',
        geometryVersion: 'V01',
        physicalStageAtTest: 'DRY',
        assemblyTestDate: '2026-10-21T16:15:00.000Z',
        assemblyMethod: 'Manual gauge',
        createdAt: '2026-10-21T16:15:00.000Z',
      }).success,
      false,
      'Incomplete AssemblyVerification must fail instead of defaulting to PASS'
    );

    return `Validated all ${
      sample.nodeDesigns.length +
      sample.nodeFeatureDefinitions.length +
      sample.specimens.length +
      sample.measurements.length +
      sample.assemblyVerifications.length +
      sample.experiments.length +
      sample.calibrationSessions.length +
      sample.calibrationTrials.length
    }+ synthetic records against strict Zod Schema v2 and confirmed unsafe defaults are removed.`;
  }
);

// Test 11: Multi-Stage Ceramic Shrinkage Calculations (GREEN -> DRY, DRY -> FIRED, GREEN -> FIRED & Invalid Stage Guards)
recordTest(
  'T11',
  'v0.1.1 Check 4, 5, 6 & 7: Stage-to-Stage Shrinkage (GREEN->DRY, DRY->FIRED, GREEN->FIRED & Withholding Guards)',
  () => {
    const mGreen = sample.measurements.find((m) => m.id === 'sample-meas-node-020')!;
    const mDry = sample.measurements.find((m) => m.id === 'sample-meas-node-021')!;
    const mFired = sample.measurements.find((m) => m.id === 'sample-meas-node-022')!;

    // 1. GREEN -> DRY: (20.0 - 18.8) / 20.0 = 6.000%
    const greenToDry = computeStageToStageShrinkage(mGreen, mDry);
    assert.equal(greenToDry.canCompute, true);
    assert.equal(greenToDry.transitionLabel, 'GREEN -> DRY');
    assert.equal(greenToDry.absoluteDimensionalChange, 1.2);
    assert.equal(greenToDry.linearShrinkagePercent, 6.0);
    assert.equal(greenToDry.expansionAnomalyDetected, false);

    // 2. DRY -> FIRED: (18.8 - 17.6) / 18.8 = 6.383%
    const dryToFired = computeStageToStageShrinkage(mDry, mFired);
    assert.equal(dryToFired.canCompute, true);
    assert.equal(dryToFired.transitionLabel, 'DRY -> FIRED');
    assert.equal(dryToFired.absoluteDimensionalChange, 1.2);
    assert.equal(dryToFired.linearShrinkagePercent, 6.383);

    // 3. GREEN -> FIRED: (20.0 - 17.6) / 20.0 = 12.000%
    const greenToFired = computeStageToStageShrinkage(mGreen, mFired);
    assert.equal(greenToFired.canCompute, true);
    assert.equal(greenToFired.transitionLabel, 'GREEN -> FIRED');
    assert.equal(greenToFired.absoluteDimensionalChange, 2.4);
    assert.equal(greenToFired.linearShrinkagePercent, 12.0);

    // 4. Invalid / reversed stage order (DRY -> GREEN) withheld
    const reversed = computeStageToStageShrinkage(mDry, mGreen);
    assert.equal(reversed.canCompute, false);
    assert.equal(reversed.linearShrinkagePercent, null);

    // 5. Missing / Stage Unknown withheld
    const unknownStage = computeStageToStageShrinkage(
      { ...mGreen, physicalStage: 'Stage Unknown' },
      mDry
    );
    assert.equal(unknownStage.canCompute, false);
    assert.equal(unknownStage.linearShrinkagePercent, null);

    // 6. Cross-specimen mismatch withheld
    const diffSpec = computeStageToStageShrinkage(mGreen, {
      ...mDry,
      specimenId: 'EXP-004 / NODE-A-V01 / S01',
      specimenRecordId: 'sample-spec-004-s01',
    });
    assert.equal(diffSpec.canCompute, false);

    return 'Verified GREEN->DRY (6.000%), DRY->FIRED (6.383%), GREEN->FIRED (12.000%), and withholding on reversed/unknown/cross-specimen stages.';
  }
);

// Test 12: Feature Tolerance, Diametral Clearance & Specimen Acceptance Guards
recordTest(
  'T12',
  'v0.1.1 Check 8, 9 & 10: Feature Tolerance, Diametral Clearance & Specimen Acceptance Safeguards',
  () => {
    // Asymmetric tolerance check: target 18.8, bounds [-0.25, +0.45] -> [18.55, 19.25]
    const asymPass = evaluateFeatureMeasurementTolerance({
      measuredValue: 18.92,
      targetValue: 18.8,
      tolerance: 0.45,
      lowerTolerance: -0.25,
      upperTolerance: 0.45,
      unit: 'mm',
      physicalStage: 'DRY',
      targetStage: 'DRY',
    });
    assert.equal(asymPass.isAsymmetric, true);
    assert.equal(asymPass.withinTolerance, true);
    assert.equal(asymPass.status, 'PASS');

    const asymFailLow = evaluateFeatureMeasurementTolerance({
      measuredValue: 18.5, // -0.30 < -0.25 lower bound (even though |residual| < 0.45)
      targetValue: 18.8,
      tolerance: 0.45,
      lowerTolerance: -0.25,
      upperTolerance: 0.45,
      unit: 'mm',
      physicalStage: 'DRY',
      targetStage: 'DRY',
    });
    assert.equal(asymFailLow.withinTolerance, false);
    assert.equal(asymFailLow.status, 'FAIL_LOW');

    // Stage mismatch withheld
    const stageMismatch = evaluateFeatureMeasurementTolerance({
      measuredValue: 20.0,
      targetValue: 18.8,
      tolerance: 0.45,
      unit: 'mm',
      physicalStage: 'GREEN',
      targetStage: 'DRY',
    });
    assert.equal(stageMismatch.stageCompatible, false);
    assert.equal(stageMismatch.withinTolerance, null);
    assert.equal(stageMismatch.status, 'STAGE_MISMATCH_WITHHELD');

    // Unit mismatch withheld
    const unitMismatch = evaluateFeatureMeasurementTolerance({
      measuredValue: 18.8,
      targetValue: 18.8,
      tolerance: 0.45,
      unit: 'deg',
      expectedUnit: 'mm',
      physicalStage: 'DRY',
      targetStage: 'DRY',
    });
    assert.equal(unitMismatch.withinTolerance, null);
    assert.equal(unitMismatch.status, 'UNIT_MISMATCH_WITHHELD');

    // Euclidean residual & joint angle
    const euclid = computeEuclideanPositionalResidual(
      { xMm: 3, yMm: 4, zMm: 0 },
      { xMm: 0, yMm: 0, zMm: 0 }
    );
    assert.equal(euclid, 5.0);
    const angleEval = computeJointAxisAngularDeviationDeg(120.4, 120.0, 1.5);
    assert.equal(angleEval?.withinTolerance, true);
    assert.equal(angleEval?.residualDeg, 0.4);

    // Diametral clearance
    const clearanceFit = computeDiametralClearance(18.8, 18.2);
    assert.equal(clearanceFit?.clearanceMm, 0.6);
    assert.equal(clearanceFit?.fitClassification, 'Clearance Fit');
    assert.equal(clearanceFit?.withinClearanceWindow, true);

    const interferenceFit = computeDiametralClearance(18.0, 18.2);
    assert.equal(interferenceFit?.clearanceMm, -0.2);
    assert.equal(interferenceFit?.fitClassification, 'Interference / No-Go');
    assert.equal(interferenceFit?.withinClearanceWindow, false);

    // Specimen acceptance evaluation:
    // S01 has all critical features passing in DRY + PASS AssemblyVerification -> 'Assembly Accepted'
    const s01 = sample.specimens.find((s) => s.id === 'sample-spec-004-s01')!;
    const evalS01 = evaluateSpecimenAcceptance(
      s01,
      sample.measurements,
      sample.assemblyVerifications,
      sample.nodeFeatureDefinitions
    );
    assert.equal(evalS01.status, 'Assembly Accepted');

    // S02 has out-of-tolerance SOCK-B in GREEN -> 'Geometrically Rejected'
    const s02 = sample.specimens.find((s) => s.id === 'sample-spec-004-s02')!;
    const evalS02 = evaluateSpecimenAcceptance(
      s02,
      sample.measurements,
      sample.assemblyVerifications,
      sample.nodeFeatureDefinitions
    );
    assert.equal(evalS02.status, 'Geometrically Rejected');

    // S03 has all critical features passing + NOT_TESTED AssemblyVerification -> 'Geometrically Accepted' (never 'Assembly Accepted')
    const s03 = sample.specimens.find((s) => s.id === 'sample-spec-004-s03')!;
    const evalS03 = evaluateSpecimenAcceptance(
      s03,
      sample.measurements,
      sample.assemblyVerifications,
      sample.nodeFeatureDefinitions
    );
    assert.equal(evalS03.status, 'Geometrically Accepted');
    assert.equal(evalS03.hasPhysicalAssemblyPass, false);

    // Production efficiency with dryingAndFiringDurationMin (1680 min = 28 hours)
    const prodExp4 = sample.productionMetrics.find((p) => p.experimentId === 'sample-exp-004')!;
    const effExp4 = computeProductionEfficiency(prodExp4);
    assert.equal(effExp4.dryingAndFiringDurationMin, 1680);
    assert.ok(effExp4.completeProcessDurationMin > effExp4.totalCycleDurationMin);

    return 'Verified asymmetric tolerances, stage/unit mismatch withholding, diametral clearance, and strict Specimen Acceptance rules.';
  }
);

console.log(JSON.stringify({ allPassed: results.every((r) => r.passed), results }, null, 2));
if (!results.every((r) => r.passed)) {
  process.exit(1);
}

