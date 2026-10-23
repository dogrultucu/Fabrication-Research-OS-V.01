/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Activity,
  BookOpen,
  ClipboardCheck,
  Database,
  Download,
  Factory,
  FlaskConical,
  LayoutDashboard,
  Search,
  Settings,
  Sliders,
  Upload,
} from 'lucide-react';
import { CalibrationStudioModule } from './modules/CalibrationStudioModule';
import { ExperimentLabModule } from './modules/ExperimentLabModule';
import { IndustryMetricsModule } from './modules/IndustryMetricsModule';
import { OverviewModule } from './modules/OverviewModule';
import { ProcessExplorerModule } from './modules/ProcessExplorerModule';
import { QualityInspectorModule } from './modules/QualityInspectorModule';
import { ResearchLibraryModule } from './modules/ResearchLibraryModule';
import {
  DataManagementModule,
  ProjectSettingsModule,
  SystemStatusModule,
} from './modules/SystemModules';
import {
  ActiveModuleId,
  ResearchWorkspaceProvider,
  useResearchWorkspace,
} from './repositories/repository';
import { triggerBrowserDownload } from './services/importExport';

const MODULE_LABELS: Record<
  ActiveModuleId,
  { title: string; phaseBadge: string }
> = {
  overview: { title: 'Overview', phaseBadge: 'Core' },
  'experiment-lab': { title: '01. Experiment Lab', phaseBadge: 'v0.1.1 Core' },
  'quality-inspector': {
    title: '02. Quality Inspector',
    phaseBadge: 'Node & Extrusion',
  },
  'calibration-studio': {
    title: '03. Calibration Studio',
    phaseBadge: 'Deterministic',
  },
  'process-explorer': {
    title: '04. Process Explorer',
    phaseBadge: 'Sync-Guarded',
  },
  'research-library': { title: '05. Research Library', phaseBadge: 'Traceable' },
  'industry-metrics': { title: '06. Industry Metrics', phaseBadge: 'Stage Yield' },
  'data-management': { title: 'Data Management', phaseBadge: 'Backup/CSV' },
  'project-settings': { title: 'Project Settings', phaseBadge: 'Framing' },
  'system-status': { title: 'System Status', phaseBadge: '17 Entities' },
};

const ApplicationShell: React.FC = () => {
  const {
    snapshot,
    loading,
    error,
    activeModule,
    setActiveModule,
    selectedExperimentId,
    setSelectedExperimentId,
    selectedSpecimenId,
    setSelectedSpecimenId,
    globalSearchQuery,
    setGlobalSearchQuery,
    storageHealth,
    toastMessage,
    notifyToast,
  } = useResearchWorkspace();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-[#F1F5F9] flex items-center justify-center font-mono text-xs">
        Initializing Fabrication Research OS Local IndexedDB Repository (v0.1.1 Schema v2)...
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-rose-400 flex items-center justify-center p-8 font-mono text-xs">
        Repository Error: {error || 'Workspace snapshot unavailable'}
      </div>
    );
  }

  const activeExperiment = snapshot.experiments.find(
    (e) => e.id === selectedExperimentId
  );
  const experimentSpecimens = snapshot.specimens.filter(
    (s) => !selectedExperimentId || s.experimentId === selectedExperimentId
  );
  const activeSpecimen = snapshot.specimens.find(
    (s) => s.id === selectedSpecimenId
  );

  const handleQuickExportSnapshot = () => {
    const json = JSON.stringify(snapshot, null, 2);
    triggerBrowserDownload(
      `FRO_Snapshot_v${snapshot.schemaVersion}_${new Date()
        .toISOString()
        .slice(0, 10)}.json`,
      json
    );
    notifyToast('Exported full JSON workspace backup (Schema v2).');
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F1F5F9] flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-[#0F141C] border-b border-[#1E293B] px-5 flex items-center justify-between gap-4 shrink-0">
        {/* Zone 1: Brand Title */}
        <button
          onClick={() => setActiveModule('overview')}
          className="text-left flex items-baseline gap-2.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span className="font-display font-bold text-base tracking-tight text-[#F1F5F9]">
            Fabrication Research OS
          </span>
          <span className="text-[11px] font-mono text-cyan-400">v0.1.1</span>
        </button>

        {/* Zone 2: Global Search, Active Experiment & Specimen Selector & Data Mode Indicator */}
        <div className="hidden md:flex items-center gap-3 flex-1 max-w-4xl">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Search experiments, specimens, nodes..."
              className="w-full bg-[#0B0E14] border border-[#1E293B] pl-8 pr-3 py-1 text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono shrink-0">
            <span className="text-[#94A3B8]">Run:</span>
            <select
              aria-label="Active Experiment Shortcut"
              value={selectedExperimentId || ''}
              onChange={(e) => {
                const nextExpId = e.target.value || null;
                setSelectedExperimentId(nextExpId);
                const firstSpec = snapshot.specimens.find(
                  (s) => s.experimentId === nextExpId
                );
                setSelectedSpecimenId(firstSpec?.id || null);
              }}
              className="bg-[#0B0E14] border border-[#1E293B] px-2 py-1 text-xs font-mono text-cyan-400"
            >
              {snapshot.experiments.length === 0 ? (
                <option value="">No Experiments</option>
              ) : (
                snapshot.experiments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.experimentCode} ({e.status})
                  </option>
                ))
              )}
            </select>
          </div>

          {experimentSpecimens.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-mono shrink-0">
              <span className="text-[#94A3B8]">Specimen:</span>
              <select
                aria-label="Active Specimen Shortcut"
                value={selectedSpecimenId || ''}
                onChange={(e) => setSelectedSpecimenId(e.target.value || null)}
                className="bg-[#0B0E14] border border-[#1E293B] px-2 py-1 text-xs font-mono text-emerald-400"
              >
                {experimentSpecimens.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.specimenCode} [{s.currentPhysicalStage}]
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-[11px] font-mono text-[#94A3B8] whitespace-nowrap shrink-0">
            IDB v{storageHealth.schemaVersion} · {storageHealth.userResearchRecordsCount} User /{' '}
            {storageHealth.sampleRecordsCount} Sample
          </div>
        </div>

        {/* Zone 3: Import & Export Shortcuts */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveModule('data-management')}
            className="px-3 py-1.5 bg-[#151C28] hover:bg-[#1E293B] border border-[#1E293B] text-xs font-mono text-[#F1F5F9] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" /> Import
          </button>
          <button
            onClick={handleQuickExportSnapshot}
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs font-mono flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Backup
          </button>
        </div>
      </header>

      {/* Main Layout Split: Left Sidebar + Viewport */}
      <div className="flex flex-1 min-h-0">
        {/* Left Navigation Sidebar */}
        <aside className="w-64 bg-[#0F141C] border-r border-[#1E293B] flex flex-col justify-between shrink-0">
          <div className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-mono text-[#94A3B8]">
              RESEARCH MODULES
            </div>

            {(
              [
                {
                  id: 'overview',
                  label: 'Overview',
                  icon: LayoutDashboard,
                },
                {
                  id: 'experiment-lab',
                  label: '01. Experiment Lab',
                  icon: FlaskConical,
                },
                {
                  id: 'quality-inspector',
                  label: '02. Quality Inspector',
                  icon: ClipboardCheck,
                },
                {
                  id: 'calibration-studio',
                  label: '03. Calibration Studio',
                  icon: Sliders,
                },
                {
                  id: 'process-explorer',
                  label: '04. Process Explorer',
                  icon: Activity,
                },
                {
                  id: 'research-library',
                  label: '05. Research Library',
                  icon: BookOpen,
                },
                {
                  id: 'industry-metrics',
                  label: '06. Industry Metrics',
                  icon: Factory,
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#151C28] text-cyan-400 border border-[#1E293B]'
                      : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#151C28]/50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom Sidebar Utilities */}
          <div className="p-3 border-t border-[#1E293B] space-y-1">
            <div className="px-3 py-1 text-[10px] font-mono text-[#94A3B8]">
              WORKSPACE & INFRASTRUCTURE
            </div>
            {(
              [
                {
                  id: 'data-management',
                  label: 'Data Management',
                  icon: Database,
                },
                {
                  id: 'project-settings',
                  label: 'Project Settings',
                  icon: Settings,
                },
                {
                  id: 'system-status',
                  label: 'System Status',
                  icon: Activity,
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#151C28] text-cyan-400 border border-[#1E293B]'
                      : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#151C28]/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Contextual Breadcrumb Strip */}
          <div className="h-9 bg-[#0B0E14] border-b border-[#1E293B] px-6 flex items-center justify-between text-xs font-mono text-[#94A3B8]">
            <div className="flex items-center gap-2 truncate">
              <button
                onClick={() => setActiveModule('overview')}
                className="hover:text-[#F1F5F9] cursor-pointer"
              >
                {snapshot.project.name}
              </button>
              <span>/</span>
              <span className="text-[#F1F5F9]">
                {MODULE_LABELS[activeModule].title}
              </span>
              {activeExperiment && (
                <>
                  <span>/</span>
                  <span className="text-cyan-400">
                    {activeExperiment.experimentCode}
                  </span>
                </>
              )}
              {activeSpecimen &&
                activeSpecimen.experimentId === activeExperiment?.id && (
                  <>
                    <span>/</span>
                    <span className="text-emerald-400">
                      {activeSpecimen.specimenCode} [{activeSpecimen.currentPhysicalStage}]
                    </span>
                  </>
                )}
            </div>

            {toastMessage && (
              <div className="text-emerald-400 text-xs font-mono truncate">
                ● {toastMessage}
              </div>
            )}
          </div>

          {/* Module Viewport */}
          <div className="p-6 flex-1 overflow-y-auto">
            {activeModule === 'overview' && <OverviewModule />}
            {activeModule === 'experiment-lab' && <ExperimentLabModule />}
            {activeModule === 'quality-inspector' && <QualityInspectorModule />}
            {activeModule === 'calibration-studio' && (
              <CalibrationStudioModule />
            )}
            {activeModule === 'process-explorer' && <ProcessExplorerModule />}
            {activeModule === 'research-library' && <ResearchLibraryModule />}
            {activeModule === 'industry-metrics' && <IndustryMetricsModule />}
            {activeModule === 'data-management' && <DataManagementModule />}
            {activeModule === 'project-settings' && <ProjectSettingsModule />}
            {activeModule === 'system-status' && <SystemStatusModule />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ResearchWorkspaceProvider>
      <ApplicationShell />
    </ResearchWorkspaceProvider>
  );
}
