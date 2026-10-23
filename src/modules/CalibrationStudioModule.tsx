import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Sliders,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalibrationSession,
  CalibrationTrial,
} from '../domain/models';
import { useResearchWorkspace } from '../repositories/repository';
import {
  evaluateEmpiricalCheckpointCandidate,
  evaluateParameterBoundsDeterministically,
} from '../scientific/calculations';

export const CalibrationStudioModule: React.FC = () => {
  const {
    snapshot,
    selectedExperimentId,
    setSelectedExperimentId,
    repository,
    refreshWorkspace,
    notifyToast,
  } = useResearchWorkspace();

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // Deterministic Bounds & Candidate Evaluator Inputs
  const [testSpeed, setTestSpeed] = useState<number>(35.0);
  const [testFlow, setTestFlow] = useState<number>(92.0);
  const [testLayerHeight, setTestLayerHeight] = useState<number>(3.0);
  const [testTargetWidth, setTestTargetWidth] = useState<number>(6.5);
  const [observedCheckpointWidth, setObservedCheckpointWidth] =
    useState<number>(7.05);
  const [observedCheckpointHeight, setObservedCheckpointHeight] =
    useState<number>(2.92);

  // New Calibration Trial Form
  const [trialLayer, setTrialLayer] = useState<number>(10);
  const [trialOrigin, setTrialOrigin] = useState<
    'Observed Experimental Trial' | 'Theoretical / Unvalidated Candidate'
  >('Observed Experimental Trial');
  const [trialSpeed, setTrialSpeed] = useState<number>(35.0);
  const [trialFlow, setTrialFlow] = useState<number>(91.5);
  const [trialVolFlow, setTrialVolFlow] = useState<string>('547.6');
  const [trialLayerH, setTrialLayerH] = useState<number>(3.0);
  const [trialZOffset, setTrialZOffset] = useState<number>(0.0);
  const [trialMeasWidth, setTrialMeasWidth] = useState<number>(6.53);
  const [trialMeasHeight, setTrialMeasHeight] = useState<number>(2.99);
  const [trialStabilityNote, setTrialStabilityNote] = useState<string>(
    'Nominal cohesive bead'
  );
  const [trialRationale, setTrialRationale] = useState<string>('');

  // New Session Modal / Form toggle
  const [showNewSessionForm, setShowNewSessionForm] = useState<boolean>(false);
  const [newSessCode, setNewSessCode] = useState<string>('CAL-2026-002');
  const [newSessTitle, setNewSessTitle] = useState<string>('');
  const [newSessObjective, setNewSessObjective] = useState<string>('');
  const [newSessMaterialId, setNewSessMaterialId] = useState<string>('');
  const [newSessExperimentId, setNewSessExperimentId] = useState<string>('');

  if (!snapshot) return null;

  const {
    project,
    calibrationSessions,
    calibrationTrials,
    experiments,
    materialProfiles,
  } = snapshot;

  const activeSession =
    calibrationSessions.find((s) => s.id === selectedSessionId) ||
    calibrationSessions.find((s) => s.referenceExperimentId === selectedExperimentId) ||
    calibrationSessions[0];

  const sessionTrials = useMemo(() => {
    if (!activeSession) return [];
    return calibrationTrials
      .filter((t) => t.calibrationSessionId === activeSession.id)
      .sort((a, b) => a.trialNumber - b.trialNumber);
  }, [calibrationTrials, activeSession]);

  const observedTrialsOnly = useMemo(
    () =>
      sessionTrials.filter(
        (t) => t.recordOrigin === 'Observed Experimental Trial'
      ),
    [sessionTrials]
  );

  const candidateTrialsOnly = useMemo(
    () =>
      sessionTrials.filter(
        (t) => t.recordOrigin === 'Theoretical / Unvalidated Candidate'
      ),
    [sessionTrials]
  );

  const deterministicCheck = useMemo(() => {
    const bounds = activeSession?.parameterBounds || {
      minPrintSpeedMmPerSec: 15,
      maxPrintSpeedMmPerSec: 60,
      minRelativeFlowPercent: 75,
      maxRelativeFlowPercent: 125,
      minLayerHeightMm: 1.0,
      maxLayerHeightMm: 4.5,
    };
    return evaluateParameterBoundsDeterministically(
      bounds,
      testSpeed,
      testFlow,
      testLayerHeight,
      testTargetWidth
    );
  }, [activeSession, testSpeed, testFlow, testLayerHeight, testTargetWidth]);

  const empiricalCandidate = useMemo(() => {
    if (!activeSession) return null;
    return evaluateEmpiricalCheckpointCandidate(
      activeSession,
      sessionTrials,
      testSpeed,
      testFlow,
      testLayerHeight,
      observedCheckpointWidth,
      observedCheckpointHeight
    );
  }, [
    activeSession,
    sessionTrials,
    testSpeed,
    testFlow,
    testLayerHeight,
    observedCheckpointWidth,
    observedCheckpointHeight,
  ]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessTitle.trim()) {
      notifyToast('Session Title is required.');
      return;
    }
    const targetMatId = newSessMaterialId || materialProfiles[0]?.id || '';
    const targetExpId =
      newSessExperimentId || selectedExperimentId || experiments[0]?.id || '';

    if (!targetMatId || !targetExpId) {
      notifyToast(
        'Cannot create Calibration Session: At least one Material Profile and one Reference Experiment must exist first.'
      );
      return;
    }

    const sess: CalibrationSession = {
      id: `calsess-${Date.now()}`,
      projectId: project.id,
      sessionCode: newSessCode.trim() || `CAL-${Date.now()}`,
      title: newSessTitle.trim(),
      materialProfileId: targetMatId,
      referenceExperimentId: targetExpId,
      objective:
        newSessObjective.trim() ||
        'Characterize empirical parameter bounds and checkpoint response.',
      decisionMethod: 'Deterministic Bounds & Tolerance Check',
      parameterBounds: {
        minPrintSpeedMmPerSec: 20,
        maxPrintSpeedMmPerSec: 55,
        minRelativeFlowPercent: 80,
        maxRelativeFlowPercent: 120,
        minLayerHeightMm: 1.5,
        maxLayerHeightMm: 4.0,
      },
      targetMetric: {
        measurementType: 'bead width',
        targetValue: 6.5,
        tolerance: 0.45,
        unit: 'mm',
      },
      status: 'Active',
      isSampleFixture: false,
      createdAt: new Date().toISOString(),
    };
    const res = await repository.saveCalibrationSession(sess, true);
    if (!res.ok) {
      notifyToast(res.error || 'Failed to save calibration session.');
      return;
    }
    await refreshWorkspace();
    setSelectedSessionId(sess.id);
    setSelectedExperimentId(sess.referenceExperimentId);
    setShowNewSessionForm(false);
    setNewSessTitle('');
    notifyToast(`Created calibration session ${sess.sessionCode}`);
  };

  const handleLogTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    const nextNum =
      sessionTrials.reduce((max, t) => Math.max(max, t.trialNumber), 0) + 1;
    const targetW = activeSession.targetMetric.targetValue;
    const residual = Number((trialMeasWidth - targetW).toFixed(3));

    const bCheck = evaluateParameterBoundsDeterministically(
      activeSession.parameterBounds,
      trialSpeed,
      trialFlow,
      trialLayerH,
      targetW
    );

    const status: CalibrationTrial['constraintStatus'] = !bCheck.withinBounds
      ? 'Boundary Violation — Clamped'
      : Math.abs(residual) <= activeSession.targetMetric.tolerance
      ? 'Within Bounds & Converged'
      : 'Within Bounds — Adjustment Needed';

    const trial: CalibrationTrial = {
      id: `caltrial-${Date.now()}`,
      calibrationSessionId: activeSession.id,
      experimentId: activeSession.referenceExperimentId,
      trialNumber: nextNum,
      checkpointLayerIndex: Number(trialLayer),
      recordOrigin: trialOrigin,
      parameterSet: {
        printSpeedMmPerSec: Number(trialSpeed),
        relativeFlowPercent: Number(trialFlow),
        volumetricFlowValue:
          trialVolFlow.trim() !== '' ? Number(trialVolFlow) : null,
        volumetricFlowUnit: 'mm³/s',
        layerHeightMm: Number(trialLayerH),
        nozzleZOffsetMm: Number(trialZOffset),
      },
      measuredOutcome: {
        measuredBeadWidthMm: Number(trialMeasWidth),
        measuredBeadHeightMm: Number(trialMeasHeight),
        dimensionalResidualMm: residual,
        surfaceStabilityScore: trialStabilityNote.trim(),
      },
      constraintStatus: status,
      rationale:
        trialRationale.trim() ||
        `Logged ${trialOrigin} at Layer ${trialLayer}.`,
      isSampleFixture: false,
      createdAt: new Date().toISOString(),
    };

    const res = await repository.saveCalibrationTrial(trial);
    if (!res.ok) {
      notifyToast(res.error || 'Failed to save calibration trial.');
      return;
    }
    await refreshWorkspace();
    notifyToast(`Logged Calibration Trial #${nextNum} (${trialOrigin})`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0F141C] border border-[#1E293B] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            MODULE 03 · CALIBRATION STUDIO (DETERMINISTIC BOUNDS & EMPIRICAL TRIALS)
          </div>
          <h1 className="text-xl font-semibold text-[#F1F5F9] mt-0.5">
            Parameter Bounds Verification, Empirical Trial Ledger & Checkpoint Evaluator
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {calibrationSessions.length > 0 && (
            <select
              aria-label="Select Calibration Session"
              value={activeSession?.id || ''}
              onChange={(e) => {
                setSelectedSessionId(e.target.value);
                const s = calibrationSessions.find(
                  (sess) => sess.id === e.target.value
                );
                if (s) setSelectedExperimentId(s.referenceExperimentId);
              }}
              className="bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
            >
              {calibrationSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sessionCode} — {s.title}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowNewSessionForm(!showNewSessionForm)}
            className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs font-mono cursor-pointer"
          >
            + New Calibration Session
          </button>
        </div>
      </div>

      {showNewSessionForm && (
        <form
          onSubmit={handleCreateSession}
          className="bg-[#0F141C] border border-cyan-500/40 p-5 space-y-4"
        >
          <div className="text-xs font-mono text-cyan-400">
            CREATE NEW CALIBRATION SESSION
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                Session Code *
              </label>
              <input
                type="text"
                value={newSessCode}
                onChange={(e) => setNewSessCode(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                Session Title *
              </label>
              <input
                type="text"
                value={newSessTitle}
                onChange={(e) => setNewSessTitle(e.target.value)}
                placeholder="e.g. Clay Batch B03 Speed-Flow Sensitivity Sweep"
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                Material Profile *
              </label>
              <select
                value={newSessMaterialId || materialProfiles[0]?.id || ''}
                onChange={(e) => setNewSessMaterialId(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
              >
                {materialProfiles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.batchIdentifier} — {m.materialName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                Reference Experiment *
              </label>
              <select
                value={
                  newSessExperimentId ||
                  selectedExperimentId ||
                  experiments[0]?.id ||
                  ''
                }
                onChange={(e) => setNewSessExperimentId(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
              >
                {experiments.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.experimentCode} — {exp.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-mono text-[#94A3B8] mb-1">
              Calibration Objective
            </label>
            <input
              type="text"
              value={newSessObjective}
              onChange={(e) => setNewSessObjective(e.target.value)}
              placeholder="Define parameter bounds and target geometry..."
              className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-500 text-slate-950 font-semibold text-xs font-mono cursor-pointer"
          >
            Save Calibration Session
          </button>
        </form>
      )}

      {/* Top Split: 1. Deterministic Parameter Bounds & Kinematic Calculator; 2. Empirical Interpolation Guard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Deterministic Bounds & Kinematic Cross-Section Checker */}
        <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4">
          <div className="text-xs font-mono text-emerald-400">
            01. DETERMINISTIC PARAMETER BOUNDS & KINEMATIC CALCULATOR
          </div>
          <p className="text-xs text-[#94A3B8]">
            Evaluates parameter limits and conservation-of-volume geometry deterministically
            without statistical extrapolation.
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <label className="block text-[11px] text-[#94A3B8] mb-1">
                Candidate Print Speed (mm/s)
              </label>
              <input
                type="number"
                step="0.5"
                value={testSpeed}
                onChange={(e) => setTestSpeed(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#94A3B8] mb-1">
                Candidate Relative Flow (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={testFlow}
                onChange={(e) => setTestFlow(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#94A3B8] mb-1">
                Layer Height (mm)
              </label>
              <input
                type="number"
                step="0.1"
                value={testLayerHeight}
                onChange={(e) => setTestLayerHeight(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#94A3B8] mb-1">
                Target Bead Width (mm)
              </label>
              <input
                type="number"
                step="0.1"
                value={testTargetWidth}
                onChange={(e) => setTestTargetWidth(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="bg-[#0B0E14] border border-[#1E293B] p-4 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">BOUNDS CHECK STATUS:</span>
              {deterministicCheck.withinBounds ? (
                <span className="text-emerald-400">
                  ● All Parameters Within Session Bounds
                </span>
              ) : (
                <span className="text-rose-400">
                  ✖ Boundary Violation ({deterministicCheck.violations.length})
                </span>
              )}
            </div>
            {deterministicCheck.violations.map((v, i) => (
              <div key={i} className="text-rose-300 text-[11px]">
                · {v}
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1E293B]">
              <div>
                <span className="text-[#94A3B8] block text-[10px]">
                  Nominal Capsule Cross-Section Area
                </span>
                <span className="text-[#F1F5F9] font-semibold tabular-nums">
                  {deterministicCheck.nominalCrossSectionAreaMm2}
                </span>
                <span className="text-[#94A3B8] text-[10px] ml-1">mm²</span>
              </div>
              <div>
                <span className="text-[#94A3B8] block text-[10px]">
                  Kinematic Volumetric Demand (A × v)
                </span>
                <span className="text-[#F1F5F9] font-semibold tabular-nums">
                  {deterministicCheck.theoreticalVolumetricRateMm3PerSec}
                </span>
                <span className="text-[#94A3B8] text-[10px] ml-1">mm³/s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Empirical Checkpoint Interpolation (Strictly Guarded >= 3 Observed Trials) */}
        <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4">
          <div className="text-xs font-mono text-amber-400">
            02. EMPIRICAL CHECKPOINT CANDIDATE CALCULATOR (REQUIRES ≥ 3 OBSERVED TRIALS)
          </div>
          <p className="text-xs text-[#94A3B8]">
            Computes a linear sensitivity interpolation strictly from observed experimental
            trials. Automatically withheld if fewer than 3 empirical trials exist.
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <label className="block text-[11px] text-[#94A3B8] mb-1">
                Observed Checkpoint Bead Width (mm)
              </label>
              <input
                type="number"
                step="0.05"
                value={observedCheckpointWidth}
                onChange={(e) => setObservedCheckpointWidth(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#94A3B8] mb-1">
                Observed Checkpoint Bead Height (mm)
              </label>
              <input
                type="number"
                step="0.05"
                value={observedCheckpointHeight}
                onChange={(e) =>
                  setObservedCheckpointHeight(Number(e.target.value))
                }
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
          </div>

          {empiricalCandidate ? (
            empiricalCandidate.canComputeRecommendation ? (
              <div className="bg-[#0B0E14] border border-amber-500/40 p-4 space-y-2 text-xs font-mono">
                <div className="text-amber-400 text-[11px]">
                  ▲ {empiricalCandidate.scientificWarning}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">
                      Candidate Rel. Flow
                    </span>
                    <span className="text-cyan-400 text-base font-semibold tabular-nums">
                      {empiricalCandidate.candidateRelativeFlowPercent}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">
                      Empirical Sensitivity
                    </span>
                    <span className="text-[#F1F5F9] font-semibold tabular-nums">
                      {empiricalCandidate.empiricalFlowSensitivitySlope} mm/%
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">
                      Interpolated Width
                    </span>
                    <span className="text-[#F1F5F9] font-semibold tabular-nums">
                      {empiricalCandidate.unvalidatedPredictedWidthMm} mm
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#0B0E14] border border-[#1E293B] p-4 space-y-1 text-xs font-mono">
                <div className="text-amber-400">
                  ▲ Optimization Candidate Withheld
                </div>
                <p className="text-[#94A3B8] text-[11px] leading-relaxed">
                  {empiricalCandidate.withheldReason}
                </p>
              </div>
            )
          ) : (
            <div className="text-xs font-mono text-[#94A3B8]">
              Create or select a calibration session to evaluate empirical trials.
            </div>
          )}
        </div>
      </div>

      {/* Empirical Response Curve & Separated Ledgers */}
      {activeSession && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Empirical Response Curve */}
          <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4">
            <div>
              <div className="text-xs font-mono text-cyan-400">
                EMPIRICAL PARAMETER RESPONSE CURVE (OBSERVED TRIALS ONLY)
              </div>
              <h2 className="text-base font-semibold text-[#F1F5F9] mt-0.5">
                Relative Flow (%) vs. Measured Bead Width (mm)
              </h2>
            </div>

            <div className="h-64 bg-[#0B0E14] border border-[#1E293B] p-3">
              {observedTrialsOnly.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[...observedTrialsOnly].sort(
                      (a, b) =>
                        a.parameterSet.relativeFlowPercent -
                        b.parameterSet.relativeFlowPercent
                    )}
                    margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
                  >
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="parameterSet.relativeFlowPercent"
                      type="number"
                      domain={['auto', 'auto']}
                      stroke="#94A3B8"
                      tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                      label={{
                        value: 'Relative Flow (%)',
                        position: 'insideBottom',
                        offset: -10,
                        fill: '#94A3B8',
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      dataKey="measuredOutcome.measuredBeadWidthMm"
                      type="number"
                      domain={['auto', 'auto']}
                      stroke="#94A3B8"
                      tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F141C',
                        borderColor: '#1E293B',
                        fontFamily: 'IBM Plex Mono',
                        fontSize: '11px',
                      }}
                    />
                    <ReferenceLine
                      y={activeSession.targetMetric.targetValue}
                      stroke="#10B981"
                      strokeDasharray="4 4"
                    />
                    <Line
                      type="monotone"
                      dataKey="measuredOutcome.measuredBeadWidthMm"
                      name="Observed Bead Width (mm)"
                      stroke="#06B6D4"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#06B6D4' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs font-mono text-[#94A3B8]">
                  No observed experimental trials recorded in this session yet.
                </div>
              )}
            </div>

            {/* Log Trial Form */}
            <form
              onSubmit={handleLogTrial}
              className="bg-[#0B0E14] border border-[#1E293B] p-4 space-y-3"
            >
              <div className="text-xs font-mono text-cyan-400">
                RECORD CALIBRATION TRIAL OR CANDIDATE
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
                <div className="col-span-2">
                  <label className="block text-[10px] text-[#94A3B8] mb-1">
                    Record Classification (Strict Separation)
                  </label>
                  <select
                    value={trialOrigin}
                    onChange={(e) =>
                      setTrialOrigin(
                        e.target.value as
                          | 'Observed Experimental Trial'
                          | 'Theoretical / Unvalidated Candidate'
                      )
                    }
                    className="w-full bg-[#151C28] border border-[#1E293B] px-2 py-1.5 text-[#F1F5F9]"
                  >
                    <option value="Observed Experimental Trial">
                      Observed Experimental Trial (Physical Run)
                    </option>
                    <option value="Theoretical / Unvalidated Candidate">
                      Theoretical / Unvalidated Candidate
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[#94A3B8] mb-1">
                    Checkpoint Layer
                  </label>
                  <input
                    type="number"
                    value={trialLayer}
                    onChange={(e) => setTrialLayer(Number(e.target.value))}
                    className="w-full bg-[#151C28] border border-[#1E293B] px-2 py-1.5 text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#94A3B8] mb-1">
                    Speed (mm/s)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={trialSpeed}
                    onChange={(e) => setTrialSpeed(Number(e.target.value))}
                    className="w-full bg-[#151C28] border border-[#1E293B] px-2 py-1.5 text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#94A3B8] mb-1">
                    Relative Flow (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={trialFlow}
                    onChange={(e) => setTrialFlow(Number(e.target.value))}
                    className="w-full bg-[#151C28] border border-[#1E293B] px-2 py-1.5 text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#94A3B8] mb-1">
                    Measured Width (mm)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={trialMeasWidth}
                    onChange={(e) => setTrialMeasWidth(Number(e.target.value))}
                    className="w-full bg-[#151C28] border border-[#1E293B] px-2 py-1.5 text-[#F1F5F9]"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 bg-cyan-500 text-slate-950 font-semibold text-xs font-mono cursor-pointer"
              >
                + Append to Session Ledger
              </button>
            </form>
          </div>

          {/* Separated Ledgers: Observed Experimental Trials vs Unvalidated Candidates */}
          <div className="space-y-6">
            <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3">
              <div className="text-xs font-mono text-emerald-400">
                ● VERIFIED OBSERVED EXPERIMENTAL TRIALS ({observedTrialsOnly.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1E293B] bg-[#0B0E14] text-[#94A3B8] text-[11px]">
                      <th className="py-2 px-3">Trial / Layer</th>
                      <th className="py-2 px-3 text-right">Speed / Flow</th>
                      <th className="py-2 px-3 text-right">Measured Width</th>
                      <th className="py-2 px-3 text-right">Residual Δ</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {observedTrialsOnly.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2 px-3">
                          #{t.trialNumber} · L{t.checkpointLayerIndex}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {t.parameterSet.printSpeedMmPerSec} mm/s ·{' '}
                          {t.parameterSet.relativeFlowPercent}%
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {t.measuredOutcome.measuredBeadWidthMm.toFixed(2)} mm
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {t.measuredOutcome.dimensionalResidualMm >= 0 ? '+' : ''}
                          {t.measuredOutcome.dimensionalResidualMm.toFixed(2)} mm
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-300">
                          {t.constraintStatus}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3">
              <div className="text-xs font-mono text-amber-400">
                ▲ THEORETICAL / UNVALIDATED CANDIDATES ({candidateTrialsOnly.length})
              </div>
              {candidateTrialsOnly.length === 0 ? (
                <div className="text-xs font-mono text-[#94A3B8]">
                  No unvalidated theoretical candidates stored. Candidates are kept
                  strictly separate from empirical trial data.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1E293B] bg-[#0B0E14] text-[#94A3B8] text-[11px]">
                        <th className="py-2 px-3">Candidate</th>
                        <th className="py-2 px-3 text-right">Speed / Flow</th>
                        <th className="py-2 px-3 text-right">Expected Width</th>
                        <th className="py-2 px-3">Bounds Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]">
                      {candidateTrialsOnly.map((t) => (
                        <tr key={t.id}>
                          <td className="py-2 px-3 text-amber-400">
                            #{t.trialNumber} (Unvalidated)
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {t.parameterSet.printSpeedMmPerSec} mm/s ·{' '}
                            {t.parameterSet.relativeFlowPercent}%
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {t.measuredOutcome.measuredBeadWidthMm.toFixed(2)} mm
                          </td>
                          <td className="py-2 px-3 text-[11px]">
                            {t.constraintStatus}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
