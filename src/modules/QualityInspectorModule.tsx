import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Download,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FileDatasetMetadata,
  Measurement,
  MeasurementSourceType,
  MeasurementSourceTypeEnum,
  MeasurementType,
  MeasurementTypeEnum,
} from '../domain/models';
import { useResearchWorkspace } from '../repositories/repository';
import {
  computeMeasurementStatistics,
  MIN_SAMPLE_SIZE_FOR_CAPABILITY_INDEX,
} from '../scientific/calculations';
import {
  computeSha256Checksum,
  exportMeasurementsToCsv,
  parseMeasurementsCsv,
  triggerBrowserDownload,
} from '../services/importExport';

export const QualityInspectorModule: React.FC = () => {
  const {
    snapshot,
    selectedExperimentId,
    setSelectedExperimentId,
    repository,
    refreshWorkspace,
    notifyToast,
  } = useResearchWorkspace();

  const [selectedMetricType, setSelectedMetricType] =
    useState<MeasurementType>('bead width');
  const [stabilityVerifiedByUser, setStabilityVerifiedByUser] =
    useState<boolean>(false);
  const [includeUnverifiedAi, setIncludeUnverifiedAi] = useState<boolean>(false);
  const [selectedLayerForSchematic, setSelectedLayerForSchematic] =
    useState<number>(5);
  const [crosshairReadout, setCrosshairReadout] = useState<{
    xMm: number;
    zMm: number;
  } | null>(null);

  // New measurement form state
  const [specimenId, setSpecimenId] = useState<string>('SPEC-01-N');
  const [layerIdx, setLayerIdx] = useState<number>(5);
  const [mType, setMType] = useState<MeasurementType>('bead width');
  const [measuredVal, setMeasuredVal] = useState<number>(6.55);
  const [targetVal, setTargetVal] = useState<number>(6.5);
  const [toleranceVal, setToleranceVal] = useState<number>(0.45);
  const [unitVal, setUnitVal] = useState<string>('mm');
  const [sourceType, setSourceType] = useState<MeasurementSourceType>('Manual');
  const [acqMethod, setAcqMethod] = useState<string>(
    'Mitutoyo Digimatic Caliper (0.01 mm)'
  );
  const [coordFrame, setCoordFrame] = useState<string>('wobjPrintTable_01');
  const [uncertaintyVal, setUncertaintyVal] = useState<number>(0.05);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!snapshot) return null;

  const { experiments, measurements, project } = snapshot;
  const activeExp =
    experiments.find((e) => e.id === selectedExperimentId) || experiments[0];

  useEffect(() => {
    if (!activeExp) return;
    const criterion = activeExp.evaluationCriteriaSnapshot.find(
      (c) => c.measurementType === mType
    );
    if (criterion) {
      setTargetVal(criterion.targetValue);
      setToleranceVal(criterion.tolerancePlusMinus);
      setUnitVal(criterion.unit);
    } else if (mType === 'bead width') {
      setTargetVal(activeExp.processParameters.targetBeadWidthMm);
    } else if (mType === 'bead height') {
      setTargetVal(activeExp.processParameters.layerHeightMm);
    }
  }, [activeExp, mType]);

  const expMeasurements = useMemo(() => {
    if (!activeExp) return [];
    return measurements.filter((m) => m.experimentId === activeExp.id);
  }, [measurements, activeExp]);

  const metricMeasurements = useMemo(() => {
    return expMeasurements.filter((m) => m.measurementType === selectedMetricType);
  }, [expMeasurements, selectedMetricType]);

  const stats = useMemo(() => {
    return computeMeasurementStatistics(metricMeasurements, {
      includeUnverifiedAi,
      stabilityVerifiedByUser,
    });
  }, [metricMeasurements, includeUnverifiedAi, stabilityVerifiedByUser]);

  const availableLayers = useMemo(() => {
    const set = new Set<number>();
    expMeasurements.forEach((m) => {
      if (typeof m.layerIndex === 'number') set.add(m.layerIndex);
    });
    const arr = Array.from(set).sort((a, b) => a - b);
    return arr.length > 0 ? arr : [5, 10, 15, 20];
  }, [expMeasurements]);

  const handleLogMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExp) return;

    const isUnverifiedSource =
      sourceType === 'AI-Assisted Annotation' || sourceType === 'Computed';
    const newMeas: Measurement = {
      id: `meas-${Date.now()}`,
      experimentId: activeExp.id,
      specimenId: specimenId.trim() || 'SPEC-01',
      layerIndex: Number(layerIdx),
      measurementType: mType,
      measuredValue: Number(measuredVal),
      unit: unitVal.trim() || 'mm',
      targetValue: Number(targetVal),
      tolerance: Number(toleranceVal) > 0 ? Number(toleranceVal) : 0.45,
      timestamp: new Date().toISOString(),
      sourceType,
      // Scientific safeguard: AI-generated and Computed estimates are NEVER silently stored as verified physical measurements
      verifiedPhysicalMeasurement: !isUnverifiedSource,
      profileGeometryType: 'Scalar Point Measurement (Schematic Only)',
      acquisitionMethod: acqMethod.trim(),
      algorithmVersion: isUnverifiedSource ? 'unverified-estimate-v1' : 'manual-entry-v1',
      coordinateFrame: coordFrame.trim() || 'wobjPrintTable_01',
      uncertaintyMetadata: {
        standardUncertainty: Number(uncertaintyVal),
        confidenceLevelPercent: 95,
        calibrationRef: 'LAB-CAL-2026',
      },
      isSampleFixture: false,
    };

    const res = await repository.saveMeasurement(newMeas, true);
    if (!res.ok) {
      notifyToast(res.error || 'Failed to save measurement.');
      return;
    }
    await refreshWorkspace();
    notifyToast(
      isUnverifiedSource
        ? `Logged ${sourceType} (Explicitly flagged as UNVERIFIED).`
        : `Logged verified physical measurement (${newMeas.measuredValue} ${newMeas.unit}).`
    );
  };

  const handleCsvFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeExp) return;
    const text = await file.text();
    const checksum = await computeSha256Checksum(text);
    const fileId = `file-${Date.now()}`;
    const parsed = parseMeasurementsCsv(text, activeExp.id, fileId);

    if (parsed.validMeasurements.length === 0) {
      notifyToast(
        `CSV Import failed: ${parsed.errors[0] || 'No valid rows found.'}`
      );
      return;
    }

    const fileMeta: FileDatasetMetadata = {
      id: fileId,
      projectId: project.id,
      experimentId: activeExp.id,
      filename: file.name,
      fileType: 'CSV',
      fileSize: file.size,
      checksum,
      uploadDate: new Date().toISOString(),
      datasetSchema: 'fro.measurements.csv.v1',
      sourceType: 'Instrument Export',
      fileAvailability: 'IndexedDB Cached',
      storageReference: `idb://measurements/${activeExp.id}`,
      recordCount: parsed.validMeasurements.length,
      isSampleFixture: false,
    };

    const batchRes = await repository.saveMeasurementsBatch(
      parsed.validMeasurements,
      fileMeta
    );
    if (!batchRes.ok) {
      notifyToast(batchRes.error || 'CSV batch save failed.');
      return;
    }
    await refreshWorkspace();
    notifyToast(
      `Imported ${parsed.validMeasurements.length} measurement(s) from ${file.name} (${checksum.slice(0, 15)}...)`
    );
    e.target.value = '';
  };

  // Schematic cross-section data for selected layer
  const layerWidthMeas = expMeasurements.find(
    (m) =>
      m.measurementType === 'bead width' &&
      m.layerIndex === selectedLayerForSchematic
  );
  const layerHeightMeas = expMeasurements.find(
    (m) =>
      m.measurementType === 'bead height' &&
      m.layerIndex === selectedLayerForSchematic
  );

  const nominalW = activeExp?.processParameters.targetBeadWidthMm ?? 6.5;
  const nominalH = activeExp?.processParameters.layerHeightMm ?? 3.0;
  const empW = layerWidthMeas ? layerWidthMeas.measuredValue : nominalW;
  const empH = layerHeightMeas ? layerHeightMeas.measuredValue : nominalH;
  const hasScannedProfile = Boolean(
    layerWidthMeas?.profileGeometryType ===
      'Imported Scanned Cross-Section Profile' &&
      layerWidthMeas.scannedProfilePointsMm &&
      layerWidthMeas.scannedProfilePointsMm.length > 2
  );

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="bg-[#0F141C] border border-[#1E293B] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            MODULE 02 · QUALITY INSPECTOR (METROLOGICAL VERIFICATION)
          </div>
          <h1 className="text-xl font-semibold text-[#F1F5F9] mt-0.5">
            Geometric Residuals, Tolerance Compliance & Schematic Cross-Sections
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select Experiment for Quality Inspection"
            value={activeExp?.id || ''}
            onChange={(e) => setSelectedExperimentId(e.target.value)}
            className="bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs font-mono text-[#F1F5F9]"
          >
            {experiments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.experimentCode} — {e.title}
              </option>
            ))}
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvFileImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!activeExp}
            className="px-3 py-2 bg-[#151C28] hover:bg-[#1E293B] disabled:opacity-40 border border-[#1E293B] text-xs font-mono text-[#F1F5F9] flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" /> Import Measurements CSV
          </button>
          <button
            onClick={() => {
              const csv = exportMeasurementsToCsv(expMeasurements);
              triggerBrowserDownload(
                `${activeExp?.experimentCode || 'EXP'}_Measurements.csv`,
                csv,
                'text/csv;charset=utf-8'
              );
              notifyToast('Exported measurements to CSV.');
            }}
            disabled={expMeasurements.length === 0}
            className="px-3 py-2 bg-[#151C28] hover:bg-[#1E293B] disabled:opacity-40 border border-[#1E293B] text-xs font-mono text-[#F1F5F9] flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" /> Export CSV
          </button>
        </div>
      </div>

      {!activeExp ? (
        <div className="bg-[#0F141C] border border-[#1E293B] p-8 text-sm text-[#94A3B8]">
          No experiment available. Create an experiment in Experiment Lab or load the
          sample dataset in Data Management.
        </div>
      ) : (
        <>
          {/* Metric Filter & Statistical Summary Strip */}
          <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B0E14] border border-[#1E293B]">
                {MeasurementTypeEnum.options.map((mt) => (
                  <button
                    key={mt}
                    onClick={() => setSelectedMetricType(mt)}
                    className={`px-3 py-1.5 text-xs font-mono transition-colors cursor-pointer ${
                      selectedMetricType === mt
                        ? 'bg-cyan-500 text-slate-950 font-semibold'
                        : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                    }`}
                  >
                    {mt}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                <label className="flex items-center gap-2 text-[#94A3B8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stabilityVerifiedByUser}
                    onChange={(e) => setStabilityVerifiedByUser(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span>Confirm temporal stability & normality for Cp/Cpk</span>
                </label>
                <label className="flex items-center gap-2 text-[#94A3B8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeUnverifiedAi}
                    onChange={(e) => setIncludeUnverifiedAi(e.target.checked)}
                    className="accent-amber-500"
                  />
                  <span>Include unverified AI annotations</span>
                </label>
              </div>
            </div>

            {stats ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-[#0B0E14] border border-[#1E293B] p-3.5">
                    <div className="text-[11px] font-mono text-[#94A3B8]">
                      SAMPLE MEAN (n={stats.count})
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span className="text-2xl font-mono font-semibold text-[#F1F5F9] tabular-nums">
                        {stats.mean.toFixed(3)}
                      </span>
                      <span className="text-xs font-mono text-[#94A3B8] ml-1.5">
                        {stats.unit}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-[#94A3B8]">
                      Target: {stats.targetValue.toFixed(2)} ± {stats.tolerance.toFixed(2)}{' '}
                      {stats.unit}
                    </div>
                  </div>

                  <div className="bg-[#0B0E14] border border-[#1E293B] p-3.5">
                    <div className="text-[11px] font-mono text-[#94A3B8]">
                      SAMPLE STD DEV (s)
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span className="text-2xl font-mono font-semibold text-[#F1F5F9] tabular-nums">
                        {stats.stdDev.toFixed(3)}
                      </span>
                      <span className="text-xs font-mono text-[#94A3B8] ml-1.5">
                        {stats.unit}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-[#94A3B8]">
                      Range: [{stats.min.toFixed(2)}, {stats.max.toFixed(2)}]
                    </div>
                  </div>

                  <div className="bg-[#0B0E14] border border-[#1E293B] p-3.5">
                    <div className="text-[11px] font-mono text-[#94A3B8]">
                      RMSE (RESIDUAL ERROR)
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span className="text-2xl font-mono font-semibold text-cyan-400 tabular-nums">
                        {stats.rmse.toFixed(3)}
                      </span>
                      <span className="text-xs font-mono text-[#94A3B8] ml-1.5">
                        {stats.unit}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-[#94A3B8]">
                      Mean Δ: {stats.meanResidual >= 0 ? '+' : ''}
                      {stats.meanResidual.toFixed(3)} {stats.unit}
                    </div>
                  </div>

                  <div className="bg-[#0B0E14] border border-[#1E293B] p-3.5">
                    <div className="text-[11px] font-mono text-[#94A3B8]">
                      MAX ABS DEVIATION
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span className="text-2xl font-mono font-semibold text-[#F1F5F9] tabular-nums">
                        {stats.maxAbsResidual.toFixed(3)}
                      </span>
                      <span className="text-xs font-mono text-[#94A3B8] ml-1.5">
                        {stats.unit}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-[#94A3B8]">
                      Tol Limit: ±{stats.tolerance.toFixed(2)} {stats.unit}
                    </div>
                  </div>

                  <div className="bg-[#0B0E14] border border-[#1E293B] p-3.5">
                    <div className="text-[11px] font-mono text-[#94A3B8]">
                      TOLERANCE COMPLIANCE
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span
                        className={`text-2xl font-mono font-semibold tabular-nums ${
                          stats.passRatePercent >= 90
                            ? 'text-emerald-400'
                            : stats.passRatePercent >= 70
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {stats.passRatePercent.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono text-[#94A3B8] ml-1">%</span>
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-[#94A3B8]">
                      {stats.withinToleranceCount} pass / {stats.outOfToleranceCount} fail
                    </div>
                  </div>

                  <div className="bg-[#0B0E14] border border-[#1E293B] p-3.5">
                    <div className="text-[11px] font-mono text-[#94A3B8]">
                      PROCESS CAPABILITY (Cp / Cpk)
                    </div>
                    {stats.cp !== null && stats.cpk !== null ? (
                      <>
                        <div className="mt-1 font-mono text-lg font-semibold text-emerald-400 tabular-nums">
                          {stats.cp.toFixed(2)} / {stats.cpk.toFixed(2)}
                        </div>
                        <div className="mt-1 text-[10px] font-mono text-[#94A3B8]">
                          n≥{MIN_SAMPLE_SIZE_FOR_CAPABILITY_INDEX} verified
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 space-y-1">
                        <div className="text-xs font-mono text-amber-400">
                          {stats.count < MIN_SAMPLE_SIZE_FOR_CAPABILITY_INDEX
                            ? `▲ Withheld (n=${stats.count} < ${MIN_SAMPLE_SIZE_FOR_CAPABILITY_INDEX})`
                            : '▲ Withheld (Preconditions Unmet)'}
                        </div>
                        <div className="text-[10px] text-[#94A3B8] leading-tight">
                          {stats.capabilityStatusReason}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#0B0E14] border border-[#1E293B] text-xs font-mono text-[#94A3B8]">
                No verified measurements recorded for `{selectedMetricType}` in{' '}
                {activeExp.experimentCode}. Log measurements below or choose another
                measurement type.
              </div>
            )}
          </div>

          {/* Split Console: Left = Schematic Parametric Overlay + Deviation Plot; Right = Log Measurement & Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Schematic Cross-Section & Layer Residual Plot */}
            <div className="space-y-6">
              <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono text-amber-400">
                      {hasScannedProfile
                        ? '● MEASURED 2D PROFILE POINTS'
                        : '▲ PARAMETRIC SCHEMATIC APPROXIMATION (NOT A 3D SCAN)'}
                    </div>
                    <h2 className="text-base font-semibold text-[#F1F5F9] mt-0.5">
                      Bead Width & Height Cross-Section Overlay (Layer{' '}
                      {selectedLayerForSchematic})
                    </h2>
                  </div>
                  <select
                    aria-label="Select Layer for Cross Section"
                    value={selectedLayerForSchematic}
                    onChange={(e) =>
                      setSelectedLayerForSchematic(Number(e.target.value))
                    }
                    className="bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1 text-xs font-mono text-[#F1F5F9]"
                  >
                    {availableLayers.map((l) => (
                      <option key={l} value={l}>
                        Layer {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-2.5 bg-[#0B0E14] border border-[#1E293B] text-[11px] text-[#94A3B8] font-mono">
                  SCIENTIFIC DISCLOSURE: This diagram renders an idealized oblong capsule
                  derived strictly from scalar caliper/camera point measurements (W ={' '}
                  {empW.toFixed(2)} mm, H = {empH.toFixed(2)} mm) vs. nominal target (W ={' '}
                  {nominalW.toFixed(2)} mm, H = {nominalH.toFixed(2)} mm). It does not
                  represent a laser-scanned surface profile.
                </div>

                {/* Interactive SVG Cross-Section Canvas with Crosshair Probe */}
                <div className="relative bg-[#0B0E14] border border-[#1E293B] p-4">
                  <svg
                    viewBox="-8 -2 16 8"
                    className="w-full h-52 cursor-crosshair"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relX = (e.clientX - rect.left) / rect.width;
                      const relY = (e.clientY - rect.top) / rect.height;
                      const xMm = -8 + relX * 16;
                      const zMm = 6 - relY * 8;
                      setCrosshairReadout({
                        xMm: Number(xMm.toFixed(2)),
                        zMm: Number(zMm.toFixed(2)),
                      });
                    }}
                    onMouseLeave={() => setCrosshairReadout(null)}
                  >
                    {/* Coordinate Grid */}
                    {[-6, -4, -2, 0, 2, 4, 6].map((gx) => (
                      <line
                        key={gx}
                        x1={gx}
                        y1={-1}
                        x2={gx}
                        y2={5.5}
                        stroke="#1E293B"
                        strokeWidth={0.05}
                      />
                    ))}
                    {[0, 1, 2, 3, 4, 5].map((gz) => (
                      <line
                        key={gz}
                        x1={-7.5}
                        y1={5 - gz}
                        x2={7.5}
                        y2={5 - gz}
                        stroke="#1E293B"
                        strokeWidth={0.05}
                      />
                    ))}

                    {/* Substrate Line z=0 */}
                    <line
                      x1={-7.5}
                      y1={5}
                      x2={7.5}
                      y2={5}
                      stroke="#475569"
                      strokeWidth={0.08}
                    />

                    {/* Nominal Target Capsule (Dashed Cyan) */}
                    <rect
                      x={-nominalW / 2}
                      y={5 - nominalH}
                      width={nominalW}
                      height={nominalH}
                      rx={Math.min(nominalH / 2, nominalW / 2)}
                      fill="rgba(6, 182, 212, 0.08)"
                      stroke="#06B6D4"
                      strokeWidth={0.09}
                      strokeDasharray="0.25 0.15"
                    />

                    {/* Empirical Schematic Capsule from Scalar Width/Height (Solid Amber/Emerald) */}
                    <rect
                      x={-empW / 2}
                      y={5 - empH}
                      width={empW}
                      height={empH}
                      rx={Math.min(empH / 2, empW / 2)}
                      fill="rgba(245, 158, 11, 0.16)"
                      stroke="#F59E0B"
                      strokeWidth={0.1}
                    />
                  </svg>

                  <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-[#94A3B8] pt-2 border-t border-[#1E293B]">
                    <div className="flex items-center gap-4">
                      <span className="text-cyan-400">
                        - - Nominal Target: {nominalW.toFixed(2)} × {nominalH.toFixed(2)} mm
                      </span>
                      <span className="text-amber-400">
                        — Scalar Schematic: {empW.toFixed(2)} × {empH.toFixed(2)} mm
                      </span>
                    </div>
                    <div>
                      {crosshairReadout
                        ? `PROBE X: ${crosshairReadout.xMm} mm · Z: ${crosshairReadout.zMm} mm`
                        : 'Hover crosshair to probe (mm)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Layer-wise Deviation Scatter Plot */}
              <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3">
                <h2 className="text-base font-semibold text-[#F1F5F9]">
                  Layer-Indexed Measurement Distribution ({selectedMetricType})
                </h2>
                <div className="h-60 w-full bg-[#0B0E14] border border-[#1E293B] p-3">
                  {metricMeasurements.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
                      >
                        <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          dataKey="layerIndex"
                          name="Layer"
                          stroke="#94A3B8"
                          tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                          label={{
                            value: 'Layer Index',
                            position: 'insideBottom',
                            offset: -10,
                            fill: '#94A3B8',
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          type="number"
                          dataKey="measuredValue"
                          name="Measured"
                          stroke="#94A3B8"
                          domain={['auto', 'auto']}
                          tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                        />
                        <Tooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          contentStyle={{
                            backgroundColor: '#0F141C',
                            borderColor: '#1E293B',
                            fontFamily: 'IBM Plex Mono',
                            fontSize: '11px',
                          }}
                        />
                        {stats && (
                          <>
                            <ReferenceLine
                              y={stats.targetValue}
                              stroke="#06B6D4"
                              strokeDasharray="4 4"
                            />
                            <ReferenceLine
                              y={stats.targetValue + stats.tolerance}
                              stroke="#F43F5E"
                              strokeDasharray="2 2"
                            />
                            <ReferenceLine
                              y={stats.targetValue - stats.tolerance}
                              stroke="#F43F5E"
                              strokeDasharray="2 2"
                            />
                          </>
                        )}
                        <Scatter
                          name={selectedMetricType}
                          data={metricMeasurements}
                          fill="#10B981"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs font-mono text-[#94A3B8]">
                      No points to plot for {selectedMetricType}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Log Measurement Form & Specimen Ledger */}
            <div className="space-y-6">
              <form
                onSubmit={handleLogMeasurement}
                className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4"
              >
                <div className="text-xs font-mono text-cyan-400">
                  LOG SPECIMEN MEASUREMENT WITH PROVENANCE
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                      Specimen ID *
                    </label>
                    <input
                      type="text"
                      value={specimenId}
                      onChange={(e) => setSpecimenId(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                      Layer Index
                    </label>
                    <input
                      type="number"
                      value={layerIdx}
                      onChange={(e) => setLayerIdx(Number(e.target.value))}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                      Measurement Type
                    </label>
                    <select
                      value={mType}
                      onChange={(e) => setMType(e.target.value as MeasurementType)}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                    >
                      {MeasurementTypeEnum.options.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                      Measured Value ({unitVal}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={measuredVal}
                      onChange={(e) => setMeasuredVal(Number(e.target.value))}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                      Target Value ({unitVal}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={targetVal}
                      onChange={(e) => setTargetVal(Number(e.target.value))}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                      ± Tolerance ({unitVal}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={toleranceVal}
                      onChange={(e) => setToleranceVal(Number(e.target.value))}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                      Source Provenance
                    </label>
                    <select
                      value={sourceType}
                      onChange={(e) =>
                        setSourceType(e.target.value as MeasurementSourceType)
                      }
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                    >
                      {MeasurementSourceTypeEnum.options.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                      Coordinate Frame *
                    </label>
                    <input
                      type="text"
                      value={coordFrame}
                      onChange={(e) => setCoordFrame(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                      Std Uncertainty (±{unitVal})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={uncertaintyVal}
                      onChange={(e) => setUncertaintyVal(Number(e.target.value))}
                      className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] font-mono text-[#94A3B8]">
                    {sourceType === 'AI-Assisted Annotation' || sourceType === 'Computed'
                      ? '▲ Will be stored with verifiedPhysicalMeasurement = false'
                      : '● Will be stored as verified physical measurement'}
                  </span>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs font-mono cursor-pointer"
                  >
                    + Record Measurement
                  </button>
                </div>
              </form>

              {/* Specimen Measurements Table */}
              <div className="bg-[#0F141C] border border-[#1E293B]">
                <div className="px-4 py-3 border-b border-[#1E293B] text-xs font-mono text-[#94A3B8] flex items-center justify-between">
                  <span>
                    MEASUREMENT LEDGER FOR {activeExp.experimentCode} (
                    {expMeasurements.length} records)
                  </span>
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1E293B] bg-[#0B0E14] text-[#94A3B8] text-[11px]">
                        <th className="py-2.5 px-3">Specimen / Layer</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Measured</th>
                        <th className="py-2.5 px-3 text-right">Residual Δ</th>
                        <th className="py-2.5 px-3">Provenance</th>
                        <th className="py-2.5 px-3 text-right">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]">
                      {expMeasurements.map((m) => {
                        const residual = m.measuredValue - m.targetValue;
                        const pass = Math.abs(residual) <= m.tolerance;
                        return (
                          <tr key={m.id} className="hover:bg-[#151C28]/50">
                            <td className="py-2 px-3">
                              <div className="text-[#F1F5F9]">{m.specimenId}</div>
                              <div className="text-[10px] text-[#94A3B8]">
                                L{m.layerIndex ?? '—'} · {m.coordinateFrame}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-slate-300">
                              {m.measurementType}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              {m.measuredValue.toFixed(2)} {m.unit}
                            </td>
                            <td
                              className={`py-2 px-3 text-right tabular-nums ${
                                pass ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {residual >= 0 ? '+' : ''}
                              {residual.toFixed(2)} {m.unit}
                            </td>
                            <td className="py-2 px-3 text-[11px]">
                              {m.verifiedPhysicalMeasurement ? (
                                <span className="text-slate-300">
                                  ● {m.sourceType}
                                </span>
                              ) : (
                                <span className="text-amber-400">
                                  ▲ {m.sourceType} (Unverified)
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={async () => {
                                  await repository.deleteMeasurement(m.id);
                                  await refreshWorkspace();
                                  notifyToast('Deleted measurement record.');
                                }}
                                className="text-[#94A3B8] hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
