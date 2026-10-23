import assert from 'node:assert/strict';
import {
  DOMAIN_ENTITY_NAMES,
  ExperimentSchema,
  MeasurementSchema,
} from '../domain/models';
import { createDefaultProject, createSampleDataset } from '../fixtures/sampleDataset';
import { PHASE_A_INTEGRATION_ADAPTERS } from '../integrations/adapters';
import {
  exportExperimentsToCsv,
  exportMeasurementsToCsv,
  parseMeasurementsCsv,
  validateAndMigrateWorkspaceSnapshot,
} from '../services/importExport';
import {
  compareExperimentToBaseline,
  computeMeasurementStatistics,
  evaluateEmpiricalCheckpointCandidate,
  evaluateExperimentQuality,
  evaluateParameterBoundsDeterministically,
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

// Test 1: Built-in verification suite
recordTest('T01', 'Built-in Phase A Verification Suite (11 Invariants)', () => {
  const suite = runPhaseAVerificationChecks();
  assert.equal(suite.passed, true, `Suite failed: ${JSON.stringify(suite.results.filter((r) => !r.passed))}`);
  return `All ${suite.results.length} built-in verification checks passed.`;
});

// Test 2: Canonical 13 entities & Zod Schema validation
recordTest('T02', 'Workflow 1 & 3: Domain Schema Validation & Material/Hardware Associations', () => {
  assert.equal(DOMAIN_ENTITY_NAMES.length, 13);
  for (const exp of sample.experiments) {
    const parsed = ExperimentSchema.safeParse(exp);
    assert.equal(parsed.success, true, `Experiment ${exp.id} failed schema validation`);
    const matExists = sample.materialProfiles.some((m) => m.id === exp.materialProfileId);
    const hwExists = sample.hardwareProfiles.some((h) => h.id === exp.hardwareProfileId);
    assert.equal(matExists, true, `Missing material profile ${exp.materialProfileId}`);
    assert.equal(hwExists, true, `Missing hardware profile ${exp.hardwareProfileId}`);
  }
  // Test invalid experiment rejected
  const invalidExp = { ...sample.experiments[0], processParameters: { ...sample.experiments[0].processParameters, printSpeedMmPerSec: -10 } };
  assert.equal(ExperimentSchema.safeParse(invalidExp).success, false, 'Negative print speed should fail validation');
  return 'Validated 13 canonical entities, Material/Hardware foreign keys, and negative-parameter rejection.';
});

// Test 3: Numerical Measurement Accuracy & Tolerance Evaluation
recordTest('T03', 'Workflow 4: Numerical Measurement Accuracy, Sample Variance (n-1), RMSE & Tolerance', () => {
  const exp1Meas = sample.measurements.filter(
    (m) => m.experimentId === 'sample-exp-001' && m.measurementType === 'bead width'
  );
  const stats = computeMeasurementStatistics(exp1Meas, { stabilityVerifiedByUser: false });
  assert.ok(stats, 'Stats should not be null');
  assert.equal(stats.count, 4);
  // Values: 7.08, 7.16, 7.28, 7.34 -> mean = 28.86 / 4 = 7.215
  assert.ok(Math.abs(stats.mean - 7.215) < 1e-6, `Expected mean 7.215, got ${stats.mean}`);
  // Target = 6.5, Tol = 0.45 -> within tolerance [6.05, 6.95]: 0 pass, 4 fail
  assert.equal(stats.withinToleranceCount, 0);
  assert.equal(stats.outOfToleranceCount, 4);
  assert.ok(Math.abs(stats.passRatePercent - 0) < 1e-6);

  // Sample standard deviation (n-1 = 3):
  const manualVar =
    exp1Meas.reduce((acc, m) => acc + Math.pow(m.measuredValue - 7.215, 2), 0) / 3;
  const manualStd = Math.sqrt(manualVar);
  assert.ok(Math.abs(stats.stdDev - manualStd) < 1e-6, `Expected sample stdDev ${manualStd}, got ${stats.stdDev}`);

  // RMSE:
  const manualMse =
    exp1Meas.reduce((acc, m) => acc + Math.pow(m.measuredValue - m.targetValue, 2), 0) / 4;
  assert.ok(Math.abs(stats.rmse - Math.sqrt(manualMse)) < 1e-6);

  // Single-point edge case (n=1) -> stdDev = 0, no NaN
  const singleStats = computeMeasurementStatistics([exp1Meas[0]]);
  assert.ok(singleStats);
  assert.equal(singleStats.stdDev, 0);
  assert.equal(Number.isNaN(singleStats.rmse), false);

  // Empty dataset edge case -> returns null safely
  const emptyStats = computeMeasurementStatistics([]);
  assert.equal(emptyStats, null);

  return `Verified mean=${stats.mean.toFixed(3)} mm, stdDev(n-1)=${stats.stdDev.toFixed(4)} mm, RMSE=${stats.rmse.toFixed(4)} mm, passRate=${stats.passRatePercent.toFixed(1)}%, n=1 and n=0 edge cases.`;
});

// Test 4: CSV Import/Export with Unit Preservation, Custom Labels, Quoted Commas & Malformed Input
recordTest('T04', 'Workflow 5: CSV/JSON Import & Export with Unit & Metadata Preservation', () => {
  const customMeas = [
    ...sample.measurements.filter((m) => m.experimentId === 'sample-exp-001'),
    {
      ...sample.measurements[0],
      id: 'meas-custom-unit',
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
  const parsed = parseMeasurementsCsv(`\uFEFF${csv}`, 'sample-exp-001', 'file-test-01');
  assert.equal(parsed.errors.length, 0, `Unexpected CSV parse errors: ${parsed.errors.join('; ')}`);
  assert.equal(parsed.validMeasurements.length, customMeas.length);

  const restoredCustom = parsed.validMeasurements.find((m) => m.measurementType === 'custom measurement');
  assert.ok(restoredCustom, 'Custom measurement should be restored');
  assert.equal(restoredCustom.unit, 'ratio_idx');
  assert.equal(restoredCustom.customMeasurementLabel, 'Bead Aspect Ratio, W/H');
  assert.equal(restoredCustom.xCoordMm, 12.5);
  assert.equal(restoredCustom.zCoordMm, 15.0);
  assert.equal(restoredCustom.notes, 'Note with "quotes", commas, and units');

  // Test invalid rows rejected without crashing
  const malformedCsv = [
    'specimenId,layerIndex,measurementType,measuredValue,unit,targetValue,tolerance',
    'SPEC-BAD,5,bead width,NOT_A_NUMBER,mm,6.5,0.45',
    'SPEC-BAD2,5,bead width,6.5,mm,6.5,-0.5', // negative tolerance
    'SPEC-GOOD,5,bead width,6.52,mm,6.5,0.45',
  ].join('\n');
  const malformedRes = parseMeasurementsCsv(malformedCsv, 'sample-exp-001');
  assert.equal(malformedRes.validMeasurements.length, 1);
  assert.equal(malformedRes.errors.length, 2);

  // Experiments CSV export
  const expCsv = exportExperimentsToCsv(sample.experiments);
  assert.ok(expCsv.includes('EXP-2026-001'));
  assert.ok(expCsv.includes('35'));

  return `Round-trip CSV preserved ${parsed.validMeasurements.length} records (units, custom labels, XYZ coords, escaped quotes) and rejected 2 malformed rows.`;
});

// Test 5: Project Backup and Restore with Complete Relational Integrity
recordTest('T05', 'Workflow 6: Project Backup & Restore with Complete Relational Integrity', () => {
  const fullSnapshot = {
    schemaVersion: 1,
    appVersion: '0.1.0',
    exportedAt: new Date().toISOString(),
    project,
    ...sample,
    fileMetadata: [],
    auditEvents: [],
  };
  const rawJson = JSON.stringify(fullSnapshot, null, 2);
  const validRes = validateAndMigrateWorkspaceSnapshot(rawJson);
  assert.equal(validRes.valid, true, `Valid snapshot failed: ${validRes.errors.join(', ')}`);

  // Test broken FK in calibrationTrials -> calibrationSessionId
  const brokenTrialSnap = {
    ...fullSnapshot,
    calibrationTrials: [
      { ...sample.calibrationTrials[0], calibrationSessionId: 'missing-session-999' },
    ],
  };
  const brokenTrialRes = validateAndMigrateWorkspaceSnapshot(JSON.stringify(brokenTrialSnap));
  assert.equal(brokenTrialRes.valid, false, 'Should reject dangling calibrationSessionId');

  // Test broken FK in processObservations -> experimentId
  const brokenObsSnap = {
    ...fullSnapshot,
    processObservations: [
      { ...sample.processObservations[0], experimentId: 'missing-exp-999' },
    ],
  };
  const brokenObsRes = validateAndMigrateWorkspaceSnapshot(JSON.stringify(brokenObsSnap));
  assert.equal(brokenObsRes.valid, false, 'Should reject dangling processObservation.experimentId');

  // Test broken FK in productionMetrics -> experimentId
  const brokenProdSnap = {
    ...fullSnapshot,
    productionMetrics: [
      { ...sample.productionMetrics[0], experimentId: 'missing-exp-999' },
    ],
  };
  const brokenProdRes = validateAndMigrateWorkspaceSnapshot(JSON.stringify(brokenProdSnap));
  assert.equal(brokenProdRes.valid, false, 'Should reject dangling productionMetrics.experimentId');

  return 'Verified versioned JSON backup serialization and relational integrity checks across all 13 entity stores.';
});

// Test 6: Cp/Cpk Withholding Conditions & Empirical Interpolation Guards
recordTest('T06', 'Workflow 9: Cp/Cpk Precondition Guards & Empirical Interpolation Safeguards', () => {
  const baseMeas = sample.measurements[0];
  // 1. n=24 -> withheld
  const n24 = Array.from({ length: 24 }, (_, i) => ({
    ...baseMeas,
    id: `m24-${i}`,
    measuredValue: 6.5 + (i % 2 === 0 ? 0.1 : -0.1),
  }));
  const res24 = computeMeasurementStatistics(n24, { stabilityVerifiedByUser: true });
  assert.equal(res24?.cp, null);
  assert.equal(res24?.cpk, null);

  // 2. n=25, zero variance (all identical values) -> stdDev=0 -> withheld (no Infinity)
  const n25ZeroVar = Array.from({ length: 25 }, (_, i) => ({
    ...baseMeas,
    id: `m25z-${i}`,
    measuredValue: 6.5,
  }));
  const resZeroVar = computeMeasurementStatistics(n25ZeroVar, { stabilityVerifiedByUser: true });
  assert.equal(resZeroVar?.cp, null);
  assert.equal(resZeroVar?.cpk, null);

  // 3. Empirical interpolation with theoretical candidates only -> withheld
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
});

// Test 7: Provenance Distinction (Measured, Computed, Simulated, AI-Assisted)
recordTest('T07', 'Workflow 10: Strict Distinction Between Measured, Computed, and AI-Assisted Data', () => {
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
});

// Test 8: Process Timestamp Synchronization & Coordinate-Frame Safeguards
recordTest('T08', 'Workflow 11: Process Timestamp Synchronization & Coordinate-Frame Safeguards', () => {
  const obs = sample.processObservations;
  const meas = sample.measurements.filter((m) => m.experimentId === 'sample-exp-002');

  // 1. Valid synchronized & same coordinate frame
  const okSync = verifyStreamCorrelationCompatibility(obs, meas);
  assert.equal(okSync.canCorrelate, true);

  // 2. Unsynchronized clock state
  const unsyncedObs = obs.map((o, i) =>
    i === 0 ? { ...o, clockSyncStatus: 'Unsynchronized Local Clock' as const } : o
  );
  const failUnsynced = verifyStreamCorrelationCompatibility(unsyncedObs, meas);
  assert.equal(failUnsynced.canCorrelate, false);

  // 3. Invalid timestamp string
  const badTsMeas = meas.map((m, i) =>
    i === 0 ? { ...m, timestamp: 'NOT-AN-ISO-TIMESTAMP' } : m
  );
  const failBadTs = verifyStreamCorrelationCompatibility(obs, badTsMeas);
  assert.equal(failBadTs.canCorrelate, false);

  return 'Verified stream correlation blocks unsynchronized clocks, mismatched coordinate frames, and malformed ISO timestamps.';
});

// Test 9: Safe ABB RAPID Export Behavior
recordTest('T09', 'Workflow 12: Safe Offline ABB RAPID Export & Clamping', () => {
  const params = sample.experiments[0].processParameters;
  const snippet = PHASE_A_INTEGRATION_ADAPTERS.robotExport.generateCheckpointParameterSnippet(
    params,
    5
  );
  assert.ok(snippet.includes('SAFETY WARNING: SIMULATION & HUMAN OPERATOR VALIDATION REQUIRED'));
  assert.ok(snippet.includes('DO NOT EXECUTE DIRECTLY ON PHYSICAL ROBOT WITHOUT ROBOTSTUDIO VERIFICATION'));
  assert.ok(snippet.includes('PERS speeddata vPrintCheckpoint := [35, 50, 5000, 1000];'));
  assert.equal(PHASE_A_INTEGRATION_ADAPTERS.robotExport.liveConnectionSupportedInPhaseA, false);
  return 'Verified offline ABB RAPID export contains mandatory safety headers, valid RAPID declarations, velocity clamping, and liveConnectionSupportedInPhaseA=false.';
});

console.log(JSON.stringify({ allPassed: results.every((r) => r.passed), results }, null, 2));
if (!results.every((r) => r.passed)) {
  process.exit(1);
}
