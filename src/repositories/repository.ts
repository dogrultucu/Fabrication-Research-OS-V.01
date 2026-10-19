import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  APP_VERSION,
  AuditEntityType,
  AuditEvent,
  CalibrationSession,
  CalibrationTrial,
  Experiment,
  FileDatasetMetadata,
  HardwareProfile,
  MaterialProfile,
  Measurement,
  ProcessObservation,
  ProcessParameterSet,
  ProductionMetricRecord,
  Project,
  ResearchReference,
  ResearchWorkspaceSnapshot,
  SCHEMA_VERSION,
} from '../domain/models';
import { createDefaultProject, createSampleDataset } from '../fixtures/sampleDataset';

const DB_NAME = 'FabricationResearchOS_IDB';
const DB_VERSION = 1;

const STORES = {
  projects: 'projects',
  materialProfiles: 'materialProfiles',
  hardwareProfiles: 'hardwareProfiles',
  experiments: 'experiments',
  processParameterSets: 'processParameterSets',
  measurements: 'measurements',
  processObservations: 'processObservations',
  calibrationSessions: 'calibrationSessions',
  calibrationTrials: 'calibrationTrials',
  researchReferences: 'researchReferences',
  productionMetrics: 'productionMetrics',
  fileMetadata: 'fileMetadata',
  auditEvents: 'auditEvents',
} as const;

export interface StorageHealthInfo {
  adapterName: 'IndexedDB Local Repository (v1)';
  schemaVersion: number;
  isPersistentAvailable: boolean;
  estimatedUsageBytes: number | null;
  estimatedQuotaBytes: number | null;
  sampleRecordsCount: number;
  userResearchRecordsCount: number;
}

/**
 * Repository abstraction for all 13 canonical domain entities.
 * Allows IndexedDB to be swapped for SQLite or PostgreSQL in future phases without UI rewrites.
 */
export interface ResearchRepository {
  loadWorkspace(): Promise<ResearchWorkspaceSnapshot>;
  saveProject(project: Project, actor?: string): Promise<void>;
  saveMaterialProfile(profile: MaterialProfile, isNew: boolean, actor?: string): Promise<void>;
  deleteMaterialProfile(id: string, actor?: string): Promise<{ ok: boolean; error?: string }>;
  saveHardwareProfile(profile: HardwareProfile, isNew: boolean, actor?: string): Promise<void>;
  deleteHardwareProfile(id: string, actor?: string): Promise<{ ok: boolean; error?: string }>;
  saveExperiment(experiment: Experiment, isNew: boolean, actor?: string): Promise<void>;
  deleteExperiment(id: string, actor?: string): Promise<void>;
  saveMeasurement(measurement: Measurement, isNew: boolean, actor?: string): Promise<void>;
  saveMeasurementsBatch(
    measurements: Measurement[],
    fileMeta?: FileDatasetMetadata,
    actor?: string
  ): Promise<void>;
  deleteMeasurement(id: string, actor?: string): Promise<void>;
  saveProcessObservation(obs: ProcessObservation, actor?: string): Promise<void>;
  deleteProcessObservation(id: string, actor?: string): Promise<void>;
  saveCalibrationSession(session: CalibrationSession, isNew: boolean, actor?: string): Promise<void>;
  saveCalibrationTrial(trial: CalibrationTrial, actor?: string): Promise<void>;
  saveResearchReference(ref: ResearchReference, isNew: boolean, actor?: string): Promise<void>;
  deleteResearchReference(id: string, actor?: string): Promise<void>;
  saveProductionMetric(record: ProductionMetricRecord, isNew: boolean, actor?: string): Promise<void>;
  loadSampleDatasetNonDestructive(actor?: string): Promise<void>;
  removeSampleFixturesOnly(actor?: string): Promise<number>;
  restoreWorkspaceSnapshot(
    snapshot: ResearchWorkspaceSnapshot,
    mode: 'merge_preserve_user_data' | 'replace_all',
    actor?: string
  ): Promise<void>;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      Object.values(STORES).forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function putInStore<T>(db: IDBDatabase, storeName: string, record: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFromStore(db: IDBDatabase, storeName: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export class IndexedDBResearchRepository implements ResearchRepository {
  private async logAudit(
    db: IDBDatabase,
    entityType: AuditEntityType,
    entityId: string,
    action: AuditEvent['action'],
    summary: string,
    actor = 'Researcher'
  ): Promise<void> {
    const event: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      entityType,
      entityId,
      action,
      timestamp: new Date().toISOString(),
      summary,
      actor,
      source: 'Fabrication Research OS Local Client',
    };
    await putInStore(db, STORES.auditEvents, event);
  }

  async loadWorkspace(): Promise<ResearchWorkspaceSnapshot> {
    const db = await openDatabase();
    let projects = await getAllFromStore<Project>(db, STORES.projects);
    let project: Project;

    if (projects.length === 0) {
      project = createDefaultProject();
      await putInStore(db, STORES.projects, project);
      await this.logAudit(
        db,
        'Project',
        project.id,
        'CREATE',
        'Initialized empty MRAC 2026–2027 research workspace'
      );
    } else {
      project = projects[0];
    }

    const [
      materialProfiles,
      hardwareProfiles,
      experiments,
      processParameterSets,
      measurements,
      processObservations,
      calibrationSessions,
      calibrationTrials,
      researchReferences,
      productionMetrics,
      fileMetadata,
      auditEvents,
    ] = await Promise.all([
      getAllFromStore<MaterialProfile>(db, STORES.materialProfiles),
      getAllFromStore<HardwareProfile>(db, STORES.hardwareProfiles),
      getAllFromStore<Experiment>(db, STORES.experiments),
      getAllFromStore<ProcessParameterSet>(db, STORES.processParameterSets),
      getAllFromStore<Measurement>(db, STORES.measurements),
      getAllFromStore<ProcessObservation>(db, STORES.processObservations),
      getAllFromStore<CalibrationSession>(db, STORES.calibrationSessions),
      getAllFromStore<CalibrationTrial>(db, STORES.calibrationTrials),
      getAllFromStore<ResearchReference>(db, STORES.researchReferences),
      getAllFromStore<ProductionMetricRecord>(db, STORES.productionMetrics),
      getAllFromStore<FileDatasetMetadata>(db, STORES.fileMetadata),
      getAllFromStore<AuditEvent>(db, STORES.auditEvents),
    ]);

    db.close();

    return {
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      project,
      materialProfiles,
      hardwareProfiles,
      experiments: experiments.sort((a, b) =>
        b.experimentCode.localeCompare(a.experimentCode)
      ),
      processParameterSets,
      measurements: measurements.sort(
        (a, b) => (a.layerIndex ?? 0) - (b.layerIndex ?? 0)
      ),
      processObservations: processObservations.sort(
        (a, b) => a.elapsedTime - b.elapsedTime
      ),
      calibrationSessions,
      calibrationTrials: calibrationTrials.sort(
        (a, b) => a.trialNumber - b.trialNumber
      ),
      researchReferences: researchReferences.sort((a, b) => b.year - a.year),
      productionMetrics,
      fileMetadata,
      auditEvents: auditEvents.sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp)
      ),
    };
  }

  async saveProject(project: Project, actor = 'Researcher'): Promise<void> {
    const db = await openDatabase();
    const updated: Project = { ...project, updatedAt: new Date().toISOString() };
    await putInStore(db, STORES.projects, updated);
    await this.logAudit(
      db,
      'Project',
      project.id,
      'UPDATE',
      `Updated Project Settings (${project.name})`,
      actor
    );
    db.close();
  }

  async saveMaterialProfile(
    profile: MaterialProfile,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<void> {
    const db = await openDatabase();
    await putInStore(db, STORES.materialProfiles, profile);
    await this.logAudit(
      db,
      'MaterialProfile',
      profile.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Created' : 'Updated'} material profile ${profile.materialName} (${profile.batchIdentifier})`,
      actor
    );
    db.close();
  }

  async deleteMaterialProfile(
    id: string,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const db = await openDatabase();
    const experiments = await getAllFromStore<Experiment>(db, STORES.experiments);
    const dependent = experiments.filter((e) => e.materialProfileId === id);
    if (dependent.length > 0) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity guard: Material Profile is referenced by ${dependent.length} experiment(s) (${dependent.map((d) => d.experimentCode).join(', ')}).`,
      };
    }
    await deleteFromStore(db, STORES.materialProfiles, id);
    await this.logAudit(
      db,
      'MaterialProfile',
      id,
      'DELETE',
      `Deleted Material Profile ${id}`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async saveHardwareProfile(
    profile: HardwareProfile,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<void> {
    const db = await openDatabase();
    await putInStore(db, STORES.hardwareProfiles, profile);
    await this.logAudit(
      db,
      'HardwareProfile',
      profile.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Created' : 'Updated'} hardware profile ${profile.name} [${profile.readinessStatus}]`,
      actor
    );
    db.close();
  }

  async deleteHardwareProfile(
    id: string,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const db = await openDatabase();
    const experiments = await getAllFromStore<Experiment>(db, STORES.experiments);
    const dependent = experiments.filter((e) => e.hardwareProfileId === id);
    if (dependent.length > 0) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity guard: Hardware Profile is referenced by ${dependent.length} experiment(s) (${dependent.map((d) => d.experimentCode).join(', ')}).`,
      };
    }
    await deleteFromStore(db, STORES.hardwareProfiles, id);
    await this.logAudit(
      db,
      'HardwareProfile',
      id,
      'DELETE',
      `Deleted Hardware Profile ${id}`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async saveExperiment(
    experiment: Experiment,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<void> {
    const db = await openDatabase();
    await putInStore(db, STORES.experiments, experiment);
    await putInStore(db, STORES.processParameterSets, experiment.processParameters);
    await this.logAudit(
      db,
      'Experiment',
      experiment.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Created' : 'Updated'} experiment ${experiment.experimentCode}: ${experiment.title} [${experiment.status}]`,
      actor
    );
    db.close();
  }

  async deleteExperiment(id: string, actor = 'Researcher'): Promise<void> {
    const db = await openDatabase();
    const experiments = await getAllFromStore<Experiment>(db, STORES.experiments);
    const target = experiments.find((e) => e.id === id);
    await deleteFromStore(db, STORES.experiments, id);
    if (target) {
      await deleteFromStore(
        db,
        STORES.processParameterSets,
        target.processParameters.id
      );
    }
    await this.logAudit(
      db,
      'Experiment',
      id,
      'DELETE',
      `Deleted experiment ${target?.experimentCode || id}`,
      actor
    );
    db.close();
  }

  async saveMeasurement(
    measurement: Measurement,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<void> {
    const db = await openDatabase();
    await putInStore(db, STORES.measurements, measurement);
    await this.logAudit(
      db,
      'Measurement',
      measurement.id,
      isNew ? 'CREATE' : 'UPDATE',
      `Logged ${measurement.measurementType} = ${measurement.measuredValue} ${measurement.unit} (${measurement.sourceType}) for specimen ${measurement.specimenId}`,
      actor
    );
    db.close();
  }

  async saveMeasurementsBatch(
    measurements: Measurement[],
    fileMeta?: FileDatasetMetadata,
    actor = 'Researcher'
  ): Promise<void> {
    const db = await openDatabase();
    for (const m of measurements) {
      await putInStore(db, STORES.measurements, m);
    }
    if (fileMeta) {
      await putInStore(db, STORES.fileMetadata, fileMeta);
    }
    await this.logAudit(
      db,
      'Measurement',
      fileMeta?.id || 'batch-import',
      'IMPORT',
      `Imported ${measurements.length} physical measurement record(s)${fileMeta ? ` from ${fileMeta.filename}` : ''}`,
      actor
    );
    db.close();
  }

  async deleteMeasurement(id: string, actor = 'Researcher'): Promise<void> {
    const db = await openDatabase();
    await deleteFromStore(db, STORES.measurements, id);
    await this.logAudit(
      db,
      'Measurement',
      id,
      'DELETE',
      `Deleted measurement record ${id}`,
      actor
    );
    db.close();
  }

  async saveProcessObservation(
    obs: ProcessObservation,
    actor = 'Researcher'
  ): Promise<void> {
    const db = await openDatabase();
    await putInStore(db, STORES.processObservations, obs);
    await this.logAudit(
      db,
      'ProcessObservation',
      obs.id,
      'CREATE',
      `Logged process observation ${obs.observationType} = ${obs.numericValue} ${obs.unit} at Layer ${obs.layerIndex}`,
      actor
    );
    db.close();
  }

  async deleteProcessObservation(id: string, actor = 'Researcher'): Promise<void> {
    const db = await openDatabase();
    await deleteFromStore(db, STORES.processObservations, id);
    await this.logAudit(
      db,
      'ProcessObservation',
      id,
      'DELETE',
      `Deleted process observation ${id}`,
      actor
    );
    db.close();
  }

  async saveCalibrationSession(
    session: CalibrationSession,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<void> {
    const db = await openDatabase();
    await putInStore(db, STORES.calibrationSessions, session);
    await this.logAudit(
      db,
      'CalibrationSession',
      session.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Created' : 'Updated'} calibration session ${session.sessionCode}`,
      actor
    );
    db.close();
  }

  async saveCalibrationTrial(
    trial: CalibrationTrial,
    actor = 'Researcher'
  ): Promise<void> {
    const db = await openDatabase();
    await putInStore(db, STORES.calibrationTrials, trial);
    await this.logAudit(
      db,
      'CalibrationTrial',
      trial.id,
      'CREATE',
      `Logged calibration trial #${trial.trialNumber} (${trial.recordOrigin}) in session ${trial.calibrationSessionId}`,
      actor
    );
    db.close();
  }

  async saveResearchReference(
    ref: ResearchReference,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<void> {
    const db = await openDatabase();
    await putInStore(db, STORES.researchReferences, ref);
    await this.logAudit(
      db,
      'ResearchReference',
      ref.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Added' : 'Updated'} literature reference: ${ref.title}`,
      actor
    );
    db.close();
  }

  async deleteResearchReference(id: string, actor = 'Researcher'): Promise<void> {
    const db = await openDatabase();
    await deleteFromStore(db, STORES.researchReferences, id);
    await this.logAudit(
      db,
      'ResearchReference',
      id,
      'DELETE',
      `Deleted literature reference ${id}`,
      actor
    );
    db.close();
  }

  async saveProductionMetric(
    record: ProductionMetricRecord,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<void> {
    const db = await openDatabase();
    await putInStore(db, STORES.productionMetrics, record);
    await this.logAudit(
      db,
      'ProductionMetricRecord',
      record.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Logged' : 'Updated'} production efficiency record for experiment ${record.experimentId}`,
      actor
    );
    db.close();
  }

  /**
   * Loads the MRAC sample dataset without overwriting or deleting any user-created records.
   */
  async loadSampleDatasetNonDestructive(actor = 'Researcher'): Promise<void> {
    const db = await openDatabase();
    const projects = await getAllFromStore<Project>(db, STORES.projects);
    const projectId = projects[0]?.id || 'proj-mrac-2026-2027';
    const sample = createSampleDataset(projectId);

    for (const item of sample.materialProfiles) {
      await putInStore(db, STORES.materialProfiles, item);
    }
    for (const item of sample.hardwareProfiles) {
      await putInStore(db, STORES.hardwareProfiles, item);
    }
    for (const item of sample.processParameterSets) {
      await putInStore(db, STORES.processParameterSets, item);
    }
    for (const item of sample.experiments) {
      await putInStore(db, STORES.experiments, item);
    }
    for (const item of sample.measurements) {
      await putInStore(db, STORES.measurements, item);
    }
    for (const item of sample.processObservations) {
      await putInStore(db, STORES.processObservations, item);
    }
    for (const item of sample.calibrationSessions) {
      await putInStore(db, STORES.calibrationSessions, item);
    }
    for (const item of sample.calibrationTrials) {
      await putInStore(db, STORES.calibrationTrials, item);
    }
    for (const item of sample.researchReferences) {
      await putInStore(db, STORES.researchReferences, item);
    }
    for (const item of sample.productionMetrics) {
      await putInStore(db, STORES.productionMetrics, item);
    }
    for (const item of sample.fileMetadata) {
      await putInStore(db, STORES.fileMetadata, item);
    }

    await this.logAudit(
      db,
      'System',
      projectId,
      'SEED_SAMPLE',
      'Loaded non-destructive MRAC 2026–2027 sample dataset fixtures (flagged with isSampleFixture=true)',
      actor
    );
    db.close();
  }

  /**
   * Removes ONLY records flagged with `isSampleFixture === true`.
   * Never deletes actual research records created or imported by the user.
   */
  async removeSampleFixturesOnly(actor = 'Researcher'): Promise<number> {
    const db = await openDatabase();
    const targetStores = [
      STORES.materialProfiles,
      STORES.hardwareProfiles,
      STORES.experiments,
      STORES.processParameterSets,
      STORES.measurements,
      STORES.processObservations,
      STORES.calibrationSessions,
      STORES.calibrationTrials,
      STORES.researchReferences,
      STORES.productionMetrics,
      STORES.fileMetadata,
    ];

    let removedCount = 0;
    for (const storeName of targetStores) {
      const records = await getAllFromStore<{ id: string; isSampleFixture?: boolean }>(
        db,
        storeName
      );
      for (const rec of records) {
        if (rec.isSampleFixture === true) {
          await deleteFromStore(db, storeName, rec.id);
          removedCount++;
        }
      }
    }

    await this.logAudit(
      db,
      'System',
      'sample-cleanup',
      'REMOVE_SAMPLE',
      `Removed ${removedCount} sample fixture record(s) while preserving all user research data.`,
      actor
    );
    db.close();
    return removedCount;
  }

  async restoreWorkspaceSnapshot(
    snapshot: ResearchWorkspaceSnapshot,
    mode: 'merge_preserve_user_data' | 'replace_all',
    actor = 'Researcher'
  ): Promise<void> {
    const db = await openDatabase();

    if (mode === 'replace_all') {
      for (const storeName of Object.values(STORES)) {
        const all = await getAllFromStore<{ id: string }>(db, storeName);
        for (const item of all) {
          await deleteFromStore(db, storeName, item.id);
        }
      }
    }

    await putInStore(db, STORES.projects, snapshot.project);
    for (const item of snapshot.materialProfiles) {
      await putInStore(db, STORES.materialProfiles, item);
    }
    for (const item of snapshot.hardwareProfiles) {
      await putInStore(db, STORES.hardwareProfiles, item);
    }
    for (const item of snapshot.processParameterSets) {
      await putInStore(db, STORES.processParameterSets, item);
    }
    for (const item of snapshot.experiments) {
      await putInStore(db, STORES.experiments, item);
    }
    for (const item of snapshot.measurements) {
      await putInStore(db, STORES.measurements, item);
    }
    for (const item of snapshot.processObservations) {
      await putInStore(db, STORES.processObservations, item);
    }
    for (const item of snapshot.calibrationSessions) {
      await putInStore(db, STORES.calibrationSessions, item);
    }
    for (const item of snapshot.calibrationTrials) {
      await putInStore(db, STORES.calibrationTrials, item);
    }
    for (const item of snapshot.researchReferences) {
      await putInStore(db, STORES.researchReferences, item);
    }
    for (const item of snapshot.productionMetrics) {
      await putInStore(db, STORES.productionMetrics, item);
    }
    for (const item of snapshot.fileMetadata) {
      await putInStore(db, STORES.fileMetadata, item);
    }

    await this.logAudit(
      db,
      'System',
      snapshot.project.id,
      'RESTORE_BACKUP',
      `Restored workspace snapshot (${mode === 'merge_preserve_user_data' ? 'non-destructive merge' : 'full replacement'})`,
      actor
    );
    db.close();
  }
}

export type ActiveModuleId =
  | 'overview'
  | 'experiment-lab'
  | 'quality-inspector'
  | 'calibration-studio'
  | 'process-explorer'
  | 'research-library'
  | 'industry-metrics'
  | 'data-management'
  | 'project-settings'
  | 'system-status';

interface ResearchWorkspaceContextValue {
  snapshot: ResearchWorkspaceSnapshot | null;
  loading: boolean;
  error: string | null;
  activeModule: ActiveModuleId;
  setActiveModule: (mod: ActiveModuleId) => void;
  selectedExperimentId: string | null;
  setSelectedExperimentId: (id: string | null) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  storageHealth: StorageHealthInfo;
  toastMessage: string | null;
  notifyToast: (msg: string) => void;
  repository: ResearchRepository;
  refreshWorkspace: () => Promise<void>;
  navigateToExperimentInModule: (experimentId: string, module: ActiveModuleId) => void;
}

const ResearchWorkspaceContext = createContext<ResearchWorkspaceContextValue | null>(
  null
);

const repoInstance = new IndexedDBResearchRepository();

export const ResearchWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [snapshot, setSnapshot] = useState<ResearchWorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ActiveModuleId>('overview');
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<{
    usage: number | null;
    quota: number | null;
  }>({ usage: null, quota: null });

  const notifyToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    try {
      const data = await repoInstance.loadWorkspace();
      setSnapshot(data);
      setSelectedExperimentId((prev) => {
        if (prev && data.experiments.some((e) => e.id === prev)) {
          return prev;
        }
        return data.experiments[0]?.id || null;
      });
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        setStorageEstimate({
          usage: est.usage ?? null,
          quota: est.quota ?? null,
        });
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access IndexedDB storage');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  const navigateToExperimentInModule = useCallback(
    (experimentId: string, module: ActiveModuleId) => {
      setSelectedExperimentId(experimentId);
      setActiveModule(module);
    },
    []
  );

  const countRecords = () => {
    if (!snapshot) return { sample: 0, user: 0 };
    const allArrays = [
      snapshot.materialProfiles,
      snapshot.hardwareProfiles,
      snapshot.experiments,
      snapshot.processParameterSets,
      snapshot.measurements,
      snapshot.processObservations,
      snapshot.calibrationSessions,
      snapshot.calibrationTrials,
      snapshot.researchReferences,
      snapshot.productionMetrics,
      snapshot.fileMetadata,
    ];
    let sample = 0;
    let user = 0;
    for (const arr of allArrays) {
      for (const item of arr) {
        if (item.isSampleFixture) sample++;
        else user++;
      }
    }
    return { sample, user };
  };

  const counts = countRecords();

  const storageHealth: StorageHealthInfo = {
    adapterName: 'IndexedDB Local Repository (v1)',
    schemaVersion: SCHEMA_VERSION,
    isPersistentAvailable: typeof indexedDB !== 'undefined',
    estimatedUsageBytes: storageEstimate.usage,
    estimatedQuotaBytes: storageEstimate.quota,
    sampleRecordsCount: counts.sample,
    userResearchRecordsCount: counts.user,
  };

  return React.createElement(
    ResearchWorkspaceContext.Provider,
    {
      value: {
        snapshot,
        loading,
        error,
        activeModule,
        setActiveModule,
        selectedExperimentId,
        setSelectedExperimentId,
        globalSearchQuery,
        setGlobalSearchQuery,
        storageHealth,
        toastMessage,
        notifyToast,
        repository: repoInstance,
        refreshWorkspace,
        navigateToExperimentInModule,
      },
    },
    children
  );
};

export function useResearchWorkspace(): ResearchWorkspaceContextValue {
  const ctx = useContext(ResearchWorkspaceContext);
  if (!ctx) {
    throw new Error('useResearchWorkspace must be used inside ResearchWorkspaceProvider');
  }
  return ctx;
}
