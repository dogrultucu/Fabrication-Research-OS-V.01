import {
  CalibrationSession,
  CalibrationTrial,
  Experiment,
  Measurement,
  ParameterBounds,
  ProcessObservation,
  ProductionMetricRecord,
} from '../domain/models';

export const MIN_SAMPLE_SIZE_FOR_CAPABILITY_INDEX = 25;

export interface StatisticalSummary {
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  meanResidual: number;
  absMeanResidual: number;
  rmse: number;
  maxAbsResidual: number;
  withinToleranceCount: number;
  outOfToleranceCount: number;
  passRatePercent: number;
  cp: number | null;
  cpk: number | null;
  capabilityStatusReason: string;
  unit: string;
  targetValue: number;
  tolerance: number;
}

/**
 * Computes statistical metrics for a homogeneous set of physical measurements
 * (same measurementType and unit).
 *
 * Scientific Rigor Rules:
 * 1. Excludes unverified or AI-Assisted Annotations unless explicitly toggled.
 * 2. Calculates Cp/Cpk ONLY when n >= 25 and process stability / non-zero variance assumptions
 *    are satisfied. Otherwise returns null for Cp/Cpk with an explicit explanation.
 */
export function computeMeasurementStatistics(
  measurements: Measurement[],
  options: { includeUnverifiedAi?: boolean; stabilityVerifiedByUser?: boolean } = {
    includeUnverifiedAi: false,
    stabilityVerifiedByUser: false,
  }
): StatisticalSummary | null {
  const filtered = options.includeUnverifiedAi
    ? measurements
    : measurements.filter(
        (m) => m.verifiedPhysicalMeasurement && m.sourceType !== 'AI-Assisted Annotation'
      );

  if (filtered.length === 0) {
    return null;
  }

  const count = filtered.length;
  const targetValue = filtered[0].targetValue;
  const tolerance = filtered[0].tolerance;
  const unit = filtered[0].unit;

  const values = filtered.map((m) => m.measuredValue);
  const residuals = filtered.map((m) => m.measuredValue - m.targetValue);
  const absResiduals = residuals.map((r) => Math.abs(r));

  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;

  const variance =
    count > 1
      ? values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (count - 1)
      : 0;
  const stdDev = Math.sqrt(variance);

  const min = Math.min(...values);
  const max = Math.max(...values);

  const meanResidual = residuals.reduce((acc, r) => acc + r, 0) / count;
  const absMeanResidual = absResiduals.reduce((acc, r) => acc + r, 0) / count;
  const rmse = Math.sqrt(residuals.reduce((acc, r) => acc + r * r, 0) / count);
  const maxAbsResidual = Math.max(...absResiduals);

  const withinToleranceCount = filtered.filter(
    (m) => Math.abs(m.measuredValue - m.targetValue) <= m.tolerance
  ).length;
  const outOfToleranceCount = count - withinToleranceCount;
  const passRatePercent = (withinToleranceCount / count) * 100;

  let cp: number | null = null;
  let cpk: number | null = null;
  let capabilityStatusReason = '';

  if (count < MIN_SAMPLE_SIZE_FOR_CAPABILITY_INDEX) {
    capabilityStatusReason = `Withheld: n=${count} < ${MIN_SAMPLE_SIZE_FOR_CAPABILITY_INDEX} minimum sample size required for statistically defensible Cp/Cpk estimation.`;
  } else if (!options.stabilityVerifiedByUser) {
    capabilityStatusReason =
      'Withheld: Process temporal stability and approximate normality must be confirmed before reporting Cp/Cpk.';
  } else if (stdDev <= 1e-6) {
    capabilityStatusReason = 'Unavailable: Sample standard deviation is zero.';
  } else {
    const usl = targetValue + tolerance;
    const lsl = targetValue - tolerance;
    cp = (usl - lsl) / (6 * stdDev);
    const cpu = (usl - mean) / (3 * stdDev);
    const cpl = (mean - lsl) / (3 * stdDev);
    cpk = Math.min(cpu, cpl);
    capabilityStatusReason = `Computed over n=${count} verified measurements under confirmed stability.`;
  }

  return {
    count,
    mean,
    stdDev,
    min,
    max,
    meanResidual,
    absMeanResidual,
    rmse,
    maxAbsResidual,
    withinToleranceCount,
    outOfToleranceCount,
    passRatePercent,
    cp,
    cpk,
    capabilityStatusReason,
    unit,
    targetValue,
    tolerance,
  };
}

export interface ExperimentQualityRollup {
  experimentId: string;
  verifiedMeasurementCount: number;
  unverifiedCount: number;
  overallPassRatePercent: number | null;
  rmseBeadWidthMm: number | null;
  rmseBeadHeightMm: number | null;
  rmseXYZResidualMm: number | null;
  qualityStatus:
    | 'Insufficient Data'
    | 'Within Tolerance'
    | 'Marginal Drift'
    | 'Out of Tolerance';
}

export function evaluateExperimentQuality(
  experiment: Experiment,
  allMeasurements: Measurement[]
): ExperimentQualityRollup {
  const expMeasurements = allMeasurements.filter((m) => m.experimentId === experiment.id);
  const verified = expMeasurements.filter(
    (m) => m.verifiedPhysicalMeasurement && m.sourceType !== 'AI-Assisted Annotation'
  );
  const unverifiedCount = expMeasurements.length - verified.length;

  if (verified.length === 0) {
    return {
      experimentId: experiment.id,
      verifiedMeasurementCount: 0,
      unverifiedCount,
      overallPassRatePercent: null,
      rmseBeadWidthMm: null,
      rmseBeadHeightMm: null,
      rmseXYZResidualMm: null,
      qualityStatus: 'Insufficient Data',
    };
  }

  const passCount = verified.filter(
    (m) => Math.abs(m.measuredValue - m.targetValue) <= m.tolerance
  ).length;
  const overallPassRatePercent = (passCount / verified.length) * 100;

  const beadWidthStats = computeMeasurementStatistics(
    verified.filter((m) => m.measurementType === 'bead width')
  );
  const beadHeightStats = computeMeasurementStatistics(
    verified.filter((m) => m.measurementType === 'bead height')
  );
  const xyzStats = computeMeasurementStatistics(
    verified.filter((m) => m.measurementType === 'XYZ residual')
  );

  let qualityStatus: ExperimentQualityRollup['qualityStatus'] = 'Out of Tolerance';
  if (overallPassRatePercent >= 90) {
    qualityStatus = 'Within Tolerance';
  } else if (overallPassRatePercent >= 70) {
    qualityStatus = 'Marginal Drift';
  }

  return {
    experimentId: experiment.id,
    verifiedMeasurementCount: verified.length,
    unverifiedCount,
    overallPassRatePercent,
    rmseBeadWidthMm: beadWidthStats ? beadWidthStats.rmse : null,
    rmseBeadHeightMm: beadHeightStats ? beadHeightStats.rmse : null,
    rmseXYZResidualMm: xyzStats ? xyzStats.rmse : null,
    qualityStatus,
  };
}

export interface DeterministicBoundsEvaluation {
  withinBounds: boolean;
  violations: string[];
  clampedPrintSpeedMmPerSec: number;
  clampedRelativeFlowPercent: number;
  clampedLayerHeightMm: number;
  nominalCrossSectionAreaMm2: number;
  theoreticalVolumetricRateMm3PerSec: number;
}

/**
 * Deterministic parameter bounds check and kinematic geometry calculation.
 * Never extrapolates or invents empirical behavior.
 */
export function evaluateParameterBoundsDeterministically(
  bounds: ParameterBounds,
  printSpeedMmPerSec: number,
  relativeFlowPercent: number,
  layerHeightMm: number,
  targetBeadWidthMm: number
): DeterministicBoundsEvaluation {
  const violations: string[] = [];
  let clampedSpeed = printSpeedMmPerSec;
  let clampedFlow = relativeFlowPercent;
  let clampedLayer = layerHeightMm;

  if (printSpeedMmPerSec < bounds.minPrintSpeedMmPerSec) {
    violations.push(
      `Print speed (${printSpeedMmPerSec} mm/s) is below minimum bound (${bounds.minPrintSpeedMmPerSec} mm/s).`
    );
    clampedSpeed = bounds.minPrintSpeedMmPerSec;
  } else if (printSpeedMmPerSec > bounds.maxPrintSpeedMmPerSec) {
    violations.push(
      `Print speed (${printSpeedMmPerSec} mm/s) exceeds maximum bound (${bounds.maxPrintSpeedMmPerSec} mm/s).`
    );
    clampedSpeed = bounds.maxPrintSpeedMmPerSec;
  }

  if (relativeFlowPercent < bounds.minRelativeFlowPercent) {
    violations.push(
      `Relative flow (${relativeFlowPercent}%) is below minimum bound (${bounds.minRelativeFlowPercent}%).`
    );
    clampedFlow = bounds.minRelativeFlowPercent;
  } else if (relativeFlowPercent > bounds.maxRelativeFlowPercent) {
    violations.push(
      `Relative flow (${relativeFlowPercent}%) exceeds maximum bound (${bounds.maxRelativeFlowPercent}%).`
    );
    clampedFlow = bounds.maxRelativeFlowPercent;
  }

  if (layerHeightMm < bounds.minLayerHeightMm) {
    violations.push(
      `Layer height (${layerHeightMm} mm) is below minimum bound (${bounds.minLayerHeightMm} mm).`
    );
    clampedLayer = bounds.minLayerHeightMm;
  } else if (layerHeightMm > bounds.maxLayerHeightMm) {
    violations.push(
      `Layer height (${layerHeightMm} mm) exceeds maximum bound (${bounds.maxLayerHeightMm} mm).`
    );
    clampedLayer = bounds.maxLayerHeightMm;
  }

  // Oblong capsule cross-sectional area approximation: A = (w - h)*h + pi*(h/2)^2
  const nominalCrossSectionAreaMm2 =
    targetBeadWidthMm >= layerHeightMm
      ? (targetBeadWidthMm - layerHeightMm) * layerHeightMm +
        Math.PI * Math.pow(layerHeightMm / 2, 2)
      : targetBeadWidthMm * layerHeightMm;

  const theoreticalVolumetricRateMm3PerSec =
    nominalCrossSectionAreaMm2 * printSpeedMmPerSec;

  return {
    withinBounds: violations.length === 0,
    violations,
    clampedPrintSpeedMmPerSec: clampedSpeed,
    clampedRelativeFlowPercent: clampedFlow,
    clampedLayerHeightMm: clampedLayer,
    nominalCrossSectionAreaMm2: Number(nominalCrossSectionAreaMm2.toFixed(3)),
    theoreticalVolumetricRateMm3PerSec: Number(
      theoreticalVolumetricRateMm3PerSec.toFixed(2)
    ),
  };
}

export interface EmpiricalInterpolationResult {
  canComputeRecommendation: boolean;
  withheldReason?: string;
  observedTrialsUsed: number;
  empiricalFlowSensitivitySlope: number | null; // mm per 1% flow
  candidateRelativeFlowPercent: number | null;
  candidatePrintSpeedMmPerSec: number | null;
  candidateZOffsetMm: number | null;
  unvalidatedPredictedWidthMm: number | null;
  clampedByBounds: boolean;
  clampedParameters: string[];
  scientificWarning: string;
}

/**
 * Generates an experimental checkpoint candidate ONLY when >= 3 observed empirical trials
 * with distinct flow/speed parameters exist in the session.
 * Never invents optimization recommendations when experimental data is insufficient.
 */
export function evaluateEmpiricalCheckpointCandidate(
  session: CalibrationSession,
  allTrials: CalibrationTrial[],
  currentSpeedMmPerSec: number,
  currentFlowPercent: number,
  currentLayerHeightMm: number,
  observedBeadWidthMm: number,
  observedBeadHeightMm: number
): EmpiricalInterpolationResult {
  const observedTrials = allTrials.filter(
    (t) => t.recordOrigin === 'Observed Experimental Trial'
  );

  if (observedTrials.length < 3) {
    return {
      canComputeRecommendation: false,
      withheldReason: `Insufficient empirical data: ${observedTrials.length} observed trial(s) recorded. At least 3 verified empirical trials spanning distinct parameter states are required before computing an interpolated checkpoint candidate.`,
      observedTrialsUsed: observedTrials.length,
      empiricalFlowSensitivitySlope: null,
      candidateRelativeFlowPercent: null,
      candidatePrintSpeedMmPerSec: null,
      candidateZOffsetMm: null,
      unvalidatedPredictedWidthMm: null,
      clampedByBounds: false,
      clampedParameters: [],
      scientificWarning:
        'Optimization candidate withheld to prevent ungrounded extrapolation.',
    };
  }

  // Ordinary Least Squares linear slope d(Width)/d(Flow%) across observed trials
  const n = observedTrials.length;
  const meanFlow =
    observedTrials.reduce((s, t) => s + t.parameterSet.relativeFlowPercent, 0) / n;
  const meanWidth =
    observedTrials.reduce((s, t) => s + t.measuredOutcome.measuredBeadWidthMm, 0) / n;

  let num = 0;
  let den = 0;
  for (const t of observedTrials) {
    const df = t.parameterSet.relativeFlowPercent - meanFlow;
    const dw = t.measuredOutcome.measuredBeadWidthMm - meanWidth;
    num += df * dw;
    den += df * df;
  }

  if (den < 1e-4 || Math.abs(num / den) < 1e-4) {
    return {
      canComputeRecommendation: false,
      withheldReason:
        'Observed trials do not span sufficient variation in Relative Flow % to estimate empirical sensitivity (collinear or zero variance).',
      observedTrialsUsed: n,
      empiricalFlowSensitivitySlope: null,
      candidateRelativeFlowPercent: null,
      candidatePrintSpeedMmPerSec: null,
      candidateZOffsetMm: null,
      unvalidatedPredictedWidthMm: null,
      clampedByBounds: false,
      clampedParameters: [],
      scientificWarning:
        'Vary Relative Flow % across at least 3 trials to characterize empirical sensitivity.',
    };
  }

  const slope = num / den; // mm per % flow
  const targetWidth = session.targetMetric.targetValue;
  const widthError = targetWidth - observedBeadWidthMm;
  const heightError = currentLayerHeightMm - observedBeadHeightMm;

  const rawFlowDelta = widthError / slope;
  let candidateFlow = Number((currentFlowPercent + rawFlowDelta).toFixed(1));
  let candidateSpeed = Number(currentSpeedMmPerSec.toFixed(1));
  let candidateZOffset = Number((heightError * 0.5).toFixed(2));

  const clampedParameters: string[] = [];
  const bounds = session.parameterBounds;

  if (candidateFlow < bounds.minRelativeFlowPercent) {
    candidateFlow = bounds.minRelativeFlowPercent;
    clampedParameters.push('Relative Flow % (clamped to min bound)');
  } else if (candidateFlow > bounds.maxRelativeFlowPercent) {
    candidateFlow = bounds.maxRelativeFlowPercent;
    clampedParameters.push('Relative Flow % (clamped to max bound)');
  }

  if (Math.abs(candidateZOffset) > 1.5) {
    candidateZOffset = Math.sign(candidateZOffset) * 1.5;
    clampedParameters.push('Nozzle Z Offset mm (±1.5 mm safety bound)');
  }

  const effectiveFlowDelta = candidateFlow - currentFlowPercent;
  const unvalidatedPredictedWidthMm = Number(
    (observedBeadWidthMm + effectiveFlowDelta * slope).toFixed(2)
  );

  return {
    canComputeRecommendation: true,
    observedTrialsUsed: n,
    empiricalFlowSensitivitySlope: Number(slope.toFixed(4)),
    candidateRelativeFlowPercent: candidateFlow,
    candidatePrintSpeedMmPerSec: candidateSpeed,
    candidateZOffsetMm: candidateZOffset,
    unvalidatedPredictedWidthMm,
    clampedByBounds: clampedParameters.length > 0,
    clampedParameters,
    scientificWarning:
      'UNVALIDATED CANDIDATE: Linear interpolation from empirical trials. Requires physical verification run before acceptance.',
  };
}

export interface StreamCorrelationPrecheck {
  canCorrelate: boolean;
  issues: string[];
  commonCoordinateFrame: string | null;
  synchronizationStatus: string;
}

/**
 * Verifies whether ProcessObservations and Measurements can be scientifically correlated.
 * Requires explicit clock synchronization alignment and matching coordinate frames.
 */
export function verifyStreamCorrelationCompatibility(
  observations: ProcessObservation[],
  measurements: Measurement[]
): StreamCorrelationPrecheck {
  const issues: string[] = [];

  if (observations.length === 0) {
    issues.push('No process observation streams recorded for this experiment.');
  }
  if (measurements.length === 0) {
    issues.push('No physical measurements recorded for this experiment.');
  }

  const unsyncedObs = observations.filter(
    (o) => o.clockSyncStatus === 'Unsynchronized Local Clock'
  );
  if (unsyncedObs.length > 0) {
    issues.push(
      `${unsyncedObs.length} observation record(s) use an Unsynchronized Local Clock. Explicit timestamp alignment (NTP/PTP or manual offset) is required before temporal correlation.`
    );
  }

  const obsFrames = Array.from(new Set(observations.map((o) => o.coordinateFrame)));
  const measFrames = Array.from(new Set(measurements.map((m) => m.coordinateFrame)));
  const allFrames = Array.from(new Set([...obsFrames, ...measFrames]));

  if (allFrames.length > 1) {
    issues.push(
      `Coordinate frame mismatch detected across streams: [${allFrames.join(', ')}]. Streams must share a consistent coordinate frame before spatial correlation.`
    );
  }

  return {
    canCorrelate: issues.length === 0,
    issues,
    commonCoordinateFrame: allFrames.length === 1 ? allFrames[0] : null,
    synchronizationStatus:
      unsyncedObs.length === 0 && observations.length > 0
        ? 'Synchronized / Aligned'
        : 'Unsynchronized / Alignment Required',
  };
}

export interface ProductionEfficiencySummary {
  experimentId: string;
  totalPartsAttempted: number;
  acceptedPartCount: number;
  rejectedPartCount: number;
  yieldRatePercent: number;
  totalMaterialMassG: number;
  wasteRatioPercent: number;
  totalCycleDurationMin: number;
  calibrationOverheadPercent: number;
  estimatedTotalCostEur: number;
  costPerAcceptedPartEur: number | null;
}

export function computeProductionEfficiency(
  record: ProductionMetricRecord
): ProductionEfficiencySummary {
  const totalPartsAttempted = record.acceptedPartCount + record.rejectedPartCount;
  const yieldRatePercent =
    totalPartsAttempted > 0 ? (record.acceptedPartCount / totalPartsAttempted) * 100 : 0;

  const totalMaterialMassG = record.materialUsed + record.materialWaste;
  const wasteRatioPercent =
    totalMaterialMassG > 0 ? (record.materialWaste / totalMaterialMassG) * 100 : 0;

  const totalCycleDurationMin =
    record.setupDuration +
    record.printDuration +
    record.calibrationDuration +
    record.downtime;

  const calibrationOverheadPercent =
    totalCycleDurationMin > 0
      ? (record.calibrationDuration / totalCycleDurationMin) * 100
      : 0;

  const materialCostEur =
    (totalMaterialMassG / 1000) * record.manuallyEnteredCostInputs.materialCostPerKgEur;
  const machineHours = (record.printDuration + record.calibrationDuration) / 60;
  const operatorHours =
    (record.setupDuration + record.calibrationDuration + record.downtime) / 60;

  const estimatedTotalCostEur =
    materialCostEur +
    machineHours * record.manuallyEnteredCostInputs.machineHourlyRateEur +
    operatorHours * record.manuallyEnteredCostInputs.operatorHourlyRateEur;

  const costPerAcceptedPartEur =
    record.acceptedPartCount > 0 ? estimatedTotalCostEur / record.acceptedPartCount : null;

  return {
    experimentId: record.experimentId,
    totalPartsAttempted,
    acceptedPartCount: record.acceptedPartCount,
    rejectedPartCount: record.rejectedPartCount,
    yieldRatePercent,
    totalMaterialMassG,
    wasteRatioPercent,
    totalCycleDurationMin,
    calibrationOverheadPercent,
    estimatedTotalCostEur,
    costPerAcceptedPartEur,
  };
}

export interface MethodComparisonSummary {
  baselineExperimentCode: string;
  proposedExperimentCode: string;
  beadWidthRmseDeltaPercent: number | null;
  passRateDeltaPoints: number | null;
  yieldDeltaPoints: number | null;
  wasteRatioDeltaPoints: number | null;
  costPerAcceptedPartDeltaPercent: number | null;
}

export function compareExperimentToBaseline(
  baselineExp: Experiment,
  proposedExp: Experiment,
  allMeasurements: Measurement[],
  allProductionRecords: ProductionMetricRecord[]
): MethodComparisonSummary {
  const baseQuality = evaluateExperimentQuality(baselineExp, allMeasurements);
  const propQuality = evaluateExperimentQuality(proposedExp, allMeasurements);

  let beadWidthRmseDeltaPercent: number | null = null;
  if (
    baseQuality.rmseBeadWidthMm !== null &&
    propQuality.rmseBeadWidthMm !== null &&
    baseQuality.rmseBeadWidthMm > 1e-6
  ) {
    beadWidthRmseDeltaPercent =
      ((propQuality.rmseBeadWidthMm - baseQuality.rmseBeadWidthMm) /
        baseQuality.rmseBeadWidthMm) *
      100;
  }

  let passRateDeltaPoints: number | null = null;
  if (
    baseQuality.overallPassRatePercent !== null &&
    propQuality.overallPassRatePercent !== null
  ) {
    passRateDeltaPoints =
      propQuality.overallPassRatePercent - baseQuality.overallPassRatePercent;
  }

  const baseProd = allProductionRecords.find((r) => r.experimentId === baselineExp.id);
  const propProd = allProductionRecords.find((r) => r.experimentId === proposedExp.id);

  let yieldDeltaPoints: number | null = null;
  let wasteRatioDeltaPoints: number | null = null;
  let costPerAcceptedPartDeltaPercent: number | null = null;

  if (baseProd && propProd) {
    const baseEff = computeProductionEfficiency(baseProd);
    const propEff = computeProductionEfficiency(propProd);
    yieldDeltaPoints = propEff.yieldRatePercent - baseEff.yieldRatePercent;
    wasteRatioDeltaPoints = propEff.wasteRatioPercent - baseEff.wasteRatioPercent;

    if (
      baseEff.costPerAcceptedPartEur !== null &&
      propEff.costPerAcceptedPartEur !== null &&
      baseEff.costPerAcceptedPartEur > 1e-6
    ) {
      costPerAcceptedPartDeltaPercent =
        ((propEff.costPerAcceptedPartEur - baseEff.costPerAcceptedPartEur) /
          baseEff.costPerAcceptedPartEur) *
        100;
    }
  }

  return {
    baselineExperimentCode: baselineExp.experimentCode,
    proposedExperimentCode: proposedExp.experimentCode,
    beadWidthRmseDeltaPercent,
    passRateDeltaPoints,
    yieldDeltaPoints,
    wasteRatioDeltaPoints,
    costPerAcceptedPartDeltaPercent,
  };
}
