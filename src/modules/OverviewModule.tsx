import React from 'react';
import {
  ArrowRight,
  Beaker,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  Database,
  FileSpreadsheet,
  FlaskConical,
  Factory,
  Layers,
  Plus,
  Settings,
  Sliders,
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

  const handleLoadSample = async () => {
    await repository.loadSampleDatasetNonDestructive();
    await refreshWorkspace();
    notifyToast('Loaded MRAC 2026–2027 sample dataset (flagged as removable sample fixtures).');
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
              <span>SCHEMA v{project.schemaVersion}</span>
              <span aria-hidden="true">·</span>
              <span>LOCAL-FIRST INDEXEDDB REPOSITORY</span>
            </div>
            <h1 className="text-2xl font-semibold text-[#F1F5F9] tracking-tight">
              {project.workingThesisTitle || project.name}
            </h1>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Empirical research workstation for evaluating fixed-parameter fabrication baselines,
              manual operator tuning, and feedforward / checkpoint recalibration across robotic
              clay and polymer additive manufacturing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveModule('experiment-lab')}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-xs transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Experiment
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
                  No official submitted abstract has been entered yet. This software never
                  fabricates or claims an unverified thesis abstract.
                </p>
                <button
                  onClick={() => setActiveModule('project-settings')}
                  className="text-cyan-400 hover:underline font-mono text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  Enter submitted abstract in Project Settings <ArrowRight className="w-3 h-3" />
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
              CLEAN SCIENTIFIC WORKSPACE INITIALIZED
            </div>
            <h2 className="text-xl font-semibold text-[#F1F5F9]">
              Zero Experiments Recorded in Local Repository
            </h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              To maintain scientific integrity, Fabrication Research OS starts with an empty
              empirical database. You can begin logging your own material batches, hardware
              configurations, and experiments immediately, or load the non-destructive MRAC
              sample dataset (comparing ABB IRB 140 clay extrusion baseline vs. checkpoint
              recalibration and desktop PETG runs) to inspect all six interconnected modules.
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
                {baselineExperiments.length} baseline · {proposedExperiments.length} adaptive
              </div>
            </div>

            <div className="bg-[#0F141C] border border-[#1E293B] p-4">
              <div className="text-xs text-[#94A3B8]">Material Profiles</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-semibold text-[#F1F5F9] tabular-nums">
                  {materialProfiles.length}
                </span>
                <span className="text-xs font-mono text-[#94A3B8] ml-1.5">batches</span>
              </div>
              <div className="mt-2 text-xs text-[#94A3B8] font-mono">
                Clay, ceramic & polymer
              </div>
            </div>

            <div className="bg-[#0F141C] border border-[#1E293B] p-4">
              <div className="text-xs text-[#94A3B8]">Hardware Profiles</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-semibold text-[#F1F5F9] tabular-nums">
                  {hardwareProfiles.length}
                </span>
                <span className="text-xs font-mono text-[#94A3B8] ml-1.5">setups</span>
              </div>
              <div className="mt-2 text-xs text-[#94A3B8] font-mono">
                Robotic & desktop cells
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
                Physical specimen records
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
                  Cross-Module Experiment & Quality Traceability
                </h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Click any experiment to inspect its geometric residuals, calibration trials, or
                  layer observations.
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
                    <th className="py-3 px-4">Title & Method</th>
                    <th className="py-3 px-4">Material Batch</th>
                    <th className="py-3 px-4 text-right">Speed / Rel. Flow</th>
                    <th className="py-3 px-4 text-right">Bead Width RMSE</th>
                    <th className="py-3 px-4 text-right">Pass Rate</th>
                    <th className="py-3 px-4">Quality Status</th>
                    <th className="py-3 px-4 text-right">Inspect Module</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B] text-xs">
                  {experiments.map((exp) => {
                    const mat = materialProfiles.find((m) => m.id === exp.materialProfileId);
                    const quality = evaluateExperimentQuality(exp, measurements);
                    const refBase = exp.referenceBaselineExperimentId
                      ? experiments.find((e) => e.id === exp.referenceBaselineExperimentId)
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
                            {exp.baselineOrProposedMethod} · {exp.status}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">
                          {mat ? `${mat.batchIdentifier} (${mat.materialType})` : 'Unassigned'}
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
                                navigateToExperimentInModule(exp.id, 'quality-inspector')
                              }
                              className="px-2.5 py-1 bg-[#151C28] hover:bg-[#1E293B] border border-[#1E293B] text-[#F1F5F9] text-[11px] font-mono cursor-pointer"
                            >
                              Quality
                            </button>
                            <button
                              onClick={() =>
                                navigateToExperimentInModule(exp.id, 'calibration-studio')
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

      {/* Six Interconnected Modules Directory & Phase A Architecture Status */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0F141C] border border-[#1E293B] p-6">
          <h2 className="text-base font-semibold text-[#F1F5F9] mb-4">
            Integrated Research Modules (Shared Data Repository)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setActiveModule('experiment-lab')}
              className="text-left p-4 bg-[#0B0E14] hover:bg-[#151C28] border border-[#1E293B] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400">01. EXPERIMENT LAB</span>
                <span className="text-[11px] font-mono text-emerald-400">● Phase A Core</span>
              </div>
              <div className="text-sm font-semibold text-[#F1F5F9] mt-1">
                Registry, 7-Step Wizard & Profiles
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Create and compare experiments, configure Material & Hardware profiles, and
                separate relative flow % from physical volumetric flow rates.
              </p>
            </button>

            <button
              onClick={() => setActiveModule('quality-inspector')}
              className="text-left p-4 bg-[#0B0E14] hover:bg-[#151C28] border border-[#1E293B] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400">02. QUALITY INSPECTOR</span>
                <span className="text-[11px] font-mono text-emerald-400">● Phase A Core</span>
              </div>
              <div className="text-sm font-semibold text-[#F1F5F9] mt-1">
                Metrological Verification & Schematic View
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Log verified physical measurements, evaluate RMSE/pass rates, withhold Cp/Cpk
                unless n≥25 stability is met, and distinguish schematic vs. scanned geometry.
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
                Bounds Checking & Empirical Trials
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Separate observed experimental trials from unvalidated candidates. Enforce
                parameter bounds and require ≥3 empirical trials before interpolation.
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
                Layer Observations & Alignment Guard
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Inspect layer-indexed observations with explicit clock synchronization and
                coordinate-frame consistency checks prior to stream correlation.
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
                Citations, Evidence Levels & Experiment Links
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Manage literature references with DOI verification status, methodological
                categories, and direct links to experiments.
              </p>
            </button>

            <button
              onClick={() => setActiveModule('industry-metrics')}
              className="text-left p-4 bg-[#0B0E14] hover:bg-[#151C28] border border-[#1E293B] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400">06. INDUSTRY METRICS</span>
                <span className="text-[11px] font-mono text-emerald-400">● Empirical Yield</span>
              </div>
              <div className="text-sm font-semibold text-[#F1F5F9] mt-1">
                Yield, Scrap Waste & Cycle Time Accounting
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Compare accepted/rejected part counts, calibration pause overhead, and manual
                cost inputs between baseline and recalibrated runs.
              </p>
            </button>
          </div>
        </div>

        {/* Phase A Implementation & Scientific Safeguards Summary */}
        <div className="bg-[#0F141C] border border-[#1E293B] p-6 space-y-4">
          <div className="text-xs font-mono text-cyan-400">
            IMPLEMENTATION STATUS — v0.1.0 (PHASE A)
          </div>
          <h2 className="text-base font-semibold text-[#F1F5F9]">
            Verified Capabilities & Deferred Scope
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <div className="font-mono text-emerald-400 mb-1">
                ● FUNCTIONAL & VERIFIED IN PHASE A
              </div>
              <ul className="space-y-1 text-[#94A3B8]">
                <li>· Canonical 13-entity IndexedDB repository with audit log</li>
                <li>· Experiment Lab: Registry, 7-step Wizard, Comparison & CRUD</li>
                <li>· Configurable Material & Hardware Profiles (Planned/Available/Configured/Connected)</li>
                <li>· Numerical Quality Inspector with schematic vs. scanned profile distinction & Cp/Cpk n≥25 guard</li>
                <li>· Deterministic Calibration Studio separating observed trials from candidates</li>
                <li>· Versioned JSON backup/restore & CSV measurement import/export</li>
                <li>· Non-destructive sample dataset loader/remover (never deletes user research data)</li>
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
