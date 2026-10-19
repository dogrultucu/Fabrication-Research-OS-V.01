import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ProductionMetricRecord } from '../domain/models';
import { useResearchWorkspace } from '../repositories/repository';
import { computeProductionEfficiency } from '../scientific/calculations';

export const IndustryMetricsModule: React.FC = () => {
  const {
    snapshot,
    selectedExperimentId,
    setSelectedExperimentId,
    repository,
    refreshWorkspace,
    notifyToast,
  } = useResearchWorkspace();

  const [accepted, setAccepted] = useState<number>(3);
  const [rejected, setRejected] = useState<number>(0);
  const [matUsedG, setMatUsedG] = useState<number>(5800);
  const [matWasteG, setMatWasteG] = useState<number>(450);
  const [setupMin, setSetupMin] = useState<number>(25);
  const [printMin, setPrintMin] = useState<number>(55);
  const [calMin, setCalMin] = useState<number>(8);
  const [downMin, setDownMin] = useState<number>(4);
  const [energyKwh, setEnergyKwh] = useState<number>(2.1);
  const [matCostKg, setMatCostKg] = useState<number>(1.8);
  const [machRateHr, setMachRateHr] = useState<number>(22.0);
  const [opRateHr, setOpRateHr] = useState<number>(25.0);
  const [notes, setNotes] = useState<string>('');

  if (!snapshot) return null;

  const { experiments, productionMetrics } = snapshot;
  const activeExp =
    experiments.find((e) => e.id === selectedExperimentId) || experiments[0];

  const handleSaveProductionRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExp) return;
    const existing = productionMetrics.find(
      (r) => r.experimentId === activeExp.id
    );
    const rec: ProductionMetricRecord = {
      id: existing ? existing.id : `prod-${Date.now()}`,
      experimentId: activeExp.id,
      acceptedPartCount: Number(accepted),
      rejectedPartCount: Number(rejected),
      materialUsed: Number(matUsedG),
      materialWaste: Number(matWasteG),
      setupDuration: Number(setupMin),
      printDuration: Number(printMin),
      calibrationDuration: Number(calMin),
      downtime: Number(downMin),
      energyUsed: Number(energyKwh),
      manuallyEnteredCostInputs: {
        materialCostPerKgEur: Number(matCostKg),
        machineHourlyRateEur: Number(machRateHr),
        operatorHourlyRateEur: Number(opRateHr),
      },
      metricUnits: {
        massUnit: 'g',
        durationUnit: 'min',
        energyUnit: 'kWh',
        currencyUnit: 'EUR',
      },
      provenance: 'Logged from Lab Run',
      notes: notes.trim(),
      isSampleFixture: false,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
    };

    await repository.saveProductionMetric(rec, !existing);
    await refreshWorkspace();
    notifyToast(`Saved production metric record for ${activeExp.experimentCode}.`);
  };

  const chartData = productionMetrics.map((rec) => {
    const exp = experiments.find((e) => e.id === rec.experimentId);
    const eff = computeProductionEfficiency(rec);
    return {
      code: exp ? exp.experimentCode : rec.experimentId,
      YieldRatePct: Number(eff.yieldRatePercent.toFixed(1)),
      WasteRatioPct: Number(eff.wasteRatioPercent.toFixed(1)),
      CalOverheadPct: Number(eff.calibrationOverheadPercent.toFixed(1)),
    };
  });

  return (
    <div className="space-y-6">
      <div className="bg-[#0F141C] border border-[#1E293B] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            MODULE 06 · INDUSTRY METRICS (EMPIRICAL YIELD, SCRAP & CYCLE OVERHEAD)
          </div>
          <h1 className="text-xl font-semibold text-[#F1F5F9] mt-0.5">
            Manufacturing Efficiency, Material Waste & Checkpoint Time Accounting
          </h1>
        </div>

        <select
          aria-label="Select Experiment for Industry Metrics"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Efficiency Comparison Table & Bar Chart */}
        <div className="space-y-6">
          <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3">
            <h2 className="text-base font-semibold text-[#F1F5F9]">
              Yield Rate vs. Scrap Waste & Calibration Pause Overhead (%)
            </h2>
            <div className="h-64 bg-[#0B0E14] border border-[#1E293B] p-3">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
                  >
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="code"
                      stroke="#94A3B8"
                      tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
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
                    <Legend
                      wrapperStyle={{
                        fontFamily: 'IBM Plex Mono',
                        fontSize: '11px',
                      }}
                    />
                    <Bar
                      dataKey="YieldRatePct"
                      name="Accepted Yield (%)"
                      fill="#10B981"
                    />
                    <Bar
                      dataKey="WasteRatioPct"
                      name="Material Waste Ratio (%)"
                      fill="#F43F5E"
                    />
                    <Bar
                      dataKey="CalOverheadPct"
                      name="Calibration Time Overhead (%)"
                      fill="#06B6D4"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs font-mono text-[#94A3B8]">
                  No production metric records logged yet.
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#0F141C] border border-[#1E293B] overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1E293B] bg-[#0B0E14] text-[#94A3B8] text-[11px]">
                  <th className="py-2.5 px-3">Experiment</th>
                  <th className="py-2.5 px-3 text-right">Accepted / Rej</th>
                  <th className="py-2.5 px-3 text-right">Used / Waste (g)</th>
                  <th className="py-2.5 px-3 text-right">Cycle Time (min)</th>
                  <th className="py-2.5 px-3 text-right">Cost / Accepted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {productionMetrics.map((rec) => {
                  const exp = experiments.find((e) => e.id === rec.experimentId);
                  const eff = computeProductionEfficiency(rec);
                  return (
                    <tr key={rec.id}>
                      <td className="py-2.5 px-3 text-cyan-400">
                        {exp ? exp.experimentCode : rec.experimentId}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {rec.acceptedPartCount} / {rec.rejectedPartCount} (
                        {eff.yieldRatePercent.toFixed(0)}%)
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {rec.materialUsed} / {rec.materialWaste} g
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {eff.totalCycleDurationMin} min (Cal: {rec.calibrationDuration}m)
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-400">
                        {eff.costPerAcceptedPartEur !== null
                          ? `€${eff.costPerAcceptedPartEur.toFixed(2)}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Log Production Metric Form */}
        <form
          onSubmit={handleSaveProductionRecord}
          className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4 h-fit"
        >
          <div className="text-xs font-mono text-cyan-400">
            LOG PRODUCTION METRICS FOR {activeExp?.experimentCode || 'EXPERIMENT'}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1">
                Accepted Parts (count)
              </label>
              <input
                type="number"
                value={accepted}
                onChange={(e) => setAccepted(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1">
                Rejected Parts (count)
              </label>
              <input
                type="number"
                value={rejected}
                onChange={(e) => setRejected(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1">
                Energy Used (kWh)
              </label>
              <input
                type="number"
                step="0.1"
                value={energyKwh}
                onChange={(e) => setEnergyKwh(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>

            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1">
                Net Material Used (g)
              </label>
              <input
                type="number"
                value={matUsedG}
                onChange={(e) => setMatUsedG(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1">
                Scrap / Purge Waste (g)
              </label>
              <input
                type="number"
                value={matWasteG}
                onChange={(e) => setMatWasteG(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1">
                Setup Duration (min)
              </label>
              <input
                type="number"
                value={setupMin}
                onChange={(e) => setSetupMin(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>

            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1">
                Print Duration (min)
              </label>
              <input
                type="number"
                value={printMin}
                onChange={(e) => setPrintMin(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1">
                Calibration Pause (min)
              </label>
              <input
                type="number"
                value={calMin}
                onChange={(e) => setCalMin(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1">
                Downtime (min)
              </label>
              <input
                type="number"
                value={downMin}
                onChange={(e) => setDownMin(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>

            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1">
                Material Cost (€/kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={matCostKg}
                onChange={(e) => setMatCostKg(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1">
                Machine Rate (€/hr)
              </label>
              <input
                type="number"
                step="1"
                value={machRateHr}
                onChange={(e) => setMachRateHr(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1">
                Operator Rate (€/hr)
              </label>
              <input
                type="number"
                step="1"
                value={opRateHr}
                onChange={(e) => setOpRateHr(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-[#1E293B] px-2.5 py-1.5 text-[#F1F5F9]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!activeExp}
            className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-semibold text-xs font-mono cursor-pointer"
          >
            Save Production Efficiency Record
          </button>
        </form>
      </div>
    </div>
  );
};
