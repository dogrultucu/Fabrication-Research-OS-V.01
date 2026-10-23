import React from 'react';
import {
  ArrowRight,
  ClipboardCheck,
  Database,
  FlaskConical,
  Plus,
  Settings,
} from 'lucide-react';
import { useResearchWorkspace } from '../repositories/repository';
import {
  compareExperimentToBaseline,
  evaluateExperimentQuality,
} from '../scientific/calculations';

export const OverviewModule: React.FC = () => {
  const {
    snapshot,
    setActiveModule,
    navigateToExperimentInModule,
    repository,
    refreshWorkspace,
    notifyToast,
  } = useResearchWorkspace();

  if (!snapshot) return null;

  const {
    project,
    experiments,
    nodeDesigns,
    specimens,
    assemblyVerifications,
    materialProfiles,
    hardwareProfiles,
    measurements,
    calibrationSessions,
    researchReferences,
    productionMetrics,
  } = snapshot;

  const verifiedMeasurements = measurements.filter(
    (m) => m.verifiedPhysicalMeasurement && m.sourceType !== 'AI-Assisted Annotation'
  );

  const baselineExperiments = experiments.filter(
    (e) => e.baselineOrProposedMethod === 'Fixed-Parameter Baseline'
  );
  const proposedExperiments = experiments.filter(
    (e) => e.baselineOrProposedMethod !== 'Fixed-Parameter Baseline'
  );
  const ceramicNodeExperiments = experiments.filter(
    (e) =>
      e.researchWorkflowType === 'Ceramic Node Fabrication' ||
      e.researchWorkflowType === 'Joint / Socket Fit Study' ||
      e.researchWorkflowType === 'Shrinkage Study'
  );

  const handleLoadSample = async () => {
    await repository.loadSampleDatasetNonDestructive();
    await refreshWorkspace();
    notifyToast(
      'Loaded MRAC 2026–2027 sample dataset including Ceramic Node & Extrusion fixtures.'
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Research Context Banner */}
      <section className="bg-[#0F141C] border border-[#1E293B] p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-2 max-w-4xl">
            <div className="flex items-center gap-2 text-xs font-mono text-[#94A3B8]">
              <span>IAAC MRAC 2026–2027</span>
              <span aria-hidden="true">·</span>
              <span>RELEASE v0.1.1 (CERAMIC NODE WORKFLOW)</span>
              <span aria-hidden="true">·</span>
              <span>SCHEMA v{project.schemaVersion} (17 ENTITIES)</span>
            </div>
            <h1 className="text-2xl font-semibold text-[#F1F5F9] tracking-tight">
              {project.workingThesisTitle || project.name}
            </h1>
            <div className="p-3 bg-[#0B0E14] border border-cyan-500/30 mt-2">
              <div className="text-[10px] font-mono text-cyan-400">
                WORKING RESEARCH QUESTION (EDITABLE IN PROJECT SETTINGS)
              </div>
              <p className="text-xs text-[#F1F5F9] leading-relaxed mt-1">
                {project.workingResearchQuestion ||
                  'How can checkpoint-based geometric inspection and parameter recalibration improve the dimensional accuracy, repeatability, and assembly fit of robotically 3D-printed ceramic structural nodes across wet, dry, and fired states?'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveModule('experiment-lab')}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-xs transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Experiment / Node Study
            </button>
            <button
              onClick={() => setActiveModule('project-settings')}
              className="px-4 py-2 bg-[#151C28] hover:bg-[#1E293B] text-[#F1F5F9] border border-[#1E293B] font-medium text-xs transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-[#94A3B8]" />
              Edit Research Framing
            </button>
          </div>
        </div>

        {/* Research Questions & Hypotheses Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 pt-6 border-t border-[#1E293B]">
          <div>
            <h2 className="text-xs font-mono text-[#94A3B8] mb-2">
              01. Research Questions ({project.researchQuestions.length})
            </h2>
            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
              {project.researchQuestions.map((rq, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-cyan-400 shrink-0">RQ{idx + 1}</span>
                  <span>{rq}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-mono text-[#94A3B8] mb-2">
              02. Testable Hypotheses ({project.hypotheses.length})
            </h2>
            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
              {project.hypotheses.map((hyp, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-amber-400 shrink-0">H{idx + 1}</span>
                  <span>{hyp}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-mono text-[#94A3B8] mb-2">
              03. Submitted Thesis Abstract Status
            </h2>
            {project.submittedAbstract.trim() ? (
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
                {project.submittedAbstract}
              </p>
            ) : (
              <div className="p-3 bg-[#0B0E14] border border-[#1E293B] text-xs text-[#94A3B8] space-y-2">
                <p>
                  No official submitted abstract has been entered yet. The Working
                  Research Question above is kept strictly separate from the official
                  Submitted Thesis Abstract.
                </p>
                <button
                  onClick={() => setActiveModule('project-settings')}
                  className="text-cyan-400 hover:underline font-mono text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  Enter submitted abstract in Project Settings{' '}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Empty State or Telemetry KPI Strip */}
      {experiments.length === 0 ? (
        <section className="bg-[#0F141C] border border-[#1E293B] p-8">
          <div className="max-w-2xl space-y-4">
            <div className="text-xs font-mono text-cyan-400">
              CLEAN SCIENTIFIC WORKSPACE INITIALIZED (v0.1.1)
            </div>
            <h2 className="text-xl font-semibold text-[#F1F5F9]">
              Zero Experiments Recorded in Local Repository
            </h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              To maintain scientific integrity, Fabrication Research OS starts with an empty
              empirical database. You can begin logging your own material batches, hardware
              configurations, ceramic node designs, specimens, and experiments immediately,
              or load the non-destructive MRAC sample dataset (including `EXP-004` Ceramic
              Node Fabrication with `NODE-A V01` and stage-separated GREEN/DRY measurements).
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setActiveModule('experiment-lab')}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-xs transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FlaskConical className="w-4 h-4" />
                Open Experiment Lab & Create First Run
              </button>
              <button
                onClick={handleLoadSample}
                className="px-4 py-2 bg-[#151C28] hover:bg-[#1E293B] text-[#F1F5F9] border border-[#1E293B] font-medium text-xs transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Database className="w-4 h-4 text-cyan-400" />
                Load Sample MRAC Dataset (Removable Fixtures)
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* 6-Column Quantitative Repository Strip */}
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-[#0F141C] border border-[#1E293B] p-4">
              <div className="text-xs text-[#94A3B8]">Experiments</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-semibold text-[#F1F5F9] tabular-nums">
                  {experiments.length}
                </span>
                <span className="text-xs font-mono text-[#94A3B8] ml-1.5">runs</span>
              </div>
              <div className="mt-2 text-xs text-[#94A3B8] font-mono">
                {ceramicNodeExperiments.length} node · {baselineExperiments.length} base ·{' '}
                {proposedExperiments.length} adapt
              </div>
            </div>

            <div className="bg-[#0F141C] border border-[#1E293B] p-4">
              <div className="text-xs text-[#94A3B8]">Node Designs & Specs</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-semibold text-[#F1F5F9] tabular-nums">
                  {specimens.length}
                </span>
                <span className="text-xs font-mono text-[#94A3B8] ml-1.5">specimens</span>
              </div>
              <div className="mt-2 text-xs text-[#94A3B8] font-mono">
                {nodeDesigns.length} node design(s) · {assemblyVerifications.length} fit tests
              </div>
            </div>

            <div className="bg-[#0F141C] border border-[#1E293B] p-4">
              <div className="text-xs text-[#94A3B8]">Materials & Hardware</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-semibold text-[#F1F5F9] tabular-nums">
                  {materialProfiles.length}
                </span>
                <span className="text-xs font-mono text-[#94A3B8] ml-1.5">batches</span>
              </div>
              <div className="mt-2 text-xs text-[#94A3B8] font-mono">
                {hardwareProfiles.length} configured setups
              </div>
            </div>

            <div className="bg-[#0F141C] border border-[#1E293B] p-4">
              <div className="text-xs text-[#94A3B8]">Verified Measurements</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-semibold text-[#F1F5F9] tabular-nums">
                  {verifiedMeasurements.length}
                </span>
                <span className="text-xs font-mono text-[#94A3B8] ml-1.5">pts</span>
              </div>
              <div className="mt-2 text-xs text-[#94A3B8] font-mono">
                Stage-tagged metrology
              </div>
            </div>

            <div className="bg-[#0F141C] border border-[#1E293B] p-4">
              <div className="text-xs text-[#94A3B8]">Calibration Sessions</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-semibold text-[#F1F5F9] tabular-nums">
                  {calibrationSessions.length}
                </span>
                <span className="text-xs font-mono text-[#94A3B8] ml-1.5">sessions</span>
              </div>
              <div className="mt-2 text-xs text-[#94A3B8] font-mono">
                {snapshot.calibrationTrials.length} empirical trials
              </div>
            </div>

            <div className="bg-[#0F141C] border border-[#1E293B] p-4">
              <div className="text-xs text-[#94A3B8]">Literature & Metrics</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-semibold text-[#F1F5F9] tabular-nums">
                  {researchReferences.length}
                </span>
                <span className="text-xs font-mono text-[#94A3B8] ml-1.5">refs</span>
              </div>
              <div className="mt-2 text-xs text-[#94A3B8] font-mono">
                {productionMetrics.length} production logs
              </div>
            </div>
          </section>

          {/* Empirical Baseline vs. Recalibration Comparison Table */}
          <section className="bg-[#0F141C] border border-[#1E293B]">
            <div className="px-6 py-4 border-b border-[#1E293B] flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#F1F5F9]">
                  Cross-Module Experiment, Node & Quality Traceability
                </h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Click any experiment to inspect its node/specimen features, geometric
                  residuals, calibration trials, or layer observations.
                </p>
              </div>
              <button
                onClick={() => setActiveModule('experiment-lab')}
                className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Open Full Registry <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1E293B] text-[11px] font-mono text-[#94A3B8] bg-[#0B0E14]">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Title, Workflow & Group</th>
                    <th className="py-3 px-4">Material Batch / Node</th>
                    <th className="py-3 px-4 text-right">Speed / Rel. Flow</th>
                    <th className="py-3 px-4 text-right">Bead Width RMSE</th>
                    <th className="py-3 px-4 text-right">Pass Rate</th>
                    <th className="py-3 px-4">Quality Status</th>
                    <th className="py-3 px-4 text-right">Inspect Module</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B] text-xs">
                  {experiments.map((exp) => {
                    const mat = materialProfiles.find(
                      (m) => m.id === exp.materialProfileId
                    );
                    const nodeDesign = exp.nodeDesignId
                      ? nodeDesigns.find((nd) => nd.id === exp.nodeDesignId)
                      : undefined;
                    const expSpecs = specimens.filter((s) => s.experimentId === exp.id);
                    const quality = evaluateExperimentQuality(exp, measurements);
                    const refBase = exp.referenceBaselineExperimentId
                      ? experiments.find(
                          (e) => e.id === exp.referenceBaselineExperimentId
                        )
                      : undefined;
                    const comparison =
                      refBase && exp.id !== refBase.id
                        ? compareExperimentToBaseline(
                            refBase,
                            exp,
                            measurements,
                            productionMetrics
                          )
                        : null;

                    return (
                      <tr
                        key={exp.id}
                        className="hover:bg-[#151C28]/70 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-cyan-400 whitespace-nowrap">
                          {exp.experimentCode}
                          {exp.isSampleFixture && (
                            <span className="ml-2 text-[10px] text-[#94A3B8] font-normal">
                              · Sample
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-[#F1F5F9]">{exp.title}</div>
                          <div className="text-[11px] text-[#94A3B8] mt-0.5">
                            {exp.researchWorkflowType} · {exp.experimentGroup} ·{' '}
                            {exp.status}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">
                          <div>
                            {mat
                              ? `${mat.batchIdentifier} (${mat.materialType})`
                              : 'Unassigned'}
                          </div>
                          {nodeDesign && (
                            <div className="text-[11px] text-cyan-400">
                              Node: {nodeDesign.nodeDesignCode}-{nodeDesign.geometryVersion}{' '}
                              ({expSpecs.length} specs)
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="text-[#F1F5F9]">
                            {exp.processParameters.printSpeedMmPerSec.toFixed(1)}
                          </span>
                          <span className="text-[#94A3B8] text-[10px] ml-1">mm/s</span>
                          <span className="text-[#94A3B8] mx-1.5">/</span>
                          <span className="text-[#F1F5F9]">
                            {exp.processParameters.relativeFlowPercent.toFixed(1)}
                          </span>
                          <span className="text-[#94A3B8] text-[10px] ml-0.5">%</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          {quality.rmseBeadWidthMm !== null ? (
                            <div>
                              <span className="text-[#F1F5F9]">
                                {quality.rmseBeadWidthMm.toFixed(2)}
                              </span>
                              <span className="text-[#94A3B8] text-[10px] ml-1">mm</span>
                              {comparison &&
                                comparison.beadWidthRmseDeltaPercent !== null && (
                                  <div className="text-[10px] text-emerald-400">
                                    {comparison.beadWidthRmseDeltaPercent > 0 ? '+' : ''}
                                    {comparison.beadWidthRmseDeltaPercent.toFixed(1)}% vs{' '}
                                    {comparison.baselineExperimentCode}
                                  </div>
                                )}
                            </div>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          {quality.overallPassRatePercent !== null ? (
                            <span>{quality.overallPassRatePercent.toFixed(1)} %</span>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono whitespace-nowrap">
                          {quality.qualityStatus === 'Within Tolerance' && (
                            <span className="text-emerald-400">● Within Tolerance</span>
                          )}
                          {quality.qualityStatus === 'Marginal Drift' && (
                            <span className="text-amber-400">▲ Marginal Drift</span>
                          )}
                          {quality.qualityStatus === 'Out of Tolerance' && (
                            <span className="text-rose-400">✖ Out of Tolerance</span>
                          )}
                          {quality.qualityStatus === 'Insufficient Data' && (
                            <span className="text-[#94A3B8]">○ Insufficient Data</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() =>
                                navigateToExperimentInModule(
                                  exp.id,
                                  'quality-inspector'
                                )
                              }
                              className="px-2.5 py-1 bg-[#151C28] hover:bg-[#1E293B] border border-[#1E293B] text-[#F1F5F9] text-[11px] font-mono cursor-pointer"
                            >
                              Quality / Node
                            </button>
                            <button
                              onClick={() =>
                                navigateToExperimentInModule(
                                  exp.id,
                                  'calibration-studio'
                                )
                              }
                              className="px-2.5 py-1 bg-[#151C28] hover:bg-[#1E293B] border border-[#1E293B] text-[#F1F5F9] text-[11px] font-mono cursor-pointer"
                            >
                              Calibrate
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Six Interconnected Modules Directory & v0.1.1 Status */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0F141C] border border-[#1E293B] p-6">
          <h2 className="text-base font-semibold text-[#F1F5F9] mb-4">
            Integrated Research Modules (Shared 17-Entity Repository)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setActiveModule('experiment-lab')}
              className="text-left p-4 bg-[#0B0E14] hover:bg-[#151C28] border border-[#1E293B] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400">01. EXPERIMENT LAB</span>
                <span className="text-[11px] font-mono text-emerald-400">● v0.1.1 Core</span>
              </div>
              <div className="text-sm font-semibold text-[#F1F5F9] mt-1">
                Registry, Node Designs, Specimen Registry & Pilot Planner
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Create experiments, manage Node Designs & Feature Definitions, register
                replicate specimens, and plan Group 1 & Group 2 pilot studies.
              </p>
            </button>

            <button
              onClick={() => setActiveModule('quality-inspector')}
              className="text-left p-4 bg-[#0B0E14] hover:bg-[#151C28] border border-[#1E293B] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400">02. QUALITY INSPECTOR</span>
                <span className="text-[11px] font-mono text-emerald-400">
                  ● Node & Extrusion
                </span>
              </div>
              <div className="text-sm font-semibold text-[#F1F5F9] mt-1">
                Extrusion Inspection & Node / Joint Metrology
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Switch between Extrusion Inspection and Node / Joint Inspection with
                GREEN/DRY/FIRED stage tracking, shrinkage calculation, and physical
                assembly fit verification.
              </p>
            </button>

            <button
              onClick={() => setActiveModule('calibration-studio')}
              className="text-left p-4 bg-[#0B0E14] hover:bg-[#151C28] border border-[#1E293B] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400">03. CALIBRATION STUDIO</span>
                <span className="text-[11px] font-mono text-emerald-400">● Deterministic</span>
              </div>
              <div className="text-sm font-semibold text-[#F1F5F9] mt-1">
                Checkpoint Recalibration & Node Target Metrics
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Compare Group 1 (Fixed Baseline) vs. Group 2 (Checkpoint Recalibration)
                across bead width, socket diameter, and joint axis angle targets.
              </p>
            </button>

            <button
              onClick={() => setActiveModule('process-explorer')}
              className="text-left p-4 bg-[#0B0E14] hover:bg-[#151C28] border border-[#1E293B] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400">04. PROCESS EXPLORER</span>
                <span className="text-[11px] font-mono text-amber-400">▲ Sync-Guarded</span>
              </div>
              <div className="text-sm font-semibold text-[#F1F5F9] mt-1">
                Specimen-Filtered Observations & Checkpoint Events
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Filter process streams by specimen, annotate checkpoint inspections and
                parameter adjustments, and enforce clock/frame alignment guards.
              </p>
            </button>

            <button
              onClick={() => setActiveModule('research-library')}
              className="text-left p-4 bg-[#0B0E14] hover:bg-[#151C28] border border-[#1E293B] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400">05. RESEARCH LIBRARY</span>
                <span className="text-[11px] font-mono text-emerald-400">● Traceable</span>
              </div>
              <div className="text-sm font-semibold text-[#F1F5F9] mt-1">
                Ceramic Node, Shrinkage & Robotic Clay Literature
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Curate references across Ceramic Additive Manufacturing, Shrinkage &
                Drying Behavior, Structural Nodes, and Feedforward/Checkpoint Control.
              </p>
            </button>

            <button
              onClick={() => setActiveModule('industry-metrics')}
              className="text-left p-4 bg-[#0B0E14] hover:bg-[#151C28] border border-[#1E293B] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400">06. INDUSTRY METRICS</span>
                <span className="text-[11px] font-mono text-emerald-400">● Stage Yield</span>
              </div>
              <div className="text-sm font-semibold text-[#F1F5F9] mt-1">
                GREEN / DRY / FIRED / Assembly Yield & Cycle Time
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Track stage-separated acceptance counts, rework counts, and accepted
                specimens per active print hour, booked cell hour, and complete process time.
              </p>
            </button>
          </div>
        </div>

        {/* v0.1.1 Implementation & Scientific Safeguards Summary */}
        <div className="bg-[#0F141C] border border-[#1E293B] p-6 space-y-4">
          <div className="text-xs font-mono text-cyan-400">
            IMPLEMENTATION STATUS — v0.1.1 (SCHEMA v2)
          </div>
          <h2 className="text-base font-semibold text-[#F1F5F9]">
            Verified Capabilities & Deferred Scope
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <div className="font-mono text-emerald-400 mb-1">
                ● FUNCTIONAL & VERIFIED IN v0.1.1
              </div>
              <ul className="space-y-1 text-[#94A3B8]">
                <li>· Canonical 17-entity IndexedDB repository (non-destructive v1→v2 upgrade)</li>
                <li>· NodeDesign, NodeFeatureDefinition, Specimen & AssemblyVerification entities</li>
                <li>· Physical stage tracking (GREEN, DRY, FIRED, Stage Unknown, Custom)</li>
                <li>· Deterministic linear shrinkage, symmetric/asymmetric tolerance & clearance</li>
                <li>· Dual-mode Quality Inspector (Extrusion + Node/Joint Schematic & Fit Test)</li>
                <li>· 10-specimen Pilot Study Planner & stage-separated Industry Metrics</li>
                <li>· Backward-compatible v0.1.0 & v0.1.1 CSV/JSON import/export</li>
              </ul>
            </div>
            <div className="pt-2 border-t border-[#1E293B]">
              <div className="font-mono text-amber-400 mb-1">
                ▲ PLANNED / DEFERRED TO PHASE B
              </div>
              <ul className="space-y-1 text-[#94A3B8]">
                <li>· Live ABB IRC5 / RobotStudio socket telemetry streaming</li>
                <li>· Live RGB-D / laser line camera frame capture & point-cloud registration</li>
                <li>· Automated multi-variable Bayesian/MPC closed-loop control</li>
                <li>· Cloud PostgreSQL / multi-user synchronization adapter</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
