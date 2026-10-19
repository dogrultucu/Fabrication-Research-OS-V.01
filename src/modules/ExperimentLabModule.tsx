import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Check,
  Columns,
  Download,
  Eye,
  Filter,
  FlaskConical,
  Layers,
  Plus,
  Search,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  EquipmentCategory,
  EquipmentCategoryEnum,
  EquipmentReadinessStatus,
  EquipmentReadinessStatusEnum,
  Experiment,
  ExperimentSchema,
  ExperimentStatus,
  ExperimentStatusEnum,
  ExperimentType,
  ExperimentTypeEnum,
  HardwareProfile,
  MaterialProfile,
  MaterialType,
  MaterialTypeEnum,
  MeasuredMaterialProperty,
  MethodClassification,
  MethodClassificationEnum,
  ParameterSource,
  ParameterSourceEnum,
  SensingHardwareItem,
  TargetToleranceCriterion,
  VolumetricFlowUnit,
  VolumetricFlowUnitEnum,
} from '../domain/models';
import { PHASE_A_INTEGRATION_ADAPTERS } from '../integrations/adapters';
import { useResearchWorkspace } from '../repositories/repository';
import {
  compareExperimentToBaseline,
  evaluateExperimentQuality,
} from '../scientific/calculations';
import {
  exportExperimentsToCsv,
  triggerBrowserDownload,
} from '../services/importExport';

type LabSubTab = 'registry' | 'wizard' | 'compare' | 'profiles';

export const ExperimentLabModule: React.FC = () => {
  const {
    snapshot,
    repository,
    refreshWorkspace,
    notifyToast,
    globalSearchQuery,
    navigateToExperimentInModule,
    selectedExperimentId,
    setSelectedExperimentId,
  } = useResearchWorkspace();

  const [subTab, setSubTab] = useState<LabSubTab>('registry');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [materialFilter, setMaterialFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'code' | 'date' | 'rmse'>('code');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Comparison state
  const [compareBaselineId, setCompareBaselineId] = useState<string>('');
  const [compareProposedId, setCompareProposedId] = useState<string>('');

  // Wizard state (7 steps)
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const [expCode, setExpCode] = useState<string>(() => {
    const count = (snapshot?.experiments.length || 0) + 1;
    return `EXP-2026-${String(count).padStart(3, '0')}`;
  });
  const [expTitle, setExpTitle] = useState<string>('');
  const [expObjective, setExpObjective] = useState<string>('');
  const [expHypothesis, setExpHypothesis] = useState<string>('');
  const [expMaterialId, setExpMaterialId] = useState<string>(
    snapshot?.materialProfiles[0]?.id || ''
  );
  const [expHardwareId, setExpHardwareId] = useState<string>(
    snapshot?.hardwareProfiles[0]?.id || ''
  );
  const [expType, setExpType] = useState<ExperimentType>('Single-Bead Characterization');
  const [expMethod, setExpMethod] = useState<MethodClassification>(
    'Fixed-Parameter Baseline'
  );
  const [expRefBaselineId, setExpRefBaselineId] = useState<string>('');
  const [expStatus, setExpStatus] = useState<ExperimentStatus>('Planned');
  const [expPlannedDate, setExpPlannedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [expOperator, setExpOperator] = useState<string>('O. B. Dogrultucu');
  const [expTargetGeometry, setExpTargetGeometry] = useState<string>(
    'CAD_TestWall_L200_H60mm.gh'
  );
  const [expNotes, setExpNotes] = useState<string>('');

  // Process Parameters state
  const [printSpeed, setPrintSpeed] = useState<number>(35.0);
  const [relativeFlow, setRelativeFlow] = useState<number>(100.0);
  const [volumetricFlow, setVolumetricFlow] = useState<string>('');
  const [volumetricUnit, setVolumetricUnit] = useState<VolumetricFlowUnit>('mm³/s');
  const [layerHeight, setLayerHeight] = useState<number>(3.0);
  const [targetBeadWidth, setTargetBeadWidth] = useState<number>(6.5);
  const [nozzleDiameter, setNozzleDiameter] = useState<number>(6.0);
  const [toolOrientation, setToolOrientation] = useState<string>(
    'Planar Z-Normal (0° tilt)'
  );
  const [paramSource, setParamSource] = useState<ParameterSource>(
    'Pre-Fabrication Baseline'
  );
  const [customParamKey, setCustomParamKey] = useState<string>('pneumaticPressure');
  const [customParamVal, setCustomParamVal] = useState<string>('360');
  const [customParamUnit, setCustomParamUnit] = useState<string>('kPa');

  // Target tolerances state
  const [tolerances, setTolerances] = useState<TargetToleranceCriterion[]>([
    {
      measurementType: 'bead width',
      targetValue: 6.5,
      tolerancePlusMinus: 0.45,
      unit: 'mm',
    },
    {
      measurementType: 'bead height',
      targetValue: 3.0,
      tolerancePlusMinus: 0.25,
      unit: 'mm',
    },
    {
      measurementType: 'XYZ residual',
      targetValue: 0.0,
      tolerancePlusMinus: 0.8,
      unit: 'mm',
    },
  ]);

  // Inline New Material Profile state
  const [newMatType, setNewMatType] = useState<MaterialType>('clay');
  const [newMatName, setNewMatName] = useState<string>('');
  const [newMatBatch, setNewMatBatch] = useState<string>('');
  const [newMatSource, setNewMatSource] = useState<string>('');
  const [newMatPrep, setNewMatPrep] = useState<string>('');
  const [newMatProps, setNewMatProps] = useState<MeasuredMaterialProperty[]>([
    {
      key: 'moisture_content',
      label: 'Moisture Content',
      value: 22.5,
      unit: '%',
      measurementMethod: 'Gravimetric drying',
    },
  ]);

  // Inline New Hardware Profile state
  const [newHwName, setNewHwName] = useState<string>('');
  const [newHwCat, setNewHwCat] = useState<EquipmentCategory>('Industrial Robotic Cell');
  const [newHwStatus, setNewHwStatus] =
    useState<EquipmentReadinessStatus>('Configured');
  const [newHwRobot, setNewHwRobot] = useState<string>(
    'ABB IRB 140 (6-DOF, IRC5 Controller)'
  );
  const [newHwExtruder, setNewHwExtruder] = useState<string>(
    'Pneumatic Cartridge + Auger Extruder'
  );
  const [newHwNozzle, setNewHwNozzle] = useState<number>(6.0);
  const [newHwNotes, setNewHwNotes] = useState<string>('');
  const [newHwSensors, setNewHwSensors] = useState<SensingHardwareItem[]>([
    {
      id: 'sens-init-1',
      name: 'Mitutoyo Digital Caliper',
      modality: 'Digital Caliper',
      readinessStatus: 'Available',
      resolutionOrSpec: '0.01 mm resolution',
    },
  ]);

  if (!snapshot) return null;

  const {
    project,
    experiments,
    materialProfiles,
    hardwareProfiles,
    measurements,
    productionMetrics,
  } = snapshot;

  const filteredExperiments = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    const list = experiments.filter((exp) => {
      if (statusFilter !== 'ALL' && exp.status !== statusFilter) return false;
      if (methodFilter !== 'ALL' && exp.baselineOrProposedMethod !== methodFilter)
        return false;
      if (materialFilter !== 'ALL' && exp.materialProfileId !== materialFilter)
        return false;
      if (q) {
        const hay = `${exp.experimentCode} ${exp.title} ${exp.researchObjective} ${exp.operator}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'code') {
        cmp = a.experimentCode.localeCompare(b.experimentCode);
      } else if (sortBy === 'date') {
        cmp = a.plannedDate.localeCompare(b.plannedDate);
      } else if (sortBy === 'rmse') {
        const qa = evaluateExperimentQuality(a, measurements).rmseBeadWidthMm ?? 999;
        const qb = evaluateExperimentQuality(b, measurements).rmseBeadWidthMm ?? 999;
        cmp = qa - qb;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [
    experiments,
    statusFilter,
    methodFilter,
    materialFilter,
    globalSearchQuery,
    sortBy,
    sortAsc,
    measurements,
  ]);

  const inspectedExperiment =
    experiments.find((e) => e.id === selectedExperimentId) || filteredExperiments[0];

  const handleQuickStatusUpdate = async (
    exp: Experiment,
    nextStatus: ExperimentStatus
  ) => {
    const updated: Experiment = {
      ...exp,
      status: nextStatus,
      actualDate:
        nextStatus === 'Completed' && !exp.actualDate
          ? new Date().toISOString().slice(0, 10)
          : exp.actualDate,
      updatedAt: new Date().toISOString(),
    };
    await repository.saveExperiment(updated, false);
    await refreshWorkspace();
    notifyToast(`Updated ${exp.experimentCode} status to ${nextStatus}`);
  };

  const handleSaveNewMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName.trim() || !newMatBatch.trim() || !newMatSource.trim()) {
      notifyToast('Material Name, Batch Identifier, and Source are required.');
      return;
    }
    const unitsMap: Record<string, string> = {};
    newMatProps.forEach((p) => {
      unitsMap[p.key] = p.unit;
    });
    const profile: MaterialProfile = {
      id: `mat-${Date.now()}`,
      projectId: project.id,
      materialType: newMatType,
      materialName: newMatName.trim(),
      batchIdentifier: newMatBatch.trim(),
      preparationNotes: newMatPrep.trim(),
      measuredMaterialProperties: newMatProps,
      propertyUnits: unitsMap,
      source: newMatSource.trim(),
      isSampleFixture: false,
      createdAt: new Date().toISOString(),
    };
    await repository.saveMaterialProfile(profile, true);
    await refreshWorkspace();
    setExpMaterialId(profile.id);
    setNewMatName('');
    setNewMatBatch('');
    notifyToast(`Saved Material Profile ${profile.batchIdentifier}`);
  };

  const handleSaveNewHardware = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHwName.trim() || !newHwRobot.trim() || !newHwExtruder.trim()) {
      notifyToast('Hardware Profile Name, Motion Platform, and Extruder are required.');
      return;
    }
    const now = new Date().toISOString();
    const hw: HardwareProfile = {
      id: `hw-${Date.now()}`,
      name: newHwName.trim(),
      category: newHwCat,
      readinessStatus: newHwStatus,
      robotType: newHwRobot.trim(),
      extruderType: newHwExtruder.trim(),
      nozzleDiameterMm: Number(newHwNozzle) || 4.0,
      sensingHardware: newHwSensors,
      equipmentNotes: newHwNotes.trim(),
      isSampleFixture: false,
      createdAt: now,
      updatedAt: now,
    };
    await repository.saveHardwareProfile(hw, true);
    await refreshWorkspace();
    setExpHardwareId(hw.id);
    setNozzleDiameter(hw.nozzleDiameterMm);
    setNewHwName('');
    notifyToast(`Saved Hardware Profile ${hw.name}`);
  };

  const handleSubmitExperimentWizard = async () => {
    setWizardError(null);
    const now = new Date().toISOString();
    const expId = `exp-${Date.now()}`;
    const ppsId = `pps-${Date.now()}`;

    const matParams: Record<string, { value: number | string; unit: string }> = {};
    if (customParamKey.trim() && customParamVal.trim()) {
      const numVal = Number(customParamVal);
      matParams[customParamKey.trim()] = {
        value: Number.isFinite(numVal) ? numVal : customParamVal.trim(),
        unit: customParamUnit.trim() || 'unit',
      };
    }

    const candidate: Experiment = {
      id: expId,
      projectId: project.id,
      experimentCode: expCode.trim(),
      title: expTitle.trim(),
      researchObjective: expObjective.trim(),
      hypothesis: expHypothesis.trim(),
      materialProfileId: expMaterialId,
      experimentType: expType,
      baselineOrProposedMethod: expMethod,
      referenceBaselineExperimentId: expRefBaselineId || undefined,
      status: expStatus,
      plannedDate: expPlannedDate,
      actualDate: expStatus === 'Completed' ? expPlannedDate : undefined,
      operator: expOperator.trim(),
      hardwareProfileId: expHardwareId,
      processParameters: {
        id: ppsId,
        experimentId: expId,
        printSpeedMmPerSec: Number(printSpeed),
        relativeFlowPercent: Number(relativeFlow),
        volumetricFlowValue:
          volumetricFlow.trim() !== '' ? Number(volumetricFlow) : null,
        volumetricFlowUnit: volumetricUnit,
        layerHeightMm: Number(layerHeight),
        targetBeadWidthMm: Number(targetBeadWidth),
        toolOrientation: toolOrientation.trim(),
        nozzleDiameterMm: Number(nozzleDiameter),
        materialSpecificParameters: matParams,
        parameterSource: paramSource,
        isSampleFixture: false,
      },
      targetGeometryReference: expTargetGeometry.trim(),
      evaluationCriteriaSnapshot: tolerances,
      notes: expNotes.trim(),
      isSampleFixture: false,
      createdAt: now,
      updatedAt: now,
    };

    const parsed = ExperimentSchema.safeParse(candidate);
    if (!parsed.success) {
      setWizardError(
        parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(' · ')
      );
      return;
    }

    await repository.saveExperiment(parsed.data, true);
    await refreshWorkspace();
    setSelectedExperimentId(parsed.data.id);
    setSubTab('registry');
    setWizardStep(1);
    setExpCode(`EXP-2026-${String(experiments.length + 2).padStart(3, '0')}`);
    setExpTitle('');
    notifyToast(`Created experiment ${parsed.data.experimentCode}`);
  };

  return (
    <div className="space-y-6">
      {/* Module Header & Sub-Navigation */}
      <div className="bg-[#0F141C] border border-[#1E293B] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            MODULE 01 · EXPERIMENT LAB (PHASE A CORE VERTICAL SLICE)
          </div>
          <h1 className="text-xl font-semibold text-[#F1F5F9] mt-0.5">
            Experiment Registry, 7-Step Design Wizard & Equipment Profiles
          </h1>
        </div>

        {/* Interactive Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B0E14] border border-[#1E293B]">
          <button
            onClick={() => setSubTab('registry')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'registry'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-[#94A3B8] hover:text-[#F1F5F9]'
            }`}
          >
            Experiment Registry ({experiments.length})
          </button>
          <button
            onClick={() => {
              if (!expMaterialId && materialProfiles[0])
                setExpMaterialId(materialProfiles[0].id);
              if (!expHardwareId && hardwareProfiles[0])
                setExpHardwareId(hardwareProfiles[0].id);
              setSubTab('wizard');
            }}
            className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'wizard'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-[#94A3B8] hover:text-[#F1F5F9]'
            }`}
          >
            + 7-Step New Experiment Wizard
          </button>
          <button
            onClick={() => setSubTab('compare')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'compare'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-[#94A3B8] hover:text-[#F1F5F9]'
            }`}
          >
            Baseline vs. Proposed Comparison
          </button>
          <button
            onClick={() => setSubTab('profiles')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'profiles'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-[#94A3B8] hover:text-[#F1F5F9]'
            }`}
          >
            Material ({materialProfiles.length}) & Hardware ({hardwareProfiles.length}) Profiles
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: EXPERIMENT REGISTRY */}
      {subTab === 'registry' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#0F141C] border border-[#1E293B]">
            {/* Filter & Sort Controls */}
            <div className="p-4 border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3 bg-[#0B0E14]">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#151C28] border border-[#1E293B] text-xs text-[#F1F5F9] px-2.5 py-1.5 font-mono"
                >
                  <option value="ALL">All Statuses</option>
                  {ExperimentStatusEnum.options.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by method"
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="bg-[#151C28] border border-[#1E293B] text-xs text-[#F1F5F9] px-2.5 py-1.5 font-mono"
                >
                  <option value="ALL">All Methods</option>
                  {MethodClassificationEnum.options.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by material"
                  value={materialFilter}
                  onChange={(e) => setMaterialFilter(e.target.value)}
                  className="bg-[#151C28] border border-[#1E293B] text-xs text-[#F1F5F9] px-2.5 py-1.5 font-mono"
                >
                  <option value="ALL">All Material Batches</option>
                  {materialProfiles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.batchIdentifier} ({m.materialType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (sortBy === 'code') setSortAsc(!sortAsc);
                    else {
                      setSortBy('code');
                      setSortAsc(true);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-[#151C28] border border-[#1E293B] text-xs font-mono text-[#94A3B8] hover:text-[#F1F5F9] flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpDown className="w-3 h-3" /> Sort: {sortBy.toUpperCase()}
                </button>
                <button
                  onClick={() => {
                    const csv = exportExperimentsToCsv(filteredExperiments);
                    triggerBrowserDownload(
                      `FRO_Experiments_${new Date().toISOString().slice(0, 10)}.csv`,
                      csv,
                      'text/csv;charset=utf-8'
                    );
                    notifyToast(
                      `Exported ${filteredExperiments.length} experiment(s) to CSV.`
                    );
                  }}
                  disabled={filteredExperiments.length === 0}
                  className="px-2.5 py-1.5 bg-[#151C28] hover:bg-[#1E293B] disabled:opacity-40 border border-[#1E293B] text-xs font-mono text-[#F1F5F9] flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" /> CSV
                </button>
              </div>
            </div>

            {filteredExperiments.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-[#94A3B8]">
                  No experiments match the current filter criteria.
                </p>
                <button
                  onClick={() => setSubTab('wizard')}
                  className="px-4 py-2 bg-cyan-500 text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  Create New Experiment
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1E293B] text-[11px] font-mono text-[#94A3B8] bg-[#0B0E14]">
                      <th className="py-3 px-4">Code & Date</th>
                      <th className="py-3 px-4">Experiment & Method</th>
                      <th className="py-3 px-4">Material Batch</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Quality Evaluation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B] text-xs">
                    {filteredExperiments.map((exp) => {
                      const mat = materialProfiles.find(
                        (m) => m.id === exp.materialProfileId
                      );
                      const q = evaluateExperimentQuality(exp, measurements);
                      const isSelected = inspectedExperiment?.id === exp.id;
                      return (
                        <tr
                          key={exp.id}
                          onClick={() => setSelectedExperimentId(exp.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#151C28]'
                              : 'hover:bg-[#151C28]/50'
                          }`}
                        >
                          <td className="py-3 px-4 font-mono whitespace-nowrap">
                            <div className="text-cyan-400 font-semibold">
                              {exp.experimentCode}
                            </div>
                            <div className="text-[11px] text-[#94A3B8]">
                              {exp.plannedDate}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-[#F1F5F9]">
                              {exp.title}
                            </div>
                            <div className="text-[11px] text-[#94A3B8] mt-0.5">
                              {exp.experimentType} · {exp.baselineOrProposedMethod}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                            {mat ? (
                              <div>
                                <div>{mat.batchIdentifier}</div>
                                <div className="text-[10px] text-[#94A3B8]">
                                  {mat.materialType}
                                </div>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td
                            className="py-3 px-4 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              aria-label={`Status for ${exp.experimentCode}`}
                              value={exp.status}
                              onChange={(e) =>
                                handleQuickStatusUpdate(
                                  exp,
                                  e.target.value as ExperimentStatus
                                )
                              }
                              className="bg-[#0B0E14] border border-[#1E293B] text-[11px] font-mono text-[#F1F5F9] px-2 py-1"
                            >
                              {ExperimentStatusEnum.options.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                            <div>
                              {q.qualityStatus === 'Within Tolerance' && (
                                <span className="text-emerald-400">
                                  ● Within Tolerance
                                </span>
                              )}
                              {q.qualityStatus === 'Marginal Drift' && (
                                <span className="text-amber-400">
                                  ▲ Marginal Drift
                                </span>
                              )}
                              {q.qualityStatus === 'Out of Tolerance' && (
                                <span className="text-rose-400">
                                  ✖ Out of Tolerance
                                </span>
                              )}
                              {q.qualityStatus === 'Insufficient Data' && (
                                <span className="text-[#94A3B8]">
                                  ○ Insufficient Data
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#94A3B8]">
                              {q.verifiedMeasurementCount} verified pts
                              {q.rmseBeadWidthMm !== null
                                ? ` · RMSE ${q.rmseBeadWidthMm.toFixed(2)} mm`
                                : ''}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Inspection Panel for Selected Experiment */}
          <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-5">
            {inspectedExperiment ? (
              <>
                <div className="flex items-start justify-between border-b border-[#1E293B] pb-4">
                  <div>
                    <div className="text-xs font-mono text-cyan-400">
                      {inspectedExperiment.experimentCode} · {inspectedExperiment.status}
                    </div>
                    <h2 className="text-base font-semibold text-[#F1F5F9] mt-1">
                      {inspectedExperiment.title}
                    </h2>
                  </div>
                  <button
                    onClick={async () => {
                      await repository.deleteExperiment(inspectedExperiment.id);
                      await refreshWorkspace();
                      notifyToast(`Deleted ${inspectedExperiment.experimentCode}`);
                    }}
                    title="Delete Experiment"
                    className="p-1.5 text-[#94A3B8] hover:text-rose-400 border border-[#1E293B] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="font-mono text-[#94A3B8]">Research Objective</div>
                    <p className="text-slate-300 mt-0.5 leading-relaxed">
                      {inspectedExperiment.researchObjective}
                    </p>
                  </div>
                  <div>
                    <div className="font-mono text-[#94A3B8]">Hypothesis</div>
                    <p className="text-slate-300 mt-0.5 leading-relaxed">
                      {inspectedExperiment.hypothesis}
                    </p>
                  </div>
                </div>

                {/* Process Parameters Matrix */}
                <div className="bg-[#0B0E14] border border-[#1E293B] p-3.5 space-y-2">
                  <div className="text-[11px] font-mono text-[#94A3B8] flex items-center justify-between">
                    <span>PROCESS PARAMETER SET</span>
                    <span>{inspectedExperiment.processParameters.parameterSource}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <div>
                      <span className="text-[#94A3B8] block text-[10px]">
                        Print Speed
                      </span>
                      <span className="text-[#F1F5F9] font-semibold tabular-nums">
                        {inspectedExperiment.processParameters.printSpeedMmPerSec}
                      </span>
                      <span className="text-[#94A3B8] text-[10px] ml-1">mm/s</span>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] block text-[10px]">
                        Relative Flow (Slicer/Controller)
                      </span>
                      <span className="text-[#F1F5F9] font-semibold tabular-nums">
                        {inspectedExperiment.processParameters.relativeFlowPercent}
                      </span>
                      <span className="text-[#94A3B8] text-[10px] ml-1">%</span>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] block text-[10px]">
                        Physical Volumetric Flow
                      </span>
                      {inspectedExperiment.processParameters.volumetricFlowValue !==
                      null ? (
                        <>
                          <span className="text-[#F1F5F9] font-semibold tabular-nums">
                            {inspectedExperiment.processParameters.volumetricFlowValue}
                          </span>
                          <span className="text-[#94A3B8] text-[10px] ml-1">
                            {inspectedExperiment.processParameters.volumetricFlowUnit}
                          </span>
                        </>
                      ) : (
                        <span className="text-[#94A3B8] text-[11px]">
                          Uncharacterized
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[#94A3B8] block text-[10px]">
                        Layer H / Target Bead W
                      </span>
                      <span className="text-[#F1F5F9] font-semibold tabular-nums">
                        {inspectedExperiment.processParameters.layerHeightMm} /{' '}
                        {inspectedExperiment.processParameters.targetBeadWidthMm}
                      </span>
                      <span className="text-[#94A3B8] text-[10px] ml-1">mm</span>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] block text-[10px]">
                        Nozzle Diameter
                      </span>
                      <span className="text-[#F1F5F9] font-semibold tabular-nums">
                        {inspectedExperiment.processParameters.nozzleDiameterMm}
                      </span>
                      <span className="text-[#94A3B8] text-[10px] ml-1">mm</span>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] block text-[10px]">
                        Tool Orientation
                      </span>
                      <span className="text-[#F1F5F9] text-[11px]">
                        {inspectedExperiment.processParameters.toolOrientation}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Offline Integration Export Actions */}
                <div className="space-y-2 pt-2 border-t border-[#1E293B]">
                  <div className="text-[11px] font-mono text-[#94A3B8]">
                    CROSS-MODULE NAVIGATION & OFFLINE PARAMETER EXPORT
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        navigateToExperimentInModule(
                          inspectedExperiment.id,
                          'quality-inspector'
                        )
                      }
                      className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs text-center cursor-pointer"
                    >
                      Open in Quality Inspector
                    </button>
                    <button
                      onClick={() =>
                        navigateToExperimentInModule(
                          inspectedExperiment.id,
                          'calibration-studio'
                        )
                      }
                      className="px-3 py-2 bg-[#151C28] hover:bg-[#1E293B] border border-[#1E293B] text-[#F1F5F9] text-xs text-center cursor-pointer"
                    >
                      Open in Calibration Studio
                    </button>
                    <button
                      onClick={() => {
                        const json =
                          PHASE_A_INTEGRATION_ADAPTERS.grasshopper.exportParameterSetToGrasshopperJson(
                            inspectedExperiment.processParameters
                          );
                        triggerBrowserDownload(
                          `${inspectedExperiment.experimentCode}_GrasshopperParams.json`,
                          json
                        );
                        notifyToast('Exported Grasshopper parameter JSON.');
                      }}
                      className="px-3 py-1.5 bg-[#0B0E14] hover:bg-[#151C28] border border-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] text-[11px] font-mono cursor-pointer"
                    >
                      Export Grasshopper JSON
                    </button>
                    <button
                      onClick={() => {
                        const rapid =
                          PHASE_A_INTEGRATION_ADAPTERS.robotExport.generateCheckpointParameterSnippet(
                            inspectedExperiment.processParameters,
                            5
                          );
                        triggerBrowserDownload(
                          `${inspectedExperiment.experimentCode}_ABB_RAPID_Snippet.mod`,
                          rapid,
                          'text/plain;charset=utf-8'
                        );
                        notifyToast('Exported offline ABB RAPID parameter snippet.');
                      }}
                      className="px-3 py-1.5 bg-[#0B0E14] hover:bg-[#151C28] border border-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] text-[11px] font-mono cursor-pointer"
                    >
                      Export ABB RAPID Snippet
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-[#94A3B8]">
                Select an experiment row to inspect its parameters and tolerances.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: 7-STEP NEW EXPERIMENT WIZARD */}
      {subTab === 'wizard' && (
        <div className="bg-[#0F141C] border border-[#1E293B] p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
            <div>
              <div className="text-xs font-mono text-cyan-400">
                NEW EXPERIMENT WIZARD · STEP {wizardStep} OF 7
              </div>
              <h2 className="text-lg font-semibold text-[#F1F5F9]">
                {[
                  '1. Select or Create Material Profile',
                  '2. Select Equipment / Hardware Configuration',
                  '3. Define Research Objective & Hypothesis',
                  '4. Define Baseline or Proposed Recalibration Method',
                  '5. Enter Physical Process Parameters (Explicit Units)',
                  '6. Define Target Measurements & Tolerance Criteria',
                  '7. Review & Save Planned Experiment',
                ][wizardStep - 1]}
              </h2>
            </div>

            {/* Stepper Indicator */}
            <div className="flex items-center gap-1 font-mono text-xs">
              {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                <button
                  key={s}
                  onClick={() => setWizardStep(s)}
                  className={`w-7 h-7 flex items-center justify-center border cursor-pointer ${
                    wizardStep === s
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                      : wizardStep > s
                      ? 'bg-[#151C28] text-emerald-400 border-[#1E293B]'
                      : 'bg-[#0B0E14] text-[#94A3B8] border-[#1E293B]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {wizardError && (
            <div className="p-3 bg-rose-950/50 border border-rose-500/40 text-xs text-rose-300 font-mono">
              ✖ Validation Error: {wizardError}
            </div>
          )}

          {/* Step 1: Material Profile */}
          {wizardStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="block text-xs font-mono text-[#94A3B8]">
                  SELECT EXISTING MATERIAL PROFILE
                </label>
                {materialProfiles.length === 0 ? (
                  <div className="p-4 bg-[#0B0E14] border border-[#1E293B] text-xs text-[#94A3B8]">
                    No material profiles registered yet. Create one using the form on the
                    right.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {materialProfiles.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => setExpMaterialId(m.id)}
                        className={`p-3.5 border cursor-pointer transition-colors ${
                          expMaterialId === m.id
                            ? 'bg-[#151C28] border-cyan-500'
                            : 'bg-[#0B0E14] border-[#1E293B] hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-cyan-400 font-semibold">
                            {m.batchIdentifier}
                          </span>
                          <span className="text-[#94A3B8] uppercase">
                            {m.materialType}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-[#F1F5F9] mt-1">
                          {m.materialName}
                        </div>
                        <div className="text-xs text-[#94A3B8] mt-1">
                          {m.measuredMaterialProperties
                            .map((p) => `${p.label}: ${p.value} ${p.unit}`)
                            .join(' · ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={handleSaveNewMaterial}
                className="bg-[#0B0E14] border border-[#1E293B] p-4 space-y-3"
              >
                <div className="text-xs font-mono text-cyan-400">
                  OR CREATE NEW MATERIAL BATCH PROFILE
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1">
                      Material Type
                    </label>
                    <select
                      value={newMatType}
                      onChange={(e) => setNewMatType(e.target.value as MaterialType)}
                      className="w-full bg-[#151C28] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
                    >
                      {MaterialTypeEnum.options.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1">
                      Batch Identifier *
                    </label>
                    <input
                      type="text"
                      value={newMatBatch}
                      onChange={(e) => setNewMatBatch(e.target.value)}
                      placeholder="e.g. CLAY-2026-B03"
                      className="w-full bg-[#151C28] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">
                    Material Name *
                  </label>
                  <input
                    type="text"
                    value={newMatName}
                    onChange={(e) => setNewMatName(e.target.value)}
                    placeholder="e.g. Low-Shrinkage Stoneware Clay"
                    className="w-full bg-[#151C28] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">
                    Supplier / Source *
                  </label>
                  <input
                    type="text"
                    value={newMatSource}
                    onChange={(e) => setNewMatSource(e.target.value)}
                    placeholder="e.g. Cerámica Collet / IAAC Lab"
                    className="w-full bg-[#151C28] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">
                    Preparation Notes
                  </label>
                  <textarea
                    rows={2}
                    value={newMatPrep}
                    onChange={(e) => setNewMatPrep(e.target.value)}
                    placeholder="De-airing, drying temperature, hydration ratio..."
                    className="w-full bg-[#151C28] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#151C28] hover:bg-[#1E293B] border border-cyan-500/50 text-cyan-400 text-xs font-mono cursor-pointer"
                >
                  + Save & Select Material Profile
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Hardware Configuration */}
          {wizardStep === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="block text-xs font-mono text-[#94A3B8]">
                  SELECT HARDWARE / EQUIPMENT CONFIGURATION
                </label>
                {hardwareProfiles.length === 0 ? (
                  <div className="p-4 bg-[#0B0E14] border border-[#1E293B] text-xs text-[#94A3B8]">
                    No hardware profiles registered yet. Create one using the form on the
                    right.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {hardwareProfiles.map((hw) => (
                      <div
                        key={hw.id}
                        onClick={() => {
                          setExpHardwareId(hw.id);
                          setNozzleDiameter(hw.nozzleDiameterMm);
                        }}
                        className={`p-3.5 border cursor-pointer transition-colors ${
                          expHardwareId === hw.id
                            ? 'bg-[#151C28] border-cyan-500'
                            : 'bg-[#0B0E14] border-[#1E293B] hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-cyan-400">{hw.category}</span>
                          <span className="text-amber-400">
                            Status: {hw.readinessStatus}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-[#F1F5F9] mt-1">
                          {hw.name}
                        </div>
                        <div className="text-xs text-[#94A3B8] mt-1 font-mono">
                          {hw.robotType} · Nozzle {hw.nozzleDiameterMm} mm
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={handleSaveNewHardware}
                className="bg-[#0B0E14] border border-[#1E293B] p-4 space-y-3"
              >
                <div className="text-xs font-mono text-cyan-400">
                  OR CREATE NEW HARDWARE PROFILE
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1">
                      Category
                    </label>
                    <select
                      value={newHwCat}
                      onChange={(e) =>
                        setNewHwCat(e.target.value as EquipmentCategory)
                      }
                      className="w-full bg-[#151C28] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
                    >
                      {EquipmentCategoryEnum.options.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1">
                      Equipment Readiness
                    </label>
                    <select
                      value={newHwStatus}
                      onChange={(e) =>
                        setNewHwStatus(
                          e.target.value as EquipmentReadinessStatus
                        )
                      }
                      className="w-full bg-[#151C28] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                    >
                      {EquipmentReadinessStatusEnum.options.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">
                    Hardware Profile Name *
                  </label>
                  <input
                    type="text"
                    value={newHwName}
                    onChange={(e) => setNewHwName(e.target.value)}
                    placeholder="e.g. ABB IRB 120 + Pneumatic Clay Extruder"
                    className="w-full bg-[#151C28] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1">
                      Robot / Motion Platform *
                    </label>
                    <input
                      type="text"
                      value={newHwRobot}
                      onChange={(e) => setNewHwRobot(e.target.value)}
                      className="w-full bg-[#151C28] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1">
                      Nozzle Diameter (mm) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newHwNozzle}
                      onChange={(e) => setNewHwNozzle(Number(e.target.value))}
                      className="w-full bg-[#151C28] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">
                    Extruder Type *
                  </label>
                  <input
                    type="text"
                    value={newHwExtruder}
                    onChange={(e) => setNewHwExtruder(e.target.value)}
                    className="w-full bg-[#151C28] border border-[#1E293B] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#151C28] hover:bg-[#1E293B] border border-cyan-500/50 text-cyan-400 text-xs font-mono cursor-pointer"
                >
                  + Save & Select Hardware Profile
                </button>
              </form>
            </div>
          )}

          {/* Step 3: Objective & Hypothesis */}
          {wizardStep === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                      Experiment Code *
                    </label>
                    <input
                      type="text"
                      value={expCode}
                      onChange={(e) => setExpCode(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                      Planned Date *
                    </label>
                    <input
                      type="date"
                      value={expPlannedDate}
                      onChange={(e) => setExpPlannedDate(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Descriptive Experiment Title *
                  </label>
                  <input
                    type="text"
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    placeholder="e.g. Clay 20-Layer Cylinder Checkpoint Recalibration at L05 & L10"
                    className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Operator Name *
                  </label>
                  <input
                    type="text"
                    value={expOperator}
                    onChange={(e) => setExpOperator(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Research Objective *
                  </label>
                  <textarea
                    rows={3}
                    value={expObjective}
                    onChange={(e) => setExpObjective(e.target.value)}
                    placeholder="What physical phenomenon or recalibration question is being evaluated in this run?"
                    className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Falsifiable Hypothesis *
                  </label>
                  <textarea
                    rows={3}
                    value={expHypothesis}
                    onChange={(e) => setExpHypothesis(e.target.value)}
                    placeholder="State the expected quantitative effect compared with the baseline..."
                    className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Method Classification */}
          {wizardStep === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Experiment Type
                  </label>
                  <select
                    value={expType}
                    onChange={(e) => setExpType(e.target.value as ExperimentType)}
                    className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
                  >
                    {ExperimentTypeEnum.options.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Baseline or Proposed Recalibration Strategy
                  </label>
                  <select
                    value={expMethod}
                    onChange={(e) =>
                      setExpMethod(e.target.value as MethodClassification)
                    }
                    className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
                  >
                    {MethodClassificationEnum.options.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Reference Baseline Experiment (For Direct Delta Evaluation)
                  </label>
                  <select
                    value={expRefBaselineId}
                    onChange={(e) => setExpRefBaselineId(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
                  >
                    <option value="">None (This run is a standalone or baseline run)</option>
                    {experiments.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.experimentCode} — {e.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Target Geometry / CAD / Toolpath Reference *
                  </label>
                  <input
                    type="text"
                    value={expTargetGeometry}
                    onChange={(e) => setExpTargetGeometry(e.target.value)}
                    placeholder="e.g. CAD_Cylinder_D180_H60.gh"
                    className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Initial Experiment Status
                  </label>
                  <select
                    value={expStatus}
                    onChange={(e) =>
                      setExpStatus(e.target.value as ExperimentStatus)
                    }
                    className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
                  >
                    {ExperimentStatusEnum.options.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Process Parameters with Explicit Units */}
          {wizardStep === 5 && (
            <div className="space-y-4">
              <div className="p-3 bg-[#0B0E14] border border-[#1E293B] text-xs text-[#94A3B8] font-mono">
                UNIT DISCIPLINE GUARD: Relative Flow (%) is a controller/slicer multiplier and
                is strictly distinct from physical Volumetric Flow Rate (mm³/s, mL/min).
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Print Speed (mm/s) *
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.5"
                      value={printSpeed}
                      onChange={(e) => setPrintSpeed(Number(e.target.value))}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
                    />
                    <span className="px-2.5 py-2 bg-[#151C28] border border-l-0 border-[#1E293B] text-xs font-mono text-[#94A3B8]">
                      mm/s
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Relative Flow Multiplier (%) *
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.5"
                      value={relativeFlow}
                      onChange={(e) => setRelativeFlow(Number(e.target.value))}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
                    />
                    <span className="px-2.5 py-2 bg-[#151C28] border border-l-0 border-[#1E293B] text-xs font-mono text-[#94A3B8]">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Physical Volumetric Flow (Optional)
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.1"
                      value={volumetricFlow}
                      onChange={(e) => setVolumetricFlow(e.target.value)}
                      placeholder="Leave blank if unmeasured"
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
                    />
                    <select
                      value={volumetricUnit}
                      onChange={(e) =>
                        setVolumetricUnit(e.target.value as VolumetricFlowUnit)
                      }
                      className="bg-[#151C28] border border-l-0 border-[#1E293B] px-2 py-2 text-xs font-mono text-[#F1F5F9]"
                    >
                      {VolumetricFlowUnitEnum.options.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Layer Height (mm) *
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.1"
                      value={layerHeight}
                      onChange={(e) => setLayerHeight(Number(e.target.value))}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
                    />
                    <span className="px-2.5 py-2 bg-[#151C28] border border-l-0 border-[#1E293B] text-xs font-mono text-[#94A3B8]">
                      mm
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Target Bead Width (mm) *
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.1"
                      value={targetBeadWidth}
                      onChange={(e) => setTargetBeadWidth(Number(e.target.value))}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
                    />
                    <span className="px-2.5 py-2 bg-[#151C28] border border-l-0 border-[#1E293B] text-xs font-mono text-[#94A3B8]">
                      mm
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Nozzle Diameter (mm) *
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.1"
                      value={nozzleDiameter}
                      onChange={(e) => setNozzleDiameter(Number(e.target.value))}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
                    />
                    <span className="px-2.5 py-2 bg-[#151C28] border border-l-0 border-[#1E293B] text-xs font-mono text-[#94A3B8]">
                      mm
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Tool Orientation *
                  </label>
                  <input
                    type="text"
                    value={toolOrientation}
                    onChange={(e) => setToolOrientation(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Parameter Provenance
                  </label>
                  <select
                    value={paramSource}
                    onChange={(e) =>
                      setParamSource(e.target.value as ParameterSource)
                    }
                    className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
                  >
                    {ParameterSourceEnum.options.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                    Material-Specific Parameter (Key / Val / Unit)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={customParamKey}
                      onChange={(e) => setCustomParamKey(e.target.value)}
                      placeholder="Key"
                      className="w-1/3 bg-[#0B0E14] border border-[#1E293B] px-2 py-2 text-xs font-mono text-[#F1F5F9]"
                    />
                    <input
                      type="text"
                      value={customParamVal}
                      onChange={(e) => setCustomParamVal(e.target.value)}
                      placeholder="Value"
                      className="w-1/3 bg-[#0B0E14] border border-[#1E293B] px-2 py-2 text-xs font-mono text-[#F1F5F9]"
                    />
                    <input
                      type="text"
                      value={customParamUnit}
                      onChange={(e) => setCustomParamUnit(e.target.value)}
                      placeholder="Unit"
                      className="w-1/3 bg-[#0B0E14] border border-[#1E293B] px-2 py-2 text-xs font-mono text-[#F1F5F9]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Target Measurements & Tolerances */}
          {wizardStep === 6 && (
            <div className="space-y-4">
              <div className="text-xs text-[#94A3B8]">
                Specify target nominal values and ± tolerance bounds (in explicit physical
                units) to snapshot into this experiment for automatic pass/fail evaluation in
                Quality Inspector.
              </div>
              <div className="space-y-2">
                {tolerances.map((tol, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-4 gap-3 items-center bg-[#0B0E14] border border-[#1E293B] p-3"
                  >
                    <div className="font-mono text-xs text-cyan-400">
                      {tol.measurementType}
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[#94A3B8]">
                        Target Value ({tol.unit})
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={tol.targetValue}
                        onChange={(e) => {
                          const next = [...tolerances];
                          next[idx] = {
                            ...tol,
                            targetValue: Number(e.target.value),
                          };
                          setTolerances(next);
                        }}
                        className="w-full bg-[#151C28] border border-[#1E293B] px-2 py-1 text-xs font-mono text-[#F1F5F9]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[#94A3B8]">
                        ± Tolerance ({tol.unit})
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={tol.tolerancePlusMinus}
                        onChange={(e) => {
                          const next = [...tolerances];
                          next[idx] = {
                            ...tol,
                            tolerancePlusMinus: Number(e.target.value),
                          };
                          setTolerances(next);
                        }}
                        className="w-full bg-[#151C28] border border-[#1E293B] px-2 py-1 text-xs font-mono text-[#F1F5F9]"
                      />
                    </div>
                    <div className="text-xs font-mono text-[#94A3B8]">
                      Band: [{(tol.targetValue - tol.tolerancePlusMinus).toFixed(2)},{' '}
                      {(tol.targetValue + tol.tolerancePlusMinus).toFixed(2)}] {tol.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 7: Review & Save */}
          {wizardStep === 7 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0B0E14] border border-[#1E293B] p-4 text-xs font-mono">
                <div>
                  <span className="text-[#94A3B8]">Code & Title:</span>{' '}
                  <span className="text-cyan-400 font-semibold">{expCode}</span> —{' '}
                  <span className="text-[#F1F5F9]">{expTitle || '(Missing Title)'}</span>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Method Classification:</span>{' '}
                  <span className="text-[#F1F5F9]">{expMethod}</span>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Material Profile ID:</span>{' '}
                  <span className="text-[#F1F5F9]">{expMaterialId || '(Unselected)'}</span>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Hardware Profile ID:</span>{' '}
                  <span className="text-[#F1F5F9]">{expHardwareId || '(Unselected)'}</span>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Kinematics & Flow:</span>{' '}
                  <span className="text-[#F1F5F9]">
                    {printSpeed} mm/s · {relativeFlow}% rel. flow · Layer {layerHeight} mm ·
                    Bead {targetBeadWidth} mm
                  </span>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Physical Volumetric Flow:</span>{' '}
                  <span className="text-[#F1F5F9]">
                    {volumetricFlow ? `${volumetricFlow} ${volumetricUnit}` : 'Not specified'}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                  Additional Experiment Notes
                </label>
                <textarea
                  rows={2}
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
                />
              </div>
            </div>
          )}

          {/* Wizard Navigation Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-[#1E293B]">
            <button
              onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
              disabled={wizardStep === 1}
              className="px-4 py-2 bg-[#151C28] disabled:opacity-40 border border-[#1E293B] text-xs font-mono text-[#F1F5F9] cursor-pointer"
            >
              ← Previous Step
            </button>

            {wizardStep < 7 ? (
              <button
                onClick={() => setWizardStep((s) => Math.min(7, s + 1))}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs font-mono cursor-pointer"
              >
                Next Step →
              </button>
            ) : (
              <button
                onClick={handleSubmitExperimentWizard}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs font-mono flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" /> Save Experiment to Repository
              </button>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SIDE-BY-SIDE BASELINE VS PROPOSED COMPARISON */}
      {subTab === 'compare' && (
        <div className="bg-[#0F141C] border border-[#1E293B] p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                SELECT BASELINE REFERENCE EXPERIMENT
              </label>
              <select
                value={compareBaselineId || experiments[0]?.id || ''}
                onChange={(e) => setCompareBaselineId(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
              >
                {experiments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.experimentCode} — {e.title} ({e.baselineOrProposedMethod})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-[#94A3B8] mb-1">
                SELECT PROPOSED / RECALIBRATED EXPERIMENT
              </label>
              <select
                value={
                  compareProposedId ||
                  experiments[1]?.id ||
                  experiments[0]?.id ||
                  ''
                }
                onChange={(e) => setCompareProposedId(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
              >
                {experiments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.experimentCode} — {e.title} ({e.baselineOrProposedMethod})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(() => {
            const baseExp =
              experiments.find((e) => e.id === compareBaselineId) ||
              experiments[0];
            const propExp =
              experiments.find((e) => e.id === compareProposedId) ||
              experiments[1] ||
              experiments[0];

            if (!baseExp || !propExp) {
              return (
                <div className="text-xs text-[#94A3B8]">
                  Create at least two experiments to perform a comparative evaluation.
                </div>
              );
            }

            const baseQ = evaluateExperimentQuality(baseExp, measurements);
            const propQ = evaluateExperimentQuality(propExp, measurements);
            const cmp = compareExperimentToBaseline(
              baseExp,
              propExp,
              measurements,
              productionMetrics
            );

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1E293B] bg-[#0B0E14] text-[#94A3B8]">
                      <th className="py-3 px-4">Parameter / Empirical Metric</th>
                      <th className="py-3 px-4">
                        Baseline: {baseExp.experimentCode}
                      </th>
                      <th className="py-3 px-4">
                        Candidate: {propExp.experimentCode}
                      </th>
                      <th className="py-3 px-4 text-right">
                        Observed Delta (Candidate vs. Baseline)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    <tr>
                      <td className="py-2.5 px-4 text-[#94A3B8]">Method</td>
                      <td className="py-2.5 px-4">{baseExp.baselineOrProposedMethod}</td>
                      <td className="py-2.5 px-4 text-cyan-400">
                        {propExp.baselineOrProposedMethod}
                      </td>
                      <td className="py-2.5 px-4 text-right text-[#94A3B8]">—</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-[#94A3B8]">
                        Print Speed (mm/s)
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {baseExp.processParameters.printSpeedMmPerSec.toFixed(1)} mm/s
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {propExp.processParameters.printSpeedMmPerSec.toFixed(1)} mm/s
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        {(
                          propExp.processParameters.printSpeedMmPerSec -
                          baseExp.processParameters.printSpeedMmPerSec
                        ).toFixed(1)}{' '}
                        mm/s
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-[#94A3B8]">
                        Relative Flow (%)
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {baseExp.processParameters.relativeFlowPercent.toFixed(1)} %
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {propExp.processParameters.relativeFlowPercent.toFixed(1)} %
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        {(
                          propExp.processParameters.relativeFlowPercent -
                          baseExp.processParameters.relativeFlowPercent
                        ).toFixed(1)}{' '}
                        %
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-[#94A3B8]">
                        Physical Volumetric Flow
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {baseExp.processParameters.volumetricFlowValue ?? '—'}{' '}
                        {baseExp.processParameters.volumetricFlowUnit}
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {propExp.processParameters.volumetricFlowValue ?? '—'}{' '}
                        {propExp.processParameters.volumetricFlowUnit}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        {baseExp.processParameters.volumetricFlowValue !== null &&
                        propExp.processParameters.volumetricFlowValue !== null &&
                        baseExp.processParameters.volumetricFlowUnit ===
                          propExp.processParameters.volumetricFlowUnit
                          ? `${(
                              propExp.processParameters.volumetricFlowValue -
                              baseExp.processParameters.volumetricFlowValue
                            ).toFixed(1)} ${baseExp.processParameters.volumetricFlowUnit}`
                          : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-[#94A3B8]">
                        Bead Width RMSE (mm)
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {baseQ.rmseBeadWidthMm !== null
                          ? `${baseQ.rmseBeadWidthMm.toFixed(3)} mm`
                          : 'Insufficient Data'}
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {propQ.rmseBeadWidthMm !== null
                          ? `${propQ.rmseBeadWidthMm.toFixed(3)} mm`
                          : 'Insufficient Data'}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        {cmp.beadWidthRmseDeltaPercent !== null ? (
                          <span
                            className={
                              cmp.beadWidthRmseDeltaPercent <= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }
                          >
                            {cmp.beadWidthRmseDeltaPercent > 0 ? '+' : ''}
                            {cmp.beadWidthRmseDeltaPercent.toFixed(1)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-[#94A3B8]">
                        Tolerance Compliance Pass Rate (%)
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {baseQ.overallPassRatePercent !== null
                          ? `${baseQ.overallPassRatePercent.toFixed(1)} %`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {propQ.overallPassRatePercent !== null
                          ? `${propQ.overallPassRatePercent.toFixed(1)} %`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        {cmp.passRateDeltaPoints !== null ? (
                          <span
                            className={
                              cmp.passRateDeltaPoints >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }
                          >
                            {cmp.passRateDeltaPoints > 0 ? '+' : ''}
                            {cmp.passRateDeltaPoints.toFixed(1)} pts
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* SUB-TAB 4: MATERIAL & HARDWARE PROFILES */}
      {subTab === 'profiles' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Material Profiles List */}
          <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#F1F5F9]">
              Material Profiles ({materialProfiles.length})
            </h2>
            <div className="space-y-3">
              {materialProfiles.map((mat) => (
                <div
                  key={mat.id}
                  className="p-3.5 bg-[#0B0E14] border border-[#1E293B] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-cyan-400 font-semibold">
                      {mat.batchIdentifier} · {mat.materialType.toUpperCase()}
                    </span>
                    <button
                      onClick={async () => {
                        const res = await repository.deleteMaterialProfile(mat.id);
                        if (!res.ok) {
                          notifyToast(res.error || 'Cannot delete profile');
                        } else {
                          await refreshWorkspace();
                          notifyToast(`Deleted material profile ${mat.batchIdentifier}`);
                        }
                      }}
                      className="text-[#94A3B8] hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-sm font-medium text-[#F1F5F9]">
                    {mat.materialName}
                  </div>
                  <div className="text-xs text-[#94A3B8]">{mat.preparationNotes}</div>
                  <div className="text-[11px] font-mono text-slate-300 pt-1">
                    {mat.measuredMaterialProperties
                      .map((p) => `${p.label}: ${p.value} ${p.unit}`)
                      .join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hardware Profiles List */}
          <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#F1F5F9]">
              Configurable Hardware Profiles ({hardwareProfiles.length})
            </h2>
            <div className="space-y-3">
              {hardwareProfiles.map((hw) => (
                <div
                  key={hw.id}
                  className="p-3.5 bg-[#0B0E14] border border-[#1E293B] space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-cyan-400">{hw.category}</span>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Readiness status for ${hw.name}`}
                        value={hw.readinessStatus}
                        onChange={async (e) => {
                          const updated: HardwareProfile = {
                            ...hw,
                            readinessStatus: e.target
                              .value as EquipmentReadinessStatus,
                            updatedAt: new Date().toISOString(),
                          };
                          await repository.saveHardwareProfile(updated, false);
                          await refreshWorkspace();
                          notifyToast(
                            `Updated ${hw.name} readiness to ${updated.readinessStatus}`
                          );
                        }}
                        className="bg-[#151C28] border border-[#1E293B] text-[11px] px-2 py-0.5 text-amber-400"
                      >
                        {EquipmentReadinessStatusEnum.options.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={async () => {
                          const res = await repository.deleteHardwareProfile(hw.id);
                          if (!res.ok) {
                            notifyToast(res.error || 'Cannot delete hardware profile');
                          } else {
                            await refreshWorkspace();
                            notifyToast(`Deleted hardware profile ${hw.name}`);
                          }
                        }}
                        className="text-[#94A3B8] hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-[#F1F5F9]">{hw.name}</div>
                  <div className="text-xs font-mono text-slate-300">
                    Platform: {hw.robotType} · Extruder: {hw.extruderType} (Nozzle{' '}
                    {hw.nozzleDiameterMm} mm)
                  </div>
                  <div className="text-[11px] font-mono text-[#94A3B8]">
                    Sensing Modalities:{' '}
                    {hw.sensingHardware
                      .map((s) => `${s.name} [${s.readinessStatus}]`)
                      .join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
