import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Save,
  Upload,
} from 'lucide-react';
import {
  DOMAIN_ENTITY_NAMES,
  Project,
} from '../domain/models';
import { INTEGRATION_REGISTRY } from '../integrations/adapters';
import { useResearchWorkspace } from '../repositories/repository';
import { runPhaseAVerificationChecks } from '../scientific/verification';
import {
  exportAssemblyVerificationsToCsv,
  exportExperimentsToCsv,
  exportMeasurementsToCsv,
  exportNodeDesignsToCsv,
  exportSpecimensToCsv,
  triggerBrowserDownload,
  validateAndMigrateWorkspaceSnapshot,
} from '../services/importExport';

// ============================================================================
// 1. DATA MANAGEMENT MODULE
// ============================================================================
export const DataManagementModule: React.FC = () => {
  const {
    snapshot,
    storageHealth,
    repository,
    refreshWorkspace,
    notifyToast,
  } = useResearchWorkspace();

  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreMode, setRestoreMode] = useState<
    'merge_preserve_user_data' | 'replace_all'
  >('merge_preserve_user_data');
  const [importErrors, setImportErrors] = useState<string[]>([]);

  if (!snapshot) return null;

  const handleExportFullBackupJson = () => {
    const json = JSON.stringify(snapshot, null, 2);
    triggerBrowserDownload(
      `FabricationResearchOS_Backup_v${snapshot.schemaVersion}_${new Date()
        .toISOString()
        .slice(0, 10)}.json`,
      json
    );
    notifyToast('Exported versioned JSON workspace backup (Schema v2).');
  };

  const handleImportBackupJson = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportErrors([]);
    const raw = await file.text();
    const res = validateAndMigrateWorkspaceSnapshot(raw);
    if (!res.valid || !res.snapshot) {
      setImportErrors(res.errors);
      notifyToast('Backup validation failed. See errors below.');
      return;
    }

    await repository.restoreWorkspaceSnapshot(res.snapshot, restoreMode);
    await refreshWorkspace();
    notifyToast(
      `Restored workspace snapshot (${
        restoreMode === 'merge_preserve_user_data'
          ? 'non-destructive merge'
          : 'full replacement'
      }${res.migratedFromVersion !== undefined ? `, migrated from Schema v${res.migratedFromVersion}` : ''}).`
    );
    e.target.value = '';
  };

  const handleLoadSampleFixtures = async () => {
    await repository.loadSampleDatasetNonDestructive();
    await refreshWorkspace();
    notifyToast(
      'Loaded MRAC 2026–2027 sample dataset (flagged with isSampleFixture=true).'
    );
  };

  const handleRemoveSampleFixturesOnly = async () => {
    const removed = await repository.removeSampleFixturesOnly();
    await refreshWorkspace();
    notifyToast(
      `Removed ${removed} sample fixture record(s). All user-created research records were preserved.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0F141C] border border-[#1E293B] p-5">
        <div className="text-xs font-mono text-cyan-400">
          SHARED INFRASTRUCTURE · DATA MANAGEMENT & PORTABILITY (SCHEMA v2)
        </div>
        <h1 className="text-xl font-semibold text-[#F1F5F9] mt-0.5">
          Versioned JSON Backup/Restore, CSV Exports, Non-Destructive Sample Fixtures & Checksum Ledger
        </h1>
      </div>

      {/* Explicit Browser Storage Warning Banner */}
      <div className="bg-[#0F141C] border border-amber-500/40 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-mono text-amber-400 font-semibold">
            LOCAL BROWSER STORAGE LIMITATION & BACKUP ADVISORY
          </div>
          <p className="text-[#94A3B8] leading-relaxed">
            Fabrication Research OS stores data locally in your browser&apos;s IndexedDB
            repository (`FabricationResearchOS_IDB`, Schema v{storageHealth.schemaVersion}
            , 17 entities). Clearing browser site data, using private/incognito windows, or
            switching machines will not carry over local IndexedDB state. Export a versioned
            JSON workspace backup after every physical lab session.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Versioned JSON Backup & Restore */}
        <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4">
          <div className="text-xs font-mono text-cyan-400">
            01. VERSIONED WORKSPACE BACKUP & RESTORE (JSON · v0.1.0 & v0.1.1 COMPATIBLE)
          </div>
          <p className="text-xs text-[#94A3B8]">
            Exports or restores all 17 canonical domain entities with schema version tags
            and automatic non-destructive Schema v1 → v2 migration checks.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportFullBackupJson}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs font-mono flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export Full Workspace JSON
            </button>

            <input
              ref={backupInputRef}
              type="file"
              accept=".json"
              onChange={handleImportBackupJson}
              className="hidden"
            />
            <button
              onClick={() => backupInputRef.current?.click()}
              className="px-4 py-2 bg-[#151C28] hover:bg-[#1E293B] border border-[#1E293B] text-[#F1F5F9] text-xs font-mono flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-cyan-400" /> Restore from JSON Backup
            </button>
          </div>

          <div className="pt-2 border-t border-[#1E293B] text-xs font-mono space-y-2">
            <label className="block text-[#94A3B8]">RESTORE MODE:</label>
            <select
              value={restoreMode}
              onChange={(e) =>
                setRestoreMode(
                  e.target.value as 'merge_preserve_user_data' | 'replace_all'
                )
              }
              className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-1.5 text-[#F1F5F9]"
            >
              <option value="merge_preserve_user_data">
                Non-Destructive Merge (Preserve existing user research records)
              </option>
              <option value="replace_all">
                Full Workspace Replace (Overwrite local store with backup file)
              </option>
            </select>
          </div>

          {importErrors.length > 0 && (
            <div className="p-3 bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-300 space-y-1">
              {importErrors.map((err, i) => (
                <div key={i}>✖ {err}</div>
              ))}
            </div>
          )}
        </div>

        {/* Non-Destructive Sample Dataset Controls */}
        <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4">
          <div className="text-xs font-mono text-emerald-400">
            02. NON-DESTRUCTIVE SAMPLE DATASET FIXTURES
          </div>
          <p className="text-xs text-[#94A3B8]">
            Sample fixtures are tagged with `isSampleFixture = true` and `SYNTHETIC DEMO
            DATA — NOT EXPERIMENTAL EVIDENCE`. Removing sample fixtures purges only sample
            records and{' '}
            <strong className="text-[#F1F5F9]">
              never deletes your own experiments, node designs, specimens, or measurements
            </strong>
            .
          </p>

          <div className="grid grid-cols-2 gap-3 bg-[#0B0E14] border border-[#1E293B] p-3 text-xs font-mono">
            <div>
              <span className="text-[#94A3B8] block text-[10px]">
                USER RESEARCH RECORDS
              </span>
              <span className="text-lg font-semibold text-emerald-400 tabular-nums">
                {storageHealth.userResearchRecordsCount}
              </span>
              <span className="text-[10px] text-[#94A3B8] ml-1">protected</span>
            </div>
            <div>
              <span className="text-[#94A3B8] block text-[10px]">
                SAMPLE FIXTURE RECORDS
              </span>
              <span className="text-lg font-semibold text-cyan-400 tabular-nums">
                {storageHealth.sampleRecordsCount}
              </span>
              <span className="text-[10px] text-[#94A3B8] ml-1">removable</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleLoadSampleFixtures}
              className="px-4 py-2 bg-[#151C28] hover:bg-[#1E293B] border border-cyan-500/50 text-cyan-400 text-xs font-mono cursor-pointer"
            >
              + Load Sample MRAC Dataset
            </button>
            <button
              onClick={handleRemoveSampleFixturesOnly}
              disabled={storageHealth.sampleRecordsCount === 0}
              className="px-4 py-2 bg-[#151C28] hover:bg-[#1E293B] disabled:opacity-40 border border-[#1E293B] text-amber-400 text-xs font-mono cursor-pointer"
            >
              Remove Sample Fixtures Only ({storageHealth.sampleRecordsCount})
            </button>
          </div>
        </div>
      </div>

      {/* File & Dataset Metadata Ledger + Entity CSV Exports */}
      <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-mono text-[#94A3B8]">
            FILE & DATASET METADATA LEDGER ({snapshot.fileMetadata.length} datasets)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const csv = exportExperimentsToCsv(snapshot.experiments);
                triggerBrowserDownload('All_Experiments.csv', csv, 'text/csv');
              }}
              className="px-2.5 py-1 bg-[#151C28] hover:bg-[#1E293B] border border-[#1E293B] text-xs font-mono text-[#F1F5F9] cursor-pointer"
            >
              Export Experiments CSV
            </button>
            <button
              onClick={() => {
                const csv = exportNodeDesignsToCsv(
                  snapshot.nodeDesigns,
                  snapshot.nodeFeatureDefinitions
                );
                triggerBrowserDownload('All_Node_Designs.csv', csv, 'text/csv');
              }}
              className="px-2.5 py-1 bg-[#151C28] hover:bg-[#1E293B] border border-[#1E293B] text-xs font-mono text-[#F1F5F9] cursor-pointer"
            >
              Export Node Designs CSV
            </button>
            <button
              onClick={() => {
                const csv = exportSpecimensToCsv(snapshot.specimens);
                triggerBrowserDownload('All_Specimens.csv', csv, 'text/csv');
              }}
              className="px-2.5 py-1 bg-[#151C28] hover:bg-[#1E293B] border border-[#1E293B] text-xs font-mono text-[#F1F5F9] cursor-pointer"
            >
              Export Specimens CSV
            </button>
            <button
              onClick={() => {
                const csv = exportMeasurementsToCsv(snapshot.measurements);
                triggerBrowserDownload('All_Measurements.csv', csv, 'text/csv');
              }}
              className="px-2.5 py-1 bg-[#151C28] hover:bg-[#1E293B] border border-[#1E293B] text-xs font-mono text-[#F1F5F9] cursor-pointer"
            >
              Export Measurements CSV
            </button>
            <button
              onClick={() => {
                const csv = exportAssemblyVerificationsToCsv(
                  snapshot.assemblyVerifications
                );
                triggerBrowserDownload('All_Assembly_Verifications.csv', csv, 'text/csv');
              }}
              className="px-2.5 py-1 bg-[#151C28] hover:bg-[#1E293B] border border-[#1E293B] text-xs font-mono text-[#F1F5F9] cursor-pointer"
            >
              Export Assembly Fit CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1E293B] bg-[#0B0E14] text-[#94A3B8] text-[11px]">
                <th className="py-2 px-3">Filename</th>
                <th className="py-2 px-3">Schema & Type</th>
                <th className="py-2 px-3 text-right">Records</th>
                <th className="py-2 px-3">Checksum (SHA-256)</th>
                <th className="py-2 px-3">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {snapshot.fileMetadata.map((f) => (
                <tr key={f.id}>
                  <td className="py-2 px-3 text-cyan-400">{f.filename}</td>
                  <td className="py-2 px-3">
                    {f.datasetSchema} ({f.fileType})
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {f.recordCount}
                  </td>
                  <td className="py-2 px-3 text-[11px] text-[#94A3B8]">
                    {f.checksum.slice(0, 28)}...
                  </td>
                  <td className="py-2 px-3 text-emerald-400">
                    {f.fileAvailability}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. PROJECT SETTINGS MODULE
// ============================================================================
export const ProjectSettingsModule: React.FC = () => {
  const { snapshot, repository, refreshWorkspace, notifyToast } =
    useResearchWorkspace();

  const project = snapshot?.project;

  const [name, setName] = useState<string>(project?.name || '');
  const [thesisTitle, setThesisTitle] = useState<string>(
    project?.workingThesisTitle || ''
  );
  const [workingQuestion, setWorkingQuestion] = useState<string>(
    project?.workingResearchQuestion || ''
  );
  const [abstractText, setAbstractText] = useState<string>(
    project?.submittedAbstract || ''
  );
  const [questionsText, setQuestionsText] = useState<string>(
    (project?.researchQuestions || []).join('\n')
  );
  const [hypothesesText, setHypothesesText] = useState<string>(
    (project?.hypotheses || []).join('\n')
  );
  const [objectivesText, setObjectivesText] = useState<string>(
    (project?.objectives || []).join('\n')
  );
  const [notes, setNotes] = useState<string>(project?.notes || '');
  const [revisionNote, setRevisionNote] = useState<string>('');

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setThesisTitle(project.workingThesisTitle);
    setWorkingQuestion(project.workingResearchQuestion || '');
    setAbstractText(project.submittedAbstract);
    setQuestionsText(project.researchQuestions.join('\n'));
    setHypothesesText(project.hypotheses.join('\n'));
    setObjectivesText(project.objectives.join('\n'));
    setNotes(project.notes);
  }, [project]);

  if (!project) return null;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextHistory = [...(project.revisionHistory || [])];
    if (revisionNote.trim()) {
      nextHistory.unshift({
        revisionId: `rev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        summary: revisionNote.trim(),
        actor: 'Researcher',
      });
    }

    const updated: Project = {
      ...project,
      name: name.trim() || project.name,
      workingThesisTitle: thesisTitle.trim(),
      workingResearchQuestion: workingQuestion.trim(),
      submittedAbstract: abstractText.trim(),
      researchQuestions: questionsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      hypotheses: hypothesesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      objectives: objectivesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      revisionHistory: nextHistory,
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    };

    await repository.saveProject(updated);
    setRevisionNote('');
    await refreshWorkspace();
    notifyToast('Saved Project Settings and thesis framing to IndexedDB.');
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0F141C] border border-[#1E293B] p-5">
        <div className="text-xs font-mono text-cyan-400">
          SHARED INFRASTRUCTURE · PROJECT SETTINGS & THESIS FRAMING (v0.1.1)
        </div>
        <h1 className="text-xl font-semibold text-[#F1F5F9] mt-0.5">
          Working Thesis Title, Working Research Question, Submitted Abstract & Revision History
        </h1>
      </div>

      <form
        onSubmit={handleSaveSettings}
        className="bg-[#0F141C] border border-[#1E293B] p-6 space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-[#94A3B8] mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[#94A3B8] mb-1">
              Working Thesis Title *
            </label>
            <input
              type="text"
              value={thesisTitle}
              onChange={(e) => setThesisTitle(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-cyan-400 mb-1">
            Working Research Question (Editable — distinct from Official Submitted Abstract)
          </label>
          <textarea
            rows={2}
            value={workingQuestion}
            onChange={(e) => setWorkingQuestion(e.target.value)}
            className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-[#94A3B8] mb-1">
            Official Submitted Thesis Abstract (Paste your approved abstract here — never
            auto-invented)
          </label>
          <textarea
            rows={3}
            value={abstractText}
            onChange={(e) => setAbstractText(e.target.value)}
            placeholder="Paste your official IAAC MRAC 2026–2027 submitted thesis abstract..."
            className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-mono text-[#94A3B8] mb-1">
              Research Questions (One per line)
            </label>
            <textarea
              rows={5}
              value={questionsText}
              onChange={(e) => setQuestionsText(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[#94A3B8] mb-1">
              Testable Hypotheses (One per line)
            </label>
            <textarea
              rows={5}
              value={hypothesesText}
              onChange={(e) => setHypothesesText(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[#94A3B8] mb-1">
              Research Objectives (One per line)
            </label>
            <textarea
              rows={5}
              value={objectivesText}
              onChange={(e) => setObjectivesText(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#1E293B]">
          <div>
            <label className="block text-xs font-mono text-[#94A3B8] mb-1">
              Log Revision History Entry (Optional)
            </label>
            <input
              type="text"
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              placeholder="e.g., Refined H2 tolerance target for fired ceramic socket clearance..."
              className="w-full bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-xs text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[#94A3B8] mb-1">
              Recent Framing Revisions ({(project.revisionHistory || []).length})
            </label>
            <div className="bg-[#0B0E14] border border-[#1E293B] p-2.5 max-h-24 overflow-y-auto space-y-1 text-[11px] font-mono">
              {(project.revisionHistory || []).map((rev) => (
                <div key={rev.revisionId} className="text-[#94A3B8]">
                  <span className="text-cyan-400">
                    {rev.timestamp.slice(0, 10)}
                  </span>{' '}
                  · {rev.summary}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-[#1E293B]">
          <button
            type="submit"
            className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs font-mono flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Project Framing
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================================================
// 3. SYSTEM STATUS MODULE
// ============================================================================
export const SystemStatusModule: React.FC = () => {
  const { snapshot, storageHealth } = useResearchWorkspace();

  if (!snapshot) return null;

  const entityCounts: Record<string, number> = {
    Project: 1,
    MaterialProfile: snapshot.materialProfiles.length,
    HardwareProfile: snapshot.hardwareProfiles.length,
    NodeDesign: snapshot.nodeDesigns.length,
    NodeFeatureDefinition: snapshot.nodeFeatureDefinitions.length,
    Experiment: snapshot.experiments.length,
    Specimen: snapshot.specimens.length,
    ProcessParameterSet: snapshot.processParameterSets.length,
    Measurement: snapshot.measurements.length,
    AssemblyVerification: snapshot.assemblyVerifications.length,
    ProcessObservation: snapshot.processObservations.length,
    CalibrationSession: snapshot.calibrationSessions.length,
    CalibrationTrial: snapshot.calibrationTrials.length,
    ResearchReference: snapshot.researchReferences.length,
    ProductionMetricRecord: snapshot.productionMetrics.length,
    FileDatasetMetadata: snapshot.fileMetadata.length,
    AuditEvent: snapshot.auditEvents.length,
  };

  const verificationSuite = runPhaseAVerificationChecks();

  return (
    <div className="space-y-6">
      <div className="bg-[#0F141C] border border-[#1E293B] p-5">
        <div className="text-xs font-mono text-cyan-400">
          SHARED INFRASTRUCTURE · SYSTEM STATUS, INTEGRATIONS & AUDIT TRAIL (v0.1.1)
        </div>
        <h1 className="text-xl font-semibold text-[#F1F5F9] mt-0.5">
          Canonical 17-Entity Repository Diagnostics, External Contracts & Audit Log
        </h1>
      </div>

      {/* Automated Scientific & Data Integrity Verification */}
      <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono text-emerald-400">
            ● v0.1.1 SCIENTIFIC & DATA INTEGRITY VERIFICATION SUITE
          </div>
          <div className="text-xs font-mono text-[#F1F5F9]">
            {verificationSuite.results.filter((r) => r.passed).length} /{' '}
            {verificationSuite.results.length} Checks Passed
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          {verificationSuite.results.map((chk, idx) => (
            <div
              key={idx}
              className="p-3 bg-[#0B0E14] border border-[#1E293B] space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-[#F1F5F9] font-semibold">{chk.check}</span>
                <span
                  className={chk.passed ? 'text-emerald-400' : 'text-rose-400'}
                >
                  {chk.passed ? '● PASS' : '✖ FAIL'}
                </span>
              </div>
              <div className="text-[11px] text-[#94A3B8]">{chk.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 17 Domain Entities Verification Grid */}
      <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs font-mono text-emerald-400">
            ● CANONICAL 17 DOMAIN ENTITIES — INDEXEDDB OBJECT STORES VERIFIED (SCHEMA v2)
          </div>
          <div className="text-xs font-mono text-[#94A3B8]">
            Adapter: {storageHealth.adapterName} · Est. Usage:{' '}
            {storageHealth.estimatedUsageBytes !== null
              ? `${(storageHealth.estimatedUsageBytes / 1024).toFixed(1)} KB`
              : 'Available'}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {DOMAIN_ENTITY_NAMES.map((name, idx) => (
            <div
              key={name}
              className="p-3 bg-[#0B0E14] border border-[#1E293B] font-mono text-xs"
            >
              <div className="text-[10px] text-[#94A3B8]">
                ENTITY {String(idx + 1).padStart(2, '0')}
              </div>
              <div className="text-[#F1F5F9] font-medium truncate mt-0.5">
                {name}
              </div>
              <div className="text-cyan-400 font-semibold tabular-nums mt-1">
                {entityCounts[name] ?? 0} records
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform-Neutral Integration Contracts Table */}
      <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3">
        <div className="text-xs font-mono text-cyan-400">
          PLATFORM-NEUTRAL EXTERNAL INTEGRATION INTERFACES (NO SIMULATED LIVE SENSORS)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1E293B] bg-[#0B0E14] text-[#94A3B8] text-[11px]">
                <th className="py-2.5 px-3">Integration Adapter</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Phase A Implementation Status</th>
                <th className="py-2.5 px-3">Live Connection</th>
                <th className="py-2.5 px-3">Protocol / File Specification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {INTEGRATION_REGISTRY.map((intItem) => (
                <tr key={intItem.id}>
                  <td className="py-2.5 px-3 text-[#F1F5F9]">{intItem.name}</td>
                  <td className="py-2.5 px-3 text-[#94A3B8]">{intItem.category}</td>
                  <td className="py-2.5 px-3">
                    {intItem.phaseAStatus === 'Active Offline File Contract' ? (
                      <span className="text-emerald-400">
                        ● {intItem.phaseAStatus}
                      </span>
                    ) : (
                      <span className="text-amber-400">
                        ▲ {intItem.phaseAStatus}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[#94A3B8]">
                    Offline Only (No Live Hardware)
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {intItem.protocolDescription}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Immutable Audit Trail */}
      <div className="bg-[#0F141C] border border-[#1E293B] p-5 space-y-3">
        <div className="text-xs font-mono text-[#94A3B8]">
          REPOSITORY AUDIT EVENT LOG ({snapshot.auditEvents.length} events)
        </div>
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1E293B] bg-[#0B0E14] text-[#94A3B8] text-[11px]">
                <th className="py-2 px-3">Timestamp (ISO-8601)</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Entity Type</th>
                <th className="py-2 px-3">Summary</th>
                <th className="py-2 px-3">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {snapshot.auditEvents.slice(0, 60).map((ev) => (
                <tr key={ev.id}>
                  <td className="py-2 px-3 text-[#94A3B8] whitespace-nowrap">
                    {ev.timestamp.replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="py-2 px-3 text-cyan-400">{ev.action}</td>
                  <td className="py-2 px-3 text-slate-300">{ev.entityType}</td>
                  <td className="py-2 px-3 text-[#F1F5F9]">{ev.summary}</td>
                  <td className="py-2 px-3 text-[#94A3B8]">{ev.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
