import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ObservationType,
  ObservationTypeEnum,
  ProcessObservation,
} from '../domain/models';
import { useResearchWorkspace } from '../repositories/repository';
import { verifyStreamCorrelationCompatibility } from '../scientific/calculations';

export const ProcessExplorerModule: React.FC = () => {
  const {
    snapshot,
    selectedExperimentId,
    setSelectedExperimentId,
    repository,
    refreshWorkspace,
    notifyToast,
  } = useResearchWorkspace();

  const [obsLayer, setObsLayer] = useState<number>(5);
  const [obsElapsed, setObsElapsed] = useState<number>(540);
  const [obsSegment, setObsSegment] = useState<string>('SEG-L05-CHK');
  const [obsType, setObsType] = useState<ObservationType>('extrusion_pressure');
  const [obsVal, setObsVal] = useState<number>(350);
  const [obsUnit, setObsUnit] = useState<string>('kPa');
  const [obsSource, setObsSource] = useState<string>('Regulator Gauge Manual Log');
  const [obsClockStatus, setObsClockStatus] = useState<
    'Synchronized NTP/PTP' | 'Manual Offset Aligned' | 'Unsynchronized Local Clock' | 'Unknown Synchronization'
  >('Manual Offset Aligned');
  const [obsClockOffset, setObsClockOffset] = useState<number>(0);
  const [obsCoordFrame, setObsCoordFrame] = useState<string>('wobjPrintTable_01');
  const [obsNote, setObsNote] = useState<string>('');

  if (!snapshot) return null;

  const { experiments, processObservations, measurements } = snapshot;
  const activeExp =
    experiments.find((e) => e.id === selectedExperimentId) || experiments[0];

  const expObservations = useMemo(() => {
    if (!activeExp) return [];
    return processObservations
      .filter((o) => o.experimentId === activeExp.id)
      .sort((a, b) => a.elapsedTime - b.elapsedTime);
  }, [processObservations, activeExp]);

  const expMeasurements = useMemo(() => {
    if (!activeExp) return [];
    return measurements.filter((m) => m.experimentId === activeExp.id);
  }, [measurements, activeExp]);

  const correlationCheck = useMemo(() => {
    return verifyStreamCorrelationCompatibility(expObservations, expMeasurements);
  }, [expObservations, expMeasurements]);

  const handleLogObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExp) return;
    const obs: ProcessObservation = {
      id: `obs-${Date.now()}`,
      experimentId: activeExp.id,
      timestamp: new Date().toISOString(),
      elapsedTime: Number(obsElapsed),
      clockSyncStatus: obsClockStatus,
      clockOffsetMs: Number(obsClockOffset),
      coordinateFrame: obsCoordFrame.trim() || 'wobjPrintTable_01',
      layerIndex: Number(obsLayer),
      toolpathSegmentId: obsSegment.trim() || `SEG-L${obsLayer}`,
      observationType: obsType,
      numericValue: Number(obsVal),
      unit: obsUnit.trim() || 'unit',
      acquisitionSource: obsSource.trim() || 'Manual Log',
      annotationNote: obsNote.trim() || undefined,
      isSampleFixture: false,
    };

    await repository.saveProcessObservation(obs);
    await refreshWorkspace();
    notifyToast(`Logged process observation at Layer ${obs.layerIndex}.`);
  };

  const handleAlignUnsyncedClocks = async () => {
    const unsynced = expObservations.filter(
      (o) => o.clockSyncStatus === 'Unsynchronized Local Clock'
    );
    for (const o of unsynced) {
      await repository.saveProcessObservation({
        ...o,
        clockSyncStatus: 'Manual Offset Aligned',
      });
    }
    await refreshWorkspace();
    notifyToast(`Aligned ${unsynced.length} observation stream record(s).`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0F141C] border border-[#1E293B] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            MODULE 04 · PROCESS EXPLORER (SYNCHRONIZATION & COORDINATE-FRAME GUARDED)
          </div>
          <h1 className="text-xl font-semibold text-[#F1F5F9] mt-0.5">
            Layer-Indexed Process Observations, Clock Alignment & Stream Correlation
          </h1>
        </div>

        <select
          aria-label="Select Experiment for Process Explorer"
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
      </div>

      {/* Synchronization & Coordinate Frame Consistency Guard */}
      <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[#94A3B8]">
              MULTI-STREAM CORRELATION PRECONDITION CHECK:
            </span>
            {correlationCheck.canCorrelate ? (
              <span className="text-emerald-400">
                ● Verified (Clock Aligned · Common Frame:{' '}
                {correlationCheck.commonCoordinateFrame})
              </span>
            ) : (
              <span className="text-amber-400">
                ▲ Correlation Blocked Until Preconditions Satisfied
              </span>
            )}
          </div>
          {expObservations.some(
            (o) => o.clockSyncStatus === 'Unsynchronized Local Clock'
          ) && (
            <button
              onClick={handleAlignUnsyncedClocks}
              className="px-3 py-1 bg-[#151C28] hover:bg-[#1E293B] border border-amber-500/40 text-amber-400 text-xs font-mono cursor-pointer"
            >
              Confirm Manual Clock Offset Alignment
            </button>
          )}
        </div>

        {!correlationCheck.canCorrelate && (
          <div className="p-3 bg-[#0B0E14] border border-[#1E293B] space-y-1 text-xs font-mono text-[#94A3B8]">
            {correlationCheck.issues.map((iss, idx) => (
              <div key={idx}>· {iss}</div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Layer-Indexed Observation Plot & Correlation Table */}
        <div className="space-y-6">
          <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3">
            <h2 className="text-base font-semibold text-[#F1F5F9]">
              Layer-Indexed Process Observations ({activeExp?.experimentCode})
            </h2>
            <div className="h-60 bg-[#0B0E14] border border-[#1E293B] p-3">
              {expObservations.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={expObservations}
                    margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
                  >
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="layerIndex"
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
                    <Line
                      type="stepAfter"
                      dataKey="numericValue"
                      name="Observed Value"
                      stroke="#06B6D4"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#F59E0B' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs font-mono text-[#94A3B8]">
                  No process observations logged for this experiment.
                </div>
              )}
            </div>
          </div>

          {/* Synchronized Layer Correlation Table (Only active if preconditions satisfied) */}
          <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3">
            <div className="text-xs font-mono text-cyan-400">
              LAYER-BY-LAYER OBSERVATION ↔ MEASUREMENT CORRELATION
            </div>
            {correlationCheck.canCorrelate ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1E293B] bg-[#0B0E14] text-[#94A3B8] text-[11px]">
                      <th className="py-2 px-3">Layer / Frame</th>
                      <th className="py-2 px-3">Process Observation</th>
                      <th className="py-2 px-3">Correlated Physical Measurement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {expObservations.map((o) => {
                      const matchingMeas = expMeasurements.filter(
                        (m) => m.layerIndex === o.layerIndex
                      );
                      return (
                        <tr key={o.id}>
                          <td className="py-2 px-3">
                            L{o.layerIndex} · {o.coordinateFrame}
                          </td>
                          <td className="py-2 px-3 text-cyan-400">
                            {o.observationType}: {o.numericValue} {o.unit} ({o.acquisitionSource})
                          </td>
                          <td className="py-2 px-3">
                            {matchingMeas.length > 0
                              ? matchingMeas
                                  .map(
                                    (m) =>
                                      `${m.measurementType}: ${m.measuredValue} ${m.unit}`
                                  )
                                  .join(' · ')
                              : 'No measurement at this layer'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-[#0B0E14] border border-[#1E293B] text-xs font-mono text-amber-400">
                ▲ Stream correlation table is locked until timestamp alignment and
                coordinate-frame consistency are verified above.
              </div>
            )}
          </div>
        </div>

        {/* Right: Log Observation Form & Observation Ledger */}
        <div className="space-y-6">
          <form
            onSubmit={handleLogObservation}
            className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4"
          >
            <div className="text-xs font-mono text-cyan-400">
              LOG PROCESS OBSERVATION WITH CLOCK & FRAME METADATA
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
              <div>
                <label className="block text-[10px] text-[#94A3B8] mb-1">
                  Layer Index *
                </label>
                <input
                  type="number"
                  value={obsLayer}
                  onChange={(e) => setObsLayer(Number(e.target.value))}
                  className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#94A3B8] mb-1">
                  Elapsed Time (s) *
                </label>
                <input
                  type="number"
                  value={obsElapsed}
                  onChange={(e) => setObsElapsed(Number(e.target.value))}
                  className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#94A3B8] mb-1">
                  Toolpath Segment ID *
                </label>
                <input
                  type="text"
                  value={obsSegment}
                  onChange={(e) => setObsSegment(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#94A3B8] mb-1">
                  Observation Type
                </label>
                <select
                  value={obsType}
                  onChange={(e) => setObsType(e.target.value as ObservationType)}
                  className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
                >
                  {ObservationTypeEnum.options.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-[#94A3B8] mb-1">
                  Numeric Value *
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={obsVal}
                  onChange={(e) => setObsVal(Number(e.target.value))}
                  className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#94A3B8] mb-1">
                  Unit *
                </label>
                <input
                  type="text"
                  value={obsUnit}
                  onChange={(e) => setObsUnit(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#94A3B8] mb-1">
                  Clock Sync Status
                </label>
                <select
                  value={obsClockStatus}
                  onChange={(e) =>
                    setObsClockStatus(
                      e.target.value as ProcessObservation['clockSyncStatus']
                    )
                  }
                  className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
                >
                  <option value="Synchronized NTP/PTP">Synchronized NTP/PTP</option>
                  <option value="Manual Offset Aligned">Manual Offset Aligned</option>
                  <option value="Unsynchronized Local Clock">
                    Unsynchronized Local Clock
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-[#94A3B8] mb-1">
                  Coordinate Frame *
                </label>
                <input
                  type="text"
                  value={obsCoordFrame}
                  onChange={(e) => setObsCoordFrame(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#94A3B8] mb-1">
                  Acquisition Source *
                </label>
                <input
                  type="text"
                  value={obsSource}
                  onChange={(e) => setObsSource(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-500 text-slate-950 font-semibold text-xs font-mono cursor-pointer"
            >
              + Record Process Observation
            </button>
          </form>

          <div className="bg-[#0F141C] border border-[#1E293B]">
            <div className="px-4 py-3 border-b border-[#1E293B] text-xs font-mono text-[#94A3B8]">
              PROCESS OBSERVATION STREAM LEDGER ({expObservations.length})
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#1E293B] bg-[#0B0E14] text-[#94A3B8] text-[11px]">
                    <th className="py-2 px-3">Elapsed / Layer</th>
                    <th className="py-2 px-3">Type & Value</th>
                    <th className="py-2 px-3">Clock & Frame</th>
                    <th className="py-2 px-3 text-right">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {expObservations.map((o) => (
                    <tr key={o.id}>
                      <td className="py-2 px-3">
                        <div>T+{o.elapsedTime}s · L{o.layerIndex}</div>
                        <div className="text-[10px] text-[#94A3B8]">
                          {o.toolpathSegmentId}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-cyan-400">
                          {o. numericValue} {o.unit}
                        </div>
                        <div className="text-[10px] text-[#94A3B8]">
                          {o.observationType} · {o.acquisitionSource}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-[11px]">
                        <div>{o.clockSyncStatus}</div>
                        <div className="text-[10px] text-[#94A3B8]">
                          {o.coordinateFrame}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={async () => {
                            await repository.deleteProcessObservation(o.id);
                            await refreshWorkspace();
                            notifyToast('Deleted process observation.');
                          }}
                          className="text-[#94A3B8] hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
