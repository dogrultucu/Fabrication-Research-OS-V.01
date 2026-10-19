import { DOMAIN_ENTITY_NAMES } from '../domain/models';
import { createDefaultProject, createSampleDataset } from '../fixtures/sampleDataset';
import {
  computeMeasurementStatistics,
  evaluateEmpiricalCheckpointCandidate,
  evaluateParameterBoundsDeterministically,
  verifyStreamCorrelationCompatibility,
} from './calculations';

/**
 * Automated domain & scientific invariant verification suite for Phase A.
 */
export function runPhaseAVerificationChecks(): {
  passed: boolean;
  results: Array<{ check: string; passed: boolean; detail: string }>;
} {
  const results: Array<{ check: string; passed: boolean; detail: string }> = [];

  // 1. Canonical 13 entities count
  results.push({
    check: 'Canonical 13 Domain Entities',
    passed: DOMAIN_ENTITY_NAMES.length === 13,
    detail: `Registered ${DOMAIN_ENTITY_NAMES.length} entities: ${DOMAIN_ENTITY_NAMES.join(', ')}`,
  });

  const proj = createDefaultProject();
  const sample = createSampleDataset(proj.id);

  // 2. Non-destructive sample fixture tagging
  const allSampleFlagged =
    sample.experiments.every((e) => e.isSampleFixture === true) &&
    sample.materialProfiles.every((m) => m.isSampleFixture === true) &&
    sample.hardwareProfiles.every((h) => h.isSampleFixture === true) &&
    sample.measurements.every((m) => m.isSampleFixture === true);

  results.push({
    check: 'Sample Fixtures Non-Destructive Tagging',
    passed: allSampleFlagged,
    detail: 'All sample records carry isSampleFixture=true so user research data is never deleted on sample removal.',
  });

  // 3. Cp/Cpk withheld when n < 25
  const exp1Meas = sample.measurements.filter(
    (m) => m.experimentId === 'sample-exp-001' && m.measurementType === 'bead width'
  );
  const statsSmallN = computeMeasurementStatistics(exp1Meas, {
    stabilityVerifiedByUser: true,
  });
  results.push({
    check: 'Cp/Cpk Statistical Precondition Guard (n < 25)',
    passed: Boolean(statsSmallN && statsSmallN.cp === null && statsSmallN.cpk === null),
    detail: statsSmallN?.capabilityStatusReason || 'No stats',
  });

  // 4. Deterministic bounds checking
  const boundsCheck = evaluateParameterBoundsDeterministically(
    sample.calibrationSessions[0].parameterBounds,
    35.0,
    130.0, // exceeds maxRelativeFlowPercent=115
    3.0,
    6.5
  );
  results.push({
    check: 'Deterministic Parameter Bounds Clamping',
    passed: !boundsCheck.withinBounds && boundsCheck.clampedRelativeFlowPercent === 115.0,
    detail: `Violations detected: ${boundsCheck.violations.length}, clamped flow to ${boundsCheck.clampedRelativeFlowPercent}%`,
  });

  // 5. Empirical checkpoint interpolation withheld when < 3 observed trials
  const insufficientInterp = evaluateEmpiricalCheckpointCandidate(
    sample.calibrationSessions[0],
    sample.calibrationTrials.slice(0, 2),
    35.0,
    100.0,
    3.0,
    7.05,
    2.9
  );
  const sufficientInterp = evaluateEmpiricalCheckpointCandidate(
    sample.calibrationSessions[0],
    sample.calibrationTrials,
    35.0,
    100.0,
    3.0,
    7.05,
    2.9
  );
  results.push({
    check: 'Empirical Checkpoint Interpolation Guard (>= 3 Observed Trials)',
    passed:
      !insufficientInterp.canComputeRecommendation &&
      sufficientInterp.canComputeRecommendation,
    detail: `With 2 trials: canCompute=${insufficientInterp.canComputeRecommendation}; with 3 trials: canCompute=${sufficientInterp.canComputeRecommendation} (candidate flow=${sufficientInterp.candidateRelativeFlowPercent}%)`,
  });

  // 6. Stream correlation synchronization & coordinate frame guard
  const syncCheck = verifyStreamCorrelationCompatibility(
    sample.processObservations,
    sample.measurements.filter((m) => m.experimentId === 'sample-exp-002')
  );
  results.push({
    check: 'Process Explorer Clock & Coordinate Frame Verification',
    passed: syncCheck.canCorrelate && syncCheck.commonCoordinateFrame === 'wobjPrintTable_01',
    detail: `canCorrelate=${syncCheck.canCorrelate}, frame=${syncCheck.commonCoordinateFrame}`,
  });

  return {
    passed: results.every((r) => r.passed),
    results,
  };
}
