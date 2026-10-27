import {
  AssemblyVerification,
  CalibrationSession,
  CalibrationTrial,
  Experiment,
  Measurement,
  NodeFeatureDefinition,
  ParameterBounds,
  PhysicalStage,
  ProcessObservation,
  ProductionMetricRecord,
  Specimen,
  SpecimenAcceptanceStatus,
} from '../domain/models';

export const MIN_SAMPLE_SIZE_FOR_CAPABILITY_INDEX = 25;

export interface ToleranceEvaluationResult {
  residual: number;
  absResidual: number;
  lowerBoundValue: number;
  upperBoundValue: number;
  lowerDelta: number;
  upperDelta: number;
  isAsymmetric: boolean;
  stageCompatible: boolean;
  withinTolerance: boolean | null;
  status:
    | 'PASS'
    | 'FAIL_LOW'
    | 'FAIL_HIGH'
    | 'STAGE_MISMATCH_WITHHELD'
    | 'STAGE_UNKNOWN_WITHHELD'
    | 'INVALID_INPUT_WITHHELD'
    | 'UNIT_MISMATCH_WITHHELD';
  explanation: string;
}

/**
 * Evaluates a single physical or feature measurement against symmetric (±tolerance)
 * or asymmetric ([lowerTolerance/toleranceLower, upperTolerance/toleranceUpper]) bounds,
 * enforcing physical stage compatibility, finite numeric inputs, and unit consistency.
 */
export function evaluateFeatureMeasurementTolerance(m: {
  measuredValue: number;
  targetValue: number;
  tolerance: number;
  unit: string;
  toleranceLower?: number;
  toleranceUpper?: number;
  lowerTolerance?: number;
  upperTolerance?: number;
  physicalStage?: PhysicalStage;
  targetStage?: PhysicalStage;
  expectedUnit?: string;
}): ToleranceEvaluationResult {
  if (!Number.isFinite(m.measuredValue) || !Number.isFinite(m.targetValue)) {
    return {
      residual: NaN,
      absResidual: NaN,
      lowerBoundValue: NaN,
      upperBoundValue: NaN,
      lowerDelta: NaN,
      upperDelta: NaN,
      isAsymmetric: false,
      stageCompatible: false,
      withinTolerance: null,
      status: 'INVALID_INPUT_WITHHELD',
      explanation:
        'Withheld: Measured value and target value must be finite numbers.',
    };
  }

  if (
    m.expectedUnit &&
    m.unit &&
    m.expectedUnit.trim().toLowerCase() !== m.unit.trim().toLowerCase()
  ) {
    return {
      residual: m.measuredValue - m.targetValue,
      absResidual: Math.abs(m.measuredValue - m.targetValue),
      lowerBoundValue: NaN,
      upperBoundValue: NaN,
      lowerDelta: NaN,
      upperDelta: NaN,
      isAsymmetric: false,
      stageCompatible: false,
      withinTolerance: null,
      status: 'UNIT_MISMATCH_WITHHELD',
      explanation: `Withheld: Measurement unit '${m.unit}' does not match expected feature unit '${m.expectedUnit}'.`,
    };
  }

  const rawLower =
    typeof m.lowerTolerance === 'number' && Number.isFinite(m.lowerTolerance)
      ? m.lowerTolerance
      : typeof m.toleranceLower === 'number' && Number.isFinite(m.toleranceLower)
      ? m.toleranceLower
      : null;

  const rawUpper =
    typeof m.upperTolerance === 'number' && Number.isFinite(m.upperTolerance)
      ? m.upperTolerance
      : typeof m.toleranceUpper === 'number' && Number.isFinite(m.toleranceUpper)
      ? m.toleranceUpper
      : null;

  const hasSymmetricTol =
    typeof m.tolerance === 'number' && Number.isFinite(m.tolerance) && m.tolerance > 0;

  if (rawLower === null && rawUpper === null && !hasSymmetricTol) {
    return {
      residual: m.measuredValue - m.targetValue,
      absResidual: Math.abs(m.measuredValue - m.targetValue),
      lowerBoundValue: NaN,
      upperBoundValue: NaN,
      lowerDelta: NaN,
      upperDelta: NaN,
      isAsymmetric: false,
      stageCompatible: false,
      withinTolerance: null,
      status: 'INVALID_INPUT_WITHHELD',
      explanation:
        'Withheld: Tolerance bounds must be positive finite numbers.',
    };
  }

  const lowerDelta =
    rawLower !== null
      ? rawLower <= 0
        ? rawLower
        : -Math.abs(rawLower)
      : -Math.abs(m.tolerance);

  const upperDelta =
    rawUpper !== null ? Math.abs(rawUpper) : Math.abs(m.tolerance);

  if (
    !Number.isFinite(lowerDelta) ||
    !Number.isFinite(upperDelta) ||
    upperDelta - lowerDelta <= 0
  ) {
    return {
      residual: m.measuredValue - m.targetValue,
      absResidual: Math.abs(m.measuredValue - m.targetValue),
      lowerBoundValue: NaN,
      upperBoundValue: NaN,
      lowerDelta: NaN,
      upperDelta: NaN,
      isAsymmetric: false,
      stageCompatible: false,
      withinTolerance: null,
      status: 'INVALID_INPUT_WITHHELD',
      explanation:
        'Withheld: Invalid tolerance interval (upper bound must exceed lower bound).',
    };
  }

  const isAsymmetric = Math.abs(Math.abs(lowerDelta) - Math.abs(upperDelta)) > 1e-6;
  const lowerBoundValue = m.targetValue + lowerDelta;
  const upperBoundValue = m.targetValue + upperDelta;
  const residual = m.measuredValue - m.targetValue;
  const absResidual = Math.abs(residual);

  const physStage = m.physicalStage || 'Stage Unknown';
  const targStage = m.targetStage || 'Stage Unknown';

  // If a specific target stage (GREEN, DRY, FIRED) is specified, enforce stage matching
  if (targStage !== 'Stage Unknown') {
    if (physStage === 'Stage Unknown') {
      return {
        residual,
        absResidual,
        lowerBoundValue,
        upperBoundValue,
        lowerDelta,
        upperDelta,
        isAsymmetric,
        stageCompatible: false,
        withinTolerance: null,
        status: 'STAGE_UNKNOWN_WITHHELD',
        explanation: `Withheld: Target tolerance is defined at stage ${targStage}, but measurement physicalStage is 'Stage Unknown'.`,
      };
    }
    if (physStage !== targStage) {
      return {
        residual,
        absResidual,
        lowerBoundValue,
        upperBoundValue,
        lowerDelta,
        upperDelta,
        isAsymmetric,
        stageCompatible: false,
        withinTolerance: null,
        status: 'STAGE_MISMATCH_WITHHELD',
        explanation: `Withheld: Measurement was recorded at stage ${physStage}, which cannot be directly evaluated against ${targStage} stage tolerance bounds without shrinkage transformation.`,
      };
    }
  }

  if (m.measuredValue < lowerBoundValue - 1e-9) {
    return {
      residual,
      absResidual,
      lowerBoundValue,
      upperBoundValue,
      lowerDelta,
      upperDelta,
      isAsymmetric,
      stageCompatible: true,
      withinTolerance: false,
      status: 'FAIL_LOW',
      explanation: `Below lower tolerance bound (${lowerBoundValue.toFixed(2)} ${m.unit}).`,
    };
  }

  if (m.measuredValue > upperBoundValue + 1e-9) {
    return {
      residual,
      absResidual,
      lowerBoundValue,
      upperBoundValue,
      lowerDelta,
      upperDelta,
      isAsymmetric,
      stageCompatible: true,
      withinTolerance: false,
      status: 'FAIL_HIGH',
      explanation: `Exceeds upper tolerance bound (${upperBoundValue.toFixed(2)} ${m.unit}).`,
    };
  }

  return {
    residual,
    absResidual,
    lowerBoundValue,
    upperBoundValue,
    lowerDelta,
    upperDelta,
    isAsymmetric,
    stageCompatible: true,
    withinTolerance: true,
    status: 'PASS',
    explanation: `Within tolerance [${lowerBoundValue.toFixed(2)}, ${upperBoundValue.toFixed(2)}] ${m.unit}.`,
  };
}

export interface StageShrinkageResult {
  canCompute: boolean;
  withheldReason?: string;
  transitionLabel: 'GREEN -> DRY' | 'DRY -> FIRED' | 'GREEN -> FIRED' | 'INVALID';
  initialStage: PhysicalStage;
  subsequentStage: PhysicalStage;
  initialValue: number;
  subsequentValue: number;
  unit: string;
  absoluteDimensionalChange: number | null; // D_initial - D_subsequent
  linearShrinkagePercent: number | null; // ((D_initial - D_subsequent) / D_initial) * 100
  expansionAnomalyDetected: boolean;
}

const STAGE_ORDER: Record<string, number> = {
  GREEN: 1,
  DRY: 2,
  FIRED: 3,
};

/**
 * Computes stage-to-stage linear ceramic shrinkage:
 * Shrinkage (%) = ((D_initial - D_subsequent) / D_initial) * 100
 * Never fabricates shrinkage values if either stage is missing/unknown or reversed.
 */
export function computeStageToStageShrinkage(
  initialMeas: Pick<
    Measurement,
    | 'specimenId'
    | 'specimenRecordId'
    | 'featureId'
    | 'measurementType'
    | 'physicalStage'
    | 'measuredValue'
    | 'unit'
  >,
  subsequentMeas: Pick<
    Measurement,
    | 'specimenId'
    | 'specimenRecordId'
    | 'featureId'
    | 'measurementType'
    | 'physicalStage'
    | 'measuredValue'
    | 'unit'
  >
): StageShrinkageResult {
  const stageA = initialMeas.physicalStage || 'Stage Unknown';
  const stageB = subsequentMeas.physicalStage || 'Stage Unknown';

  const orderA = STAGE_ORDER[stageA];
  const orderB = STAGE_ORDER[stageB];

  if (!orderA || !orderB) {
    return {
      canCompute: false,
      withheldReason: `Cannot compute shrinkage when physicalStage is '${stageA}' or '${stageB}'. Both measurements must have explicit GREEN, DRY, or FIRED stage tags.`,
      transitionLabel: 'INVALID',
      initialStage: stageA,
      subsequentStage: stageB,
      initialValue: initialMeas.measuredValue,
      subsequentValue: subsequentMeas.measuredValue,
      unit: initialMeas.unit,
      absoluteDimensionalChange: null,
      linearShrinkagePercent: null,
      expansionAnomalyDetected: false,
    };
  }

  if (orderA >= orderB) {
    return {
      canCompute: false,
      withheldReason: `Invalid stage sequence (${stageA} -> ${stageB}). Shrinkage requires chronological progression (GREEN -> DRY, DRY -> FIRED, or GREEN -> FIRED).`,
      transitionLabel: 'INVALID',
      initialStage: stageA,
      subsequentStage: stageB,
      initialValue: initialMeas.measuredValue,
      subsequentValue: subsequentMeas.measuredValue,
      unit: initialMeas.unit,
      absoluteDimensionalChange: null,
      linearShrinkagePercent: null,
      expansionAnomalyDetected: false,
    };
  }

  const sameSpecimenCode = initialMeas.specimenId === subsequentMeas.specimenId;
  const conflictingRecordId =
    Boolean(initialMeas.specimenRecordId) &&
    Boolean(subsequentMeas.specimenRecordId) &&
    initialMeas.specimenRecordId !== subsequentMeas.specimenRecordId;

  if (!sameSpecimenCode || conflictingRecordId) {
    return {
      canCompute: false,
      withheldReason: `Specimen mismatch (${initialMeas.specimenId} vs ${subsequentMeas.specimenId}). Stage-to-stage shrinkage must be computed on the same physical specimen.`,
      transitionLabel: 'INVALID',
      initialStage: stageA,
      subsequentStage: stageB,
      initialValue: initialMeas.measuredValue,
      subsequentValue: subsequentMeas.measuredValue,
      unit: initialMeas.unit,
      absoluteDimensionalChange: null,
      linearShrinkagePercent: null,
      expansionAnomalyDetected: false,
    };
  }

  if (
    (initialMeas.featureId || '') !== (subsequentMeas.featureId || '') ||
    initialMeas.measurementType !== subsequentMeas.measurementType ||
    initialMeas.unit !== subsequentMeas.unit
  ) {
    return {
      canCompute: false,
      withheldReason:
        'Feature ID, measurement type, and physical unit must match to compute stage-to-stage shrinkage.',
      transitionLabel: 'INVALID',
      initialStage: stageA,
      subsequentStage: stageB,
      initialValue: initialMeas.measuredValue,
      subsequentValue: subsequentMeas.measuredValue,
      unit: initialMeas.unit,
      absoluteDimensionalChange: null,
      linearShrinkagePercent: null,
      expansionAnomalyDetected: false,
    };
  }

  if (
    !Number.isFinite(initialMeas.measuredValue) ||
    initialMeas.measuredValue <= 0 ||
    !Number.isFinite(subsequentMeas.measuredValue) ||
    subsequentMeas.measuredValue <= 0
  ) {
    return {
      canCompute: false,
      withheldReason: 'Measured dimensions must be positive finite numbers.',
      transitionLabel: 'INVALID',
      initialStage: stageA,
      subsequentStage: stageB,
      initialValue: initialMeas.measuredValue,
      subsequentValue: subsequentMeas.measuredValue,
      unit: initialMeas.unit,
      absoluteDimensionalChange: null,
      linearShrinkagePercent: null,
      expansionAnomalyDetected: false,
    };
  }

  const transitionLabel = `${stageA} -> ${stageB}` as
    | 'GREEN -> DRY'
    | 'DRY -> FIRED'
    | 'GREEN -> FIRED';

  const absoluteDimensionalChange =
    initialMeas.measuredValue - subsequentMeas.measuredValue;
  const linearShrinkagePercent =
    (absoluteDimensionalChange / initialMeas.measuredValue) * 100;

  return {
    canCompute: true,
    transitionLabel,
    initialStage: stageA,
    subsequentStage: stageB,
    initialValue: initialMeas.measuredValue,
    subsequentValue: subsequentMeas.measuredValue,
    unit: initialMeas.unit,
    absoluteDimensionalChange: Number(absoluteDimensionalChange.toFixed(4)),
    linearShrinkagePercent: Number(linearShrinkagePercent.toFixed(3)),
    expansionAnomalyDetected: linearShrinkagePercent < 0,
  };
}

/**
 * Computes 3D Euclidean positional residual between measured and nominal coordinates (mm).
 */
export function computeEuclideanPositionalResidual(
  actual: { xMm: number; yMm: number; zMm: number },
  nominal: { xMm: number; yMm: number; zMm: number }
): number | null {
  if (
    !Number.isFinite(actual.xMm) ||
    !Number.isFinite(actual.yMm) ||
    !Number.isFinite(actual.zMm) ||
    !Number.isFinite(nominal.xMm) ||
    !Number.isFinite(nominal.yMm) ||
    !Number.isFinite(nominal.zMm)
  ) {
    return null;
  }
  const dx = actual.xMm - nominal.xMm;
  const dy = actual.yMm - nominal.yMm;
  const dz = actual.zMm - nominal.zMm;
  return Number(Math.sqrt(dx * dx + dy * dy + dz * dz).toFixed(4));
}

/**
 * Computes joint axis or branch angular deviation in degrees.
 */
export function computeJointAxisAngularDeviationDeg(
  measuredAngleDeg: number,
  nominalAngleDeg: number,
  toleranceDeg: number
): {
  residualDeg: number;
  absResidualDeg: number;
  withinTolerance: boolean;
} | null {
  if (
    !Number.isFinite(measuredAngleDeg) ||
    !Number.isFinite(nominalAngleDeg) ||
    !Number.isFinite(toleranceDeg) ||
    toleranceDeg <= 0
  ) {
    return null;
  }
  const residualDeg = Number((measuredAngleDeg - nominalAngleDeg).toFixed(3));
  const absResidualDeg = Number(Math.abs(residualDeg).toFixed(3));
  return {
    residualDeg,
    absResidualDeg,
    withinTolerance: absResidualDeg <= toleranceDeg + 1e-9,
  };
}

export interface DiametralClearanceResult {
  clearanceMm: number;
  fitClassification:
    | 'Interference / No-Go'
    | 'Transition / Snug Fit'
    | 'Clearance Fit'
    | 'Excessive Play';
  withinClearanceWindow: boolean;
  scientificNote: string;
}

/**
 * Computes socket-to-member diametral clearance:
 * Clearance = Internal Socket Diameter - External Member Diameter
 * Explicitly notes that scalar clearance does not replace physical insertion verification.
 */
export function computeDiametralClearance(
  internalSocketDiameterMm: number,
  externalMemberDiameterMm: number,
  minRequiredClearanceMm = 0.2,
  maxAllowedClearanceMm = 1.5
): DiametralClearanceResult | null {
  if (
    !Number.isFinite(internalSocketDiameterMm) ||
    internalSocketDiameterMm <= 0 ||
    !Number.isFinite(externalMemberDiameterMm) ||
    externalMemberDiameterMm <= 0
  ) {
    return null;
  }

  const clearanceMm = Number(
    (internalSocketDiameterMm - externalMemberDiameterMm).toFixed(3)
  );

  let fitClassification: DiametralClearanceResult['fitClassification'] = 'Clearance Fit';
  if (clearanceMm < 0) {
    fitClassification = 'Interference / No-Go';
  } else if (clearanceMm < minRequiredClearanceMm) {
    fitClassification = 'Transition / Snug Fit';
  } else if (clearanceMm > maxAllowedClearanceMm) {
    fitClassification = 'Excessive Play';
  }

  const withinClearanceWindow =
    clearanceMm >= minRequiredClearanceMm - 1e-9 &&
    clearanceMm <= maxAllowedClearanceMm + 1e-9;

  return {
    clearanceMm,
    fitClassification,
    withinClearanceWindow,
    scientificNote:
      'COMPUTED SCALAR CLEARANCE ONLY: Does not account for 3D socket ovality, taper, or surface roughness. Physical Assembly Verification test is required before marking specimen Assembly Accepted.',
  };
}

export interface SpecimenAcceptanceEvaluation {
  specimenCode: string;
  status: SpecimenAcceptanceStatus;
  verifiedMeasurementCount: number;
  evaluatedAtTargetStageCount: number;
  failedFeatureIds: string[];
  missingCriticalFeatureIds: string[];
  hasPhysicalAssemblyPass: boolean;
  hasPhysicalAssemblyFail: boolean;
  rationale: string;
}

/**
 * Evaluates a ceramic node or extrusion specimen's geometric and assembly acceptance status.
 *
 * Scientific Rigor Rules:
 * 1. Never marks a specimen 'Assembly Accepted' based solely on dimensional measurements.
 *    Requires an explicit physical AssemblyVerification record with verificationResult === 'PASS'
 *    or passFailStatus === 'PASS' (excluding NOT_TESTED / PENDING records).
 * 2. Strict specimen attribution prevents cross-specimen measurement leakage.
 * 3. If required critical features are defined, checks that each critical feature has a verified
 *    measurement at its targetPhysicalStage (or stageTargets matching the specimen's stage).
 */
export function evaluateSpecimenAcceptance(
  specimen: Pick<Specimen, 'id' | 'specimenCode' | 'currentPhysicalStage'> & {
    experimentId?: string;
  },
  allMeasurements: Measurement[],
  allAssemblyVerifications: AssemblyVerification[],
  requiredFeatures: NodeFeatureDefinition[] = []
): SpecimenAcceptanceEvaluation {
  const specMeas = allMeasurements.filter((m) => {
    if (m.specimenRecordId && specimen.id) {
      if (m.specimenRecordId !== specimen.id) return false;
    } else if (m.specimenId !== specimen.specimenCode) {
      return false;
    }
    if (specimen.experimentId && m.experimentId && m.experimentId !== specimen.experimentId) {
      return false;
    }
    return (
      m.verifiedPhysicalMeasurement &&
      m.sourceType !== 'AI-Assisted Annotation' &&
      m.sourceType !== 'Computed'
    );
  });

  const specAssm = allAssemblyVerifications.filter((a) => {
    if (a.specimenRecordId && specimen.id) {
      if (a.specimenRecordId !== specimen.id) return false;
    } else if (
      a.specimenId !== specimen.id &&
      a.specimenId !== specimen.specimenCode &&
      a.specimenCode !== specimen.specimenCode
    ) {
      return false;
    }
    if (specimen.experimentId && a.experimentId && a.experimentId !== specimen.experimentId) {
      return false;
    }
    return true;
  });

  const isFailedAssembly = (a: AssemblyVerification): boolean =>
    a.verificationResult === 'FAIL' ||
    a.passFailStatus === 'FAIL' ||
    a.physicalFitResult === 'Fail';

  const isPassedAssembly = (a: AssemblyVerification): boolean =>
    !isFailedAssembly(a) &&
    a.verificationResult !== 'NOT_TESTED' &&
    a.verificationResult !== 'PENDING' &&
    a.passFailStatus !== 'NOT_TESTED' &&
    a.passFailStatus !== 'PENDING' &&
    a.physicalFitResult !== 'Untested' &&
    a.fitClassification !== 'Not Tested' &&
    (a.verificationResult === 'PASS' ||
      a.passFailStatus === 'PASS' ||
      a.physicalFitResult === 'Pass');

  const hasPhysicalAssemblyFail = specAssm.some(isFailedAssembly);
  const hasPhysicalAssemblyPass =
    !hasPhysicalAssemblyFail && specAssm.some(isPassedAssembly);

  const executedAssmCount = specAssm.filter(
    (a) => isFailedAssembly(a) || isPassedAssembly(a)
  ).length;

  const isFeatureCritical = (f: NodeFeatureDefinition): boolean =>
    f.criticalForAssembly ?? f.assemblyCritical ?? false;

  const getCanonicalFeatureKey = (f: NodeFeatureDefinition): string =>
    f.featureCode || f.featureId || f.id;

  const matchesFeature = (m: Measurement, f: NodeFeatureDefinition): boolean => {
    if (!m.featureId) return false;
    return (
      m.featureId === f.id ||
      m.featureId === f.featureCode ||
      (Boolean(f.featureId) && m.featureId === f.featureId)
    );
  };

  if (specMeas.length === 0 && executedAssmCount === 0) {
    return {
      specimenCode: specimen.specimenCode,
      status: 'Inspection Pending',
      verifiedMeasurementCount: 0,
      evaluatedAtTargetStageCount: 0,
      failedFeatureIds: [],
      missingCriticalFeatureIds: requiredFeatures
        .filter(isFeatureCritical)
        .map(getCanonicalFeatureKey),
      hasPhysicalAssemblyPass: false,
      hasPhysicalAssemblyFail: false,
      rationale: 'No verified physical measurements or executed assembly tests recorded yet.',
    };
  }

  if (hasPhysicalAssemblyFail) {
    return {
      specimenCode: specimen.specimenCode,
      status: 'Assembly Rejected',
      verifiedMeasurementCount: specMeas.length,
      evaluatedAtTargetStageCount: specMeas.length,
      failedFeatureIds: [],
      missingCriticalFeatureIds: [],
      hasPhysicalAssemblyPass: false,
      hasPhysicalAssemblyFail: true,
      rationale:
        'Specimen failed physical assembly verification (interference, excessive play, or insertion damage).',
    };
  }

  const criticalFeatures = requiredFeatures.filter(isFeatureCritical);
  const missingCriticalFeatureIds: string[] = [];
  const failedFeatureIds: string[] = [];
  let evaluatedAtTargetStageCount = 0;

  if (criticalFeatures.length > 0) {
    for (const feat of criticalFeatures) {
      const featureKey = getCanonicalFeatureKey(feat);
      const explicitTargetStage =
        feat.targetPhysicalStage || feat.targetEvaluatedStage || 'Stage Unknown';

      // Match measurements at the feature's target stage, or at a stage defined in feat.stageTargets matching specimen.currentPhysicalStage
      const matchingStageMeas = specMeas.filter((m) => {
        if (!matchesFeature(m, feat)) return false;
        if (explicitTargetStage !== 'Stage Unknown' && m.physicalStage === explicitTargetStage) {
          return true;
        }
        if (
          feat.stageTargets &&
          feat.stageTargets.length > 0 &&
          m.physicalStage === specimen.currentPhysicalStage &&
          feat.stageTargets.some((st) => st.stage === m.physicalStage)
        ) {
          return true;
        }
        return explicitTargetStage === 'Stage Unknown';
      });

      if (matchingStageMeas.length === 0) {
        missingCriticalFeatureIds.push(featureKey);
      } else {
        for (const m of matchingStageMeas) {
          const stageTargetSpec = feat.stageTargets?.find(
            (st) => st.stage === m.physicalStage
          );
          const effectiveTargetStage = stageTargetSpec
            ? stageTargetSpec.stage
            : explicitTargetStage;

          const effectiveTargetValue = stageTargetSpec
            ? stageTargetSpec.targetValue
            : m.targetValue;

          const effectiveTol =
            stageTargetSpec?.tolerancePlusMinus ??
            feat.geometricToleranceDefinition?.tolerancePlusMinus ??
            m.tolerance;

          const effectiveLower =
            m.lowerTolerance ??
            m.toleranceLower ??
            stageTargetSpec?.lowerTolerance ??
            feat.geometricToleranceDefinition?.lowerTolerance ??
            feat.toleranceLower;

          const effectiveUpper =
            m.upperTolerance ??
            m.toleranceUpper ??
            stageTargetSpec?.upperTolerance ??
            feat.geometricToleranceDefinition?.upperTolerance ??
            feat.toleranceUpper;

          const tolEval = evaluateFeatureMeasurementTolerance({
            ...m,
            targetValue: effectiveTargetValue,
            tolerance: effectiveTol,
            targetStage: effectiveTargetStage,
            lowerTolerance: effectiveLower,
            upperTolerance: effectiveUpper,
            expectedUnit:
              feat.nominalDimensions?.unit ||
              feat.geometricToleranceDefinition?.unit,
          });
          if (tolEval.stageCompatible) {
            evaluatedAtTargetStageCount++;
            if (tolEval.withinTolerance === false) {
              failedFeatureIds.push(featureKey);
            }
          }
        }
      }
    }
  } else {
    // Evaluate all verified measurements on the specimen
    for (const m of specMeas) {
      const tolEval = evaluateFeatureMeasurementTolerance(m);
      if (tolEval.stageCompatible) {
        evaluatedAtTargetStageCount++;
        if (tolEval.withinTolerance === false) {
          failedFeatureIds.push(m.featureId || m.measurementType);
        }
      }
    }
  }

  if (failedFeatureIds.length > 0) {
    return {
      specimenCode: specimen.specimenCode,
      status: 'Geometrically Rejected',
      verifiedMeasurementCount: specMeas.length,
      evaluatedAtTargetStageCount,
      failedFeatureIds: Array.from(new Set(failedFeatureIds)),
      missingCriticalFeatureIds,
      hasPhysicalAssemblyPass,
      hasPhysicalAssemblyFail: false,
      rationale: `Out of tolerance on feature(s): ${Array.from(new Set(failedFeatureIds)).join(', ')}.`,
    };
  }

  if (missingCriticalFeatureIds.length > 0 || evaluatedAtTargetStageCount === 0) {
    return {
      specimenCode: specimen.specimenCode,
      status: 'Insufficient Data',
      verifiedMeasurementCount: specMeas.length,
      evaluatedAtTargetStageCount,
      failedFeatureIds: [],
      missingCriticalFeatureIds,
      hasPhysicalAssemblyPass,
      hasPhysicalAssemblyFail: false,
      rationale:
        missingCriticalFeatureIds.length > 0
          ? `Missing target-stage measurements for critical feature(s): ${missingCriticalFeatureIds.join(', ')}.`
          : 'Measurements do not match target tolerance physical stage.',
    };
  }

  if (hasPhysicalAssemblyPass) {
    return {
      specimenCode: specimen.specimenCode,
      status: 'Assembly Accepted',
      verifiedMeasurementCount: specMeas.length,
      evaluatedAtTargetStageCount,
      failedFeatureIds: [],
      missingCriticalFeatureIds: [],
      hasPhysicalAssemblyPass: true,
      hasPhysicalAssemblyFail: false,
      rationale:
        'All critical features within tolerance at target stage AND verified by physical mating assembly test (PASS).',
    };
  }

  return {
    specimenCode: specimen.specimenCode,
    status: 'Geometrically Accepted',
    verifiedMeasurementCount: specMeas.length,
    evaluatedAtTargetStageCount,
    failedFeatureIds: [],
    missingCriticalFeatureIds: [],
    hasPhysicalAssemblyPass: false,
    hasPhysicalAssemblyFail: false,
    rationale:
      'Geometrically within tolerance at target stage. Physical assembly test is still required before Assembly Acceptance.',
  };
}

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
  physicalStageSummary?: string;
}

/**
 * Computes statistical metrics for a homogeneous set of physical measurements
 * (same measurementType, unit, and compatible physicalStage).
 *
 * Scientific Rigor Rules:
 * 1. Excludes unverified or AI-Assisted Annotations unless explicitly toggled.
 * 2. Prevents accidental aggregation across incompatible physical stages (e.g., mixing GREEN and DRY).
 * 3. Calculates Cp/Cpk ONLY when n >= 25 and process stability / non-zero variance assumptions
 *    are satisfied. Otherwise returns null for Cp/Cpk with an explicit explanation.
 */
export function computeMeasurementStatistics(
  measurements: Measurement[],
  options: {
    includeUnverifiedAi?: boolean;
    stabilityVerifiedByUser?: boolean;
    physicalStageFilter?: PhysicalStage;
  } = {
    includeUnverifiedAi: false,
    stabilityVerifiedByUser: false,
  }
): StatisticalSummary | null {
  const baseFiltered = options.includeUnverifiedAi
    ? measurements
    : measurements.filter(
        (m) =>
          m.verifiedPhysicalMeasurement &&
          m.sourceType !== 'AI-Assisted Annotation' &&
          m.sourceType !== 'Computed'
      );

  const stageFiltered = options.physicalStageFilter
    ? baseFiltered.filter(
        (m) => (m.physicalStage || 'Stage Unknown') === options.physicalStageFilter
      )
    : baseFiltered;

  if (stageFiltered.length === 0) {
    return null;
  }

  const primaryType = stageFiltered[0].measurementType;
  const unit = stageFiltered[0].unit;
  const primaryStage = stageFiltered[0].physicalStage || 'Stage Unknown';

  // Guard against accidental mixing of incompatible measurement types, physical units, or distinct known physical stages
  const distinctKnownStages = new Set(
    stageFiltered
      .map((m) => m.physicalStage || 'Stage Unknown')
      .filter((s) => s !== 'Stage Unknown')
  );
  const enforceStageMatch = distinctKnownStages.size > 1;

  const filtered = stageFiltered.filter(
    (m) =>
      m.measurementType === primaryType &&
      m.unit === unit &&
      (!enforceStageMatch || (m.physicalStage || 'Stage Unknown') === primaryStage) &&
      Number.isFinite(m.measuredValue) &&
      Number.isFinite(m.targetValue) &&
      Number.isFinite(m.tolerance) &&
      m.tolerance > 0
  );

  if (filtered.length === 0) {
    return null;
  }

  const count = filtered.length;
  const targetValue = filtered[0].targetValue;
  const tolerance = filtered[0].tolerance;

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

  const withinToleranceCount = filtered.filter((m) => {
    const evalRes = evaluateFeatureMeasurementTolerance({
      ...m,
      targetStage: m.targetStage || 'Stage Unknown',
    });
    if (evalRes.withinTolerance !== null) {
      return evalRes.withinTolerance;
    }
    return Math.abs(m.measuredValue - m.targetValue) <= m.tolerance;
  }).length;
  const outOfToleranceCount = count - withinToleranceCount;
  const passRatePercent = (withinToleranceCount / count) * 100;

  const hasNonUniformSpec = filtered.some(
    (m) =>
      Math.abs(m.targetValue - targetValue) > 1e-6 ||
      Math.abs(m.tolerance - tolerance) > 1e-6
  );

  let cp: number | null = null;
  let cpk: number | null = null;
  let capabilityStatusReason = '';

  if (count < MIN_SAMPLE_SIZE_FOR_CAPABILITY_INDEX) {
    capabilityStatusReason = `Withheld: n=${count} < ${MIN_SAMPLE_SIZE_FOR_CAPABILITY_INDEX} minimum sample size required for statistically defensible Cp/Cpk estimation.`;
  } else if (hasNonUniformSpec) {
    capabilityStatusReason =
      'Withheld: Measurements in this series have non-uniform target values or tolerance bounds.';
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
    physicalStageSummary: primaryStage,
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
  rmseSocketDiameterMm: number | null;
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
    (m) =>
      m.verifiedPhysicalMeasurement &&
      m.sourceType !== 'AI-Assisted Annotation' &&
      m.sourceType !== 'Computed' &&
      Number.isFinite(m.measuredValue) &&
      Number.isFinite(m.targetValue) &&
      Number.isFinite(m.tolerance) &&
      m.tolerance > 0
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
      rmseSocketDiameterMm: null,
      qualityStatus: 'Insufficient Data',
    };
  }

  // Evaluate only stage-compatible measurements for overall pass rate
  const stageCompatibleVerified = verified.filter((m) => {
    const res = evaluateFeatureMeasurementTolerance(m);
    return res.stageCompatible;
  });

  const evalPool =
    stageCompatibleVerified.length > 0 ? stageCompatibleVerified : verified;

  const passCount = evalPool.filter((m) => {
    const res = evaluateFeatureMeasurementTolerance(m);
    if (res.withinTolerance !== null) return res.withinTolerance;
    return Math.abs(m.measuredValue - m.targetValue) <= m.tolerance;
  }).length;
  const overallPassRatePercent = (passCount / evalPool.length) * 100;

  const beadWidthStats = computeMeasurementStatistics(
    verified.filter((m) => m.measurementType === 'bead width')
  );
  const beadHeightStats = computeMeasurementStatistics(
    verified.filter((m) => m.measurementType === 'bead height')
  );
  const xyzStats = computeMeasurementStatistics(
    verified.filter((m) => m.measurementType === 'XYZ residual')
  );
  const socketStats = computeMeasurementStatistics(
    evalPool.filter((m) => m.measurementType === 'socket diameter')
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
    rmseSocketDiameterMm: socketStats ? socketStats.rmse : null,
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

  if (!Number.isFinite(printSpeedMmPerSec) || printSpeedMmPerSec < bounds.minPrintSpeedMmPerSec) {
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

  if (!Number.isFinite(relativeFlowPercent) || relativeFlowPercent < bounds.minRelativeFlowPercent) {
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

  if (!Number.isFinite(layerHeightMm) || layerHeightMm < bounds.minLayerHeightMm) {
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

  const safeW = Number.isFinite(targetBeadWidthMm) && targetBeadWidthMm > 0 ? targetBeadWidthMm : clampedLayer;
  const safeH = Number.isFinite(layerHeightMm) && layerHeightMm > 0 ? layerHeightMm : clampedLayer;
  const safeV = Number.isFinite(printSpeedMmPerSec) && printSpeedMmPerSec > 0 ? printSpeedMmPerSec : clampedSpeed;

  // Oblong capsule cross-sectional area approximation: A = (w - h)*h + pi*(h/2)^2
  const nominalCrossSectionAreaMm2 =
    safeW >= safeH
      ? (safeW - safeH) * safeH + Math.PI * Math.pow(safeH / 2, 2)
      : safeW * safeH;

  const theoreticalVolumetricRateMm3PerSec = nominalCrossSectionAreaMm2 * safeV;

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
 * with >= 3 distinct flow parameter states exist in the session and inputs are valid.
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
    (t) =>
      t.recordOrigin === 'Observed Experimental Trial' &&
      Number.isFinite(t.parameterSet.relativeFlowPercent) &&
      Number.isFinite(t.measuredOutcome.measuredBeadWidthMm)
  );

  if (
    !Number.isFinite(currentSpeedMmPerSec) ||
    currentSpeedMmPerSec <= 0 ||
    !Number.isFinite(currentFlowPercent) ||
    currentFlowPercent <= 0 ||
    !Number.isFinite(currentLayerHeightMm) ||
    currentLayerHeightMm <= 0 ||
    !Number.isFinite(observedBeadWidthMm) ||
    observedBeadWidthMm <= 0 ||
    !Number.isFinite(observedBeadHeightMm) ||
    observedBeadHeightMm <= 0
  ) {
    return {
      canComputeRecommendation: false,
      withheldReason:
        'Invalid or non-positive checkpoint input values. All candidate parameters and observed dimensions must be positive finite numbers.',
      observedTrialsUsed: observedTrials.length,
      empiricalFlowSensitivitySlope: null,
      candidateRelativeFlowPercent: null,
      candidatePrintSpeedMmPerSec: null,
      candidateZOffsetMm: null,
      unvalidatedPredictedWidthMm: null,
      clampedByBounds: false,
      clampedParameters: [],
      scientificWarning: 'Optimization candidate withheld due to invalid input values.',
    };
  }

  if (observedTrials.length < 3) {
    return {
      canComputeRecommendation: false,
      withheldReason: `Insufficient empirical data: ${observedTrials.length} observed trial(s) recorded. At least 3 verified empirical trials spanning distinct parameter states are required before computing an interpolated checkpoint candidate.`,
      observedTrialsUsed: observedTrials.length,
      empiricalFlowSensitivitySlope: null,
      candidatePrintSpeedMmPerSec: null,
      candidateRelativeFlowPercent: null,
      candidateZOffsetMm: null,
      unvalidatedPredictedWidthMm: null,
      clampedByBounds: false,
      clampedParameters: [],
      scientificWarning:
        'Optimization candidate withheld to prevent ungrounded extrapolation.',
    };
  }

  const distinctFlowValues = new Set(
    observedTrials.map((t) => Number(t.parameterSet.relativeFlowPercent.toFixed(3)))
  );
  if (distinctFlowValues.size < 3) {
    return {
      canComputeRecommendation: false,
      withheldReason: `Observed trials span only ${distinctFlowValues.size} distinct Relative Flow % state(s). At least 3 distinct flow states are required for linear sensitivity characterization.`,
      observedTrialsUsed: observedTrials.length,
      empiricalFlowSensitivitySlope: null,
      candidateRelativeFlowPercent: null,
      candidatePrintSpeedMmPerSec: null,
      candidateZOffsetMm: null,
      unvalidatedPredictedWidthMm: null,
      clampedByBounds: false,
      clampedParameters: [],
      scientificWarning:
        'Vary Relative Flow % across at least 3 distinct trial levels before interpolating.',
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

  if (candidateSpeed < bounds.minPrintSpeedMmPerSec) {
    candidateSpeed = bounds.minPrintSpeedMmPerSec;
    clampedParameters.push('Print Speed mm/s (clamped to min bound)');
  } else if (candidateSpeed > bounds.maxPrintSpeedMmPerSec) {
    candidateSpeed = bounds.maxPrintSpeedMmPerSec;
    clampedParameters.push('Print Speed mm/s (clamped to max bound)');
  }

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
 * Requires explicit clock synchronization alignment, valid timestamps, and matching coordinate frames.
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
    (o) =>
      o.clockSyncStatus === 'Unsynchronized Local Clock' ||
      o.clockSyncStatus === 'Unknown Synchronization'
  );
  if (unsyncedObs.length > 0) {
    issues.push(
      `${unsyncedObs.length} observation record(s) have ${unsyncedObs[0].clockSyncStatus}. Explicit timestamp alignment (NTP/PTP or manual offset) is required before temporal correlation.`
    );
  }

  const invalidObsTimestamps = observations.filter(
    (o) => !o.timestamp || Number.isNaN(Date.parse(o.timestamp))
  );
  const invalidMeasTimestamps = measurements.filter(
    (m) => !m.timestamp || Number.isNaN(Date.parse(m.timestamp))
  );
  if (invalidObsTimestamps.length > 0 || invalidMeasTimestamps.length > 0) {
    issues.push(
      `Invalid ISO-8601 timestamp detected in ${invalidObsTimestamps.length} observation(s) and ${invalidMeasTimestamps.length} measurement(s).`
    );
  }

  const missingSourceObs = observations.filter((o) => !o.acquisitionSource?.trim());
  if (missingSourceObs.length > 0) {
    issues.push(
      `${missingSourceObs.length} observation record(s) lack acquisition-source metadata.`
    );
  }

  const obsFrames = Array.from(
    new Set(observations.map((o) => o.coordinateFrame.trim()).filter(Boolean))
  );
  const measFrames = Array.from(
    new Set(measurements.map((m) => m.coordinateFrame.trim()).filter(Boolean))
  );
  const allFrames = Array.from(new Set([...obsFrames, ...measFrames]));

  if (
    observations.some((o) => !o.coordinateFrame?.trim()) ||
    measurements.some((m) => !m.coordinateFrame?.trim())
  ) {
    issues.push('One or more records have an empty coordinateFrame.');
  }

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
      unsyncedObs.length === 0 &&
      invalidObsTimestamps.length === 0 &&
      observations.length > 0
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
  greenYieldPercent: number | null;
  dryYieldPercent: number | null;
  firedYieldPercent: number | null;
  assemblyYieldPercent: number | null;
  reworkCount: number;
  totalMaterialMassG: number;
  wasteRatioPercent: number;
  totalCycleDurationMin: number;
  dryingAndFiringDurationMin: number;
  completeProcessDurationMin: number;
  acceptedPerPrintHour: number | null;
  acceptedPerCompleteProcessHour: number | null;
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

  const greenYieldPercent =
    totalPartsAttempted > 0 && typeof record.greenAcceptedCount === 'number'
      ? (record.greenAcceptedCount / totalPartsAttempted) * 100
      : null;
  const dryYieldPercent =
    totalPartsAttempted > 0 && typeof record.dryAcceptedCount === 'number'
      ? (record.dryAcceptedCount / totalPartsAttempted) * 100
      : null;
  const firedYieldPercent =
    totalPartsAttempted > 0 && typeof record.firedAcceptedCount === 'number'
      ? (record.firedAcceptedCount / totalPartsAttempted) * 100
      : null;
  const assemblyYieldPercent =
    totalPartsAttempted > 0 && typeof record.assemblyAcceptedCount === 'number'
      ? (record.assemblyAcceptedCount / totalPartsAttempted) * 100
      : null;

  const totalMaterialMassG = record.materialUsed + record.materialWaste;
  const wasteRatioPercent =
    totalMaterialMassG > 0 ? (record.materialWaste / totalMaterialMassG) * 100 : 0;

  const totalCycleDurationMin =
    record.setupDuration +
    record.printDuration +
    record.calibrationDuration +
    record.downtime;

  const dryingAndFiringDurationMin =
    record.dryingAndFiringDurationMin ?? record.dryingAndFiringDuration ?? 0;
  const completeProcessDurationMin = totalCycleDurationMin + dryingAndFiringDurationMin;

  const acceptedPerPrintHour =
    totalCycleDurationMin > 0
      ? Number(((record.acceptedPartCount / totalCycleDurationMin) * 60).toFixed(2))
      : null;

  const acceptedPerCompleteProcessHour =
    completeProcessDurationMin > 0
      ? Number(((record.acceptedPartCount / completeProcessDurationMin) * 60).toFixed(3))
      : null;

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
    greenYieldPercent,
    dryYieldPercent,
    firedYieldPercent,
    assemblyYieldPercent,
    reworkCount: record.reworkCount ?? 0,
    totalMaterialMassG,
    wasteRatioPercent,
    totalCycleDurationMin,
    dryingAndFiringDurationMin,
    completeProcessDurationMin,
    acceptedPerPrintHour,
    acceptedPerCompleteProcessHour,
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
  allProductionRecords: ProductionMetricRecord[] = []
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
