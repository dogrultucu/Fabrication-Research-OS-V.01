import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  APP_VERSION,
  AssemblyVerification,
  AssemblyVerificationSchema,
  AuditEntityType,
  AuditEvent,
  CalibrationSession,
  CalibrationSessionSchema,
  CalibrationTrial,
  CalibrationTrialSchema,
  DomainEntityName,
  Experiment,
  ExperimentSchema,
  FileDatasetMetadata,
  FileDatasetMetadataSchema,
  HardwareProfile,
  HardwareProfileSchema,
  MaterialProfile,
  MaterialProfileSchema,
  Measurement,
  MeasurementSchema,
  NodeDesign,
  NodeDesignSchema,
  NodeFeatureDefinition,
  NodeFeatureDefinitionSchema,
  ProcessObservation,
  ProcessObservationSchema,
  ProcessParameterSet,
  ProductionMetricRecord,
  ProductionMetricRecordSchema,
  Project,
  ProjectSchema,
  ResearchReference,
  ResearchReferenceSchema,
  ResearchWorkspaceSnapshot,
  SCHEMA_VERSION,
  Specimen,
  SpecimenSchema,
} from '../domain/models';
import { createDefaultProject, createSampleDataset } from '../fixtures/sampleDataset';

export const DB_NAME = 'FabricationResearchOS_IDB';
export const DB_VERSION = 2;

export const STORES = {
  projects: 'projects',
  materialProfiles: 'materialProfiles',
  hardwareProfiles: 'hardwareProfiles',
  nodeDesigns: 'nodeDesigns',
  nodeFeatureDefinitions: 'nodeFeatureDefinitions',
  experiments: 'experiments',
  specimens: 'specimens',
  processParameterSets: 'processParameterSets',
  measurements: 'measurements',
  assemblyVerifications: 'assemblyVerifications',
  processObservations: 'processObservations',
  calibrationSessions: 'calibrationSessions',
  calibrationTrials: 'calibrationTrials',
  researchReferences: 'researchReferences',
  productionMetrics: 'productionMetrics',
  fileMetadata: 'fileMetadata',
  auditEvents: 'auditEvents',
} as const;

export const CANONICAL_ENTITY_TO_STORE: Record<DomainEntityName, keyof typeof STORES> = {
  Project: 'projects',
  MaterialProfile: 'materialProfiles',
  HardwareProfile: 'hardwareProfiles',
  NodeDesign: 'nodeDesigns',
  NodeFeatureDefinition: 'nodeFeatureDefinitions',
  Experiment: 'experiments',
  Specimen: 'specimens',
  ProcessParameterSet: 'processParameterSets',
  Measurement: 'measurements',
  AssemblyVerification: 'assemblyVerifications',
  ProcessObservation: 'processObservations',
  CalibrationSession: 'calibrationSessions',
  CalibrationTrial: 'calibrationTrials',
  ResearchReference: 'researchReferences',
  ProductionMetricRecord: 'productionMetrics',
  FileDatasetMetadata: 'fileMetadata',
  AuditEvent: 'auditEvents',
};

export interface StorageHealthInfo {
  adapterName: 'IndexedDB Local Repository (v2)';
  schemaVersion: number;
  isPersistentAvailable: boolean;
  estimatedUsageBytes: number | null;
  estimatedQuotaBytes: number | null;
  sampleRecordsCount: number;
  userResearchRecordsCount: number;
}

/**
 * Repository abstraction for all 17 canonical domain entities (Schema v2).
 * Allows IndexedDB to be swapped for SQLite or PostgreSQL in future phases without UI rewrites.
 */
export interface ResearchRepository {
  loadWorkspace(): Promise<ResearchWorkspaceSnapshot>;
  saveProject(project: Project, actor?: string): Promise<void>;
  saveMaterialProfile(profile: MaterialProfile, isNew: boolean, actor?: string): Promise<{ ok: boolean; error?: string }>;
  deleteMaterialProfile(id: string, actor?: string): Promise<{ ok: boolean; error?: string }>;
  saveHardwareProfile(profile: HardwareProfile, isNew: boolean, actor?: string): Promise<{ ok: boolean; error?: string }>;
  deleteHardwareProfile(id: string, actor?: string): Promise<{ ok: boolean; error?: string }>;
  saveNodeDesign(
    nodeDesign: NodeDesign,
    isNew: boolean,
    actor?: string
  ): Promise<{ ok: boolean; error?: string }>;
  deleteNodeDesign(id: string, actor?: string): Promise<{ ok: boolean; error?: string }>;
  saveNodeFeatureDefinition(
    feature: NodeFeatureDefinition,
    isNew: boolean,
    actor?: string
  ): Promise<{ ok: boolean; error?: string }>;
  deleteNodeFeatureDefinition(
    id: string,
    actor?: string
  ): Promise<{ ok: boolean; error?: string }>;
  saveExperiment(
    experiment: Experiment,
    isNew: boolean,
    actor?: string
  ): Promise<{ ok: boolean; error?: string }>;
  deleteExperiment(id: string, actor?: string): Promise<{ ok: boolean; error?: string }>;
  saveSpecimen(
    specimen: Specimen,
    isNew: boolean,
    actor?: string
  ): Promise<{ ok: boolean; error?: string }>;
  saveSpecimensBatch(
    specimens: Specimen[],
    actor?: string
  ): Promise<{ ok: boolean; error?: string }>;
  deleteSpecimen(id: string, actor?: string): Promise<{ ok: boolean; error?: string }>;
  saveMeasurement(measurement: Measurement, isNew: boolean, actor?: string): Promise<{ ok: boolean; error?: string }>;
  saveMeasurementsBatch(
    measurements: Measurement[],
    fileMeta?: FileDatasetMetadata,
    actor?: string
  ): Promise<{ ok: boolean; error?: string }>;
  deleteMeasurement(id: string, actor?: string): Promise<void>;
  saveAssemblyVerification(
    verification: AssemblyVerification,
    isNew: boolean,
    actor?: string
  ): Promise<{ ok: boolean; error?: string }>;
  deleteAssemblyVerification(id: string, actor?: string): Promise<void>;
  saveProcessObservation(obs: ProcessObservation, actor?: string): Promise<void>;
  deleteProcessObservation(id: string, actor?: string): Promise<void>;
  saveCalibrationSession(session: CalibrationSession, isNew: boolean, actor?: string): Promise<{ ok: boolean; error?: string }>;
  saveCalibrationTrial(trial: CalibrationTrial, actor?: string): Promise<{ ok: boolean; error?: string }>;
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
    const projects = await getAllFromStore<Project>(db, STORES.projects);
    let project: Project;

    if (projects.length === 0) {
      project = createDefaultProject();
      await putInStore(db, STORES.projects, project);
      await this.logAudit(
        db,
        'Project',
        project.id,
        'CREATE',
        'Initialized empty MRAC 2026–2027 research workspace (v0.1.1 Schema v2)'
      );
    } else {
      const rawProj = projects[0];
      const defaultProj = createDefaultProject();
      const wasV1 = (rawProj.schemaVersion ?? 1) < SCHEMA_VERSION;
      project = ProjectSchema.parse({
        ...rawProj,
        schemaVersion: SCHEMA_VERSION,
        workingResearchQuestion:
          rawProj.workingResearchQuestion || defaultProj.workingResearchQuestion,
        revisionHistory:
          rawProj.revisionHistory && rawProj.revisionHistory.length > 0
            ? rawProj.revisionHistory
            : defaultProj.revisionHistory,
      });
      if (wasV1) {
        await putInStore(db, STORES.projects, project);
        await this.logAudit(
          db,
          'System',
          project.id,
          'MIGRATE',
          'Non-destructively migrated workspace from Schema v1 (v0.1.0) to Schema v2 (v0.1.1 Ceramic Node Research Workflow)'
        );
      }
    }

    const [
      rawMaterialProfiles,
      rawHardwareProfiles,
      rawNodeDesigns,
      rawNodeFeatureDefinitions,
      rawExperiments,
      rawSpecimens,
      processParameterSets,
      rawMeasurements,
      rawAssemblyVerifications,
      rawProcessObservations,
      calibrationSessions,
      rawCalibrationTrials,
      rawResearchReferences,
      rawProductionMetrics,
      fileMetadata,
      auditEvents,
    ] = await Promise.all([
      getAllFromStore<MaterialProfile>(db, STORES.materialProfiles),
      getAllFromStore<HardwareProfile>(db, STORES.hardwareProfiles),
      getAllFromStore<NodeDesign>(db, STORES.nodeDesigns),
      getAllFromStore<NodeFeatureDefinition>(db, STORES.nodeFeatureDefinitions),
      getAllFromStore<Experiment>(db, STORES.experiments),
      getAllFromStore<Specimen>(db, STORES.specimens),
      getAllFromStore<ProcessParameterSet>(db, STORES.processParameterSets),
      getAllFromStore<Measurement>(db, STORES.measurements),
      getAllFromStore<AssemblyVerification>(db, STORES.assemblyVerifications),
      getAllFromStore<ProcessObservation>(db, STORES.processObservations),
      getAllFromStore<CalibrationSession>(db, STORES.calibrationSessions),
      getAllFromStore<CalibrationTrial>(db, STORES.calibrationTrials),
      getAllFromStore<ResearchReference>(db, STORES.researchReferences),
      getAllFromStore<ProductionMetricRecord>(db, STORES.productionMetrics),
      getAllFromStore<FileDatasetMetadata>(db, STORES.fileMetadata),
      getAllFromStore<AuditEvent>(db, STORES.auditEvents),
    ]);

    // Normalize legacy records non-destructively in memory (and guarantee legacy measurements without stage get 'Stage Unknown')
    const materialProfiles = rawMaterialProfiles.map((m) => MaterialProfileSchema.parse(m));
    const hardwareProfiles = rawHardwareProfiles.map((h) => HardwareProfileSchema.parse(h));
    const nodeDesigns = rawNodeDesigns.map((n: any) =>
      NodeDesignSchema.parse({
        ...n,
        nodeDesignCode: n.nodeDesignCode || n.designCode || n.nodeDesignId || 'UNSPECIFIED-NODE',
        title: n.title || n.designName || 'Untitled Node Design',
        coordinateSystem: n.coordinateSystem || 'wobjPrintTable_01',
        unitSystem: n.unitSystem || 'mm / deg',
      })
    );
    const nodeFeatureDefinitions = rawNodeFeatureDefinitions.map((f: any) =>
      NodeFeatureDefinitionSchema.parse({
        ...f,
        featureCode: f.featureCode || f.featureId || 'UNSPECIFIED-FEAT',
        coordinateFrame: f.coordinateFrame || 'wobjPrintTable_01',
        assemblyCritical: f.assemblyCritical ?? f.criticalForAssembly ?? true,
        measurementMethod: f.measurementMethod || 'Digital caliper',
      })
    );
    const experiments = rawExperiments.map((e: any) =>
      ExperimentSchema.parse({
        ...e,
        researchWorkflowType: e.researchWorkflowType || 'General Extrusion Research',
      })
    );
    const specimens = rawSpecimens.map((s: any) => {
      const legacyAcceptance = s.acceptanceStatus || s.specimenStatus || 'Not Tested';
      const inferredLifecycle =
        s.status ||
        (legacyAcceptance === 'Assembly Accepted'
          ? 'Assembled'
          : legacyAcceptance === 'Geometrically Rejected' || legacyAcceptance === 'Assembly Rejected'
          ? 'Rejected'
          : s.currentPhysicalStage === 'FIRED'
          ? 'Fired'
          : s.currentPhysicalStage === 'DRY'
          ? 'Dried'
          : 'Inspected');
      return SpecimenSchema.parse({
        ...s,
        status: inferredLifecycle,
        acceptanceStatus: legacyAcceptance,
        specimenStatus: s.specimenStatus || legacyAcceptance,
        materialProfileId: s.materialProfileId || 'unknown-material',
        materialBatchIdentifier: s.materialBatchIdentifier || 'UNKNOWN-BATCH',
        hardwareProfileId: s.hardwareProfileId || 'unknown-hardware',
        fabricationRunIdentifier: s.fabricationRunIdentifier || 'UNKNOWN-RUN',
        fabricationTimestamp: s.fabricationTimestamp || s.createdAt || new Date().toISOString(),
        processParameterSetId: s.processParameterSetId || 'unknown-pps',
        requiresAssemblyVerification: s.requiresAssemblyVerification ?? false,
      });
    });
    const measurements = rawMeasurements.map((m) =>
      MeasurementSchema.parse({
        ...m,
        physicalStage: m.physicalStage || 'Stage Unknown',
      })
    );
    const assemblyVerifications = rawAssemblyVerifications.map((a: any) => {
      const fitFromLegacy =
        a.fitClassification ||
        (a.physicalFitResult === 'Pass'
          ? 'Clearance Fit'
          : a.physicalFitResult === 'Fail'
          ? 'Interference / No-Go'
          : 'Not Tested');
      const passFailFromLegacy =
        a.passFailStatus ||
        (a.physicalFitResult === 'Pass'
          ? 'PASS'
          : a.physicalFitResult === 'Fail'
          ? 'FAIL'
          : a.physicalFitResult === 'Conditional'
          ? 'CONDITIONAL'
          : 'NOT_TESTED');
      const verResFromLegacy =
        a.verificationResult ||
        (passFailFromLegacy === 'PASS'
          ? 'PASS'
          : passFailFromLegacy === 'FAIL'
          ? 'FAIL'
          : passFailFromLegacy === 'CONDITIONAL'
          ? 'CONDITIONAL_PASS'
          : 'NOT_TESTED');
      return AssemblyVerificationSchema.parse({
        ...a,
        specimenRecordId: a.specimenRecordId || a.specimenId,
        fitClassification: fitFromLegacy,
        passFailStatus: passFailFromLegacy,
        verificationResult: verResFromLegacy,
        reworkRequired: a.reworkRequired ?? false,
      });
    });
    const processObservations = rawProcessObservations.map((o) =>
      ProcessObservationSchema.parse(o)
    );
    const calibrationTrials = rawCalibrationTrials.map((t) =>
      CalibrationTrialSchema.parse(t)
    );
    const researchReferences = rawResearchReferences.map((r) =>
      ResearchReferenceSchema.parse(r)
    );
    const productionMetrics = rawProductionMetrics.map((p) =>
      ProductionMetricRecordSchema.parse(p)
    );

    db.close();

    return {
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      project,
      materialProfiles,
      hardwareProfiles,
      nodeDesigns,
      nodeFeatureDefinitions,
      experiments: experiments.sort((a, b) =>
        b.experimentCode.localeCompare(a.experimentCode)
      ),
      specimens: specimens.sort((a, b) => a.specimenCode.localeCompare(b.specimenCode)),
      processParameterSets,
      measurements: measurements.sort(
        (a, b) => (a.layerIndex ?? 0) - (b.layerIndex ?? 0)
      ),
      assemblyVerifications: assemblyVerifications.sort((a, b) =>
        (b.verifiedAt || '').localeCompare(a.verifiedAt || '')
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
        (b.timestamp || '').localeCompare(a.timestamp || '')
      ),
    };
  }

  async saveProject(project: Project, actor = 'Researcher'): Promise<void> {
    const validated = ProjectSchema.parse({
      ...project,
      updatedAt: new Date().toISOString(),
    });
    const db = await openDatabase();
    await putInStore(db, STORES.projects, validated);
    await this.logAudit(
      db,
      'Project',
      validated.id,
      'UPDATE',
      `Updated Project Settings (${validated.name})`,
      actor
    );
    db.close();
  }

  async saveMaterialProfile(
    profile: MaterialProfile,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const candidate: MaterialProfile = isNew
      ? profile
      : { ...profile, isSampleFixture: false };
    const parsed = MaterialProfileSchema.safeParse(candidate);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    }
    const recordToSave = parsed.data;
    const db = await openDatabase();
    await putInStore(db, STORES.materialProfiles, recordToSave);
    await this.logAudit(
      db,
      'MaterialProfile',
      recordToSave.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Created' : 'Updated'} material profile ${recordToSave.materialName} (${recordToSave.batchIdentifier})`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async deleteMaterialProfile(
    id: string,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const db = await openDatabase();
    const [experiments, sessions] = await Promise.all([
      getAllFromStore<Experiment>(db, STORES.experiments),
      getAllFromStore<CalibrationSession>(db, STORES.calibrationSessions),
    ]);
    const dependentExps = experiments.filter((e) => e.materialProfileId === id);
    const dependentSess = sessions.filter((s) => s.materialProfileId === id);
    if (dependentExps.length > 0 || dependentSess.length > 0) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity guard: Material Profile is referenced by ${dependentExps.length} experiment(s) and ${dependentSess.length} calibration session(s).`,
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
  ): Promise<{ ok: boolean; error?: string }> {
    const candidate: HardwareProfile = isNew
      ? profile
      : { ...profile, isSampleFixture: false };
    const parsed = HardwareProfileSchema.safeParse(candidate);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    }
    const recordToSave = parsed.data;
    const db = await openDatabase();
    await putInStore(db, STORES.hardwareProfiles, recordToSave);
    await this.logAudit(
      db,
      'HardwareProfile',
      recordToSave.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Created' : 'Updated'} hardware profile ${recordToSave.name} [${recordToSave.readinessStatus}]`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async deleteHardwareProfile(
    id: string,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const db = await openDatabase();
    const [experiments, specimens] = await Promise.all([
      getAllFromStore<Experiment>(db, STORES.experiments),
      getAllFromStore<Specimen>(db, STORES.specimens),
    ]);
    const dependent = experiments.filter((e) => e.hardwareProfileId === id);
    const depSpecs = specimens.filter((s) => s.hardwareProfileId === id);
    if (dependent.length > 0 || depSpecs.length > 0) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity guard: Hardware Profile is referenced by ${dependent.length} experiment(s) and ${depSpecs.length} specimen(s).`,
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

  async saveNodeDesign(
    nodeDesign: NodeDesign,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const parsed = NodeDesignSchema.safeParse(
      isNew ? nodeDesign : { ...nodeDesign, isSampleFixture: false }
    );
    if (!parsed.success) {
      return {
        ok: false,
        error: `NodeDesign validation failed: ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      };
    }
    const db = await openDatabase();
    const existing = await getAllFromStore<NodeDesign>(db, STORES.nodeDesigns);
    const dup = existing.find(
      (n) =>
        n.id !== parsed.data.id &&
        n.nodeDesignCode.trim().toLowerCase() ===
          parsed.data.nodeDesignCode.trim().toLowerCase() &&
        n.geometryVersion.trim().toLowerCase() ===
          parsed.data.geometryVersion.trim().toLowerCase()
    );
    if (dup) {
      db.close();
      return {
        ok: false,
        error: `Node Design "${parsed.data.nodeDesignCode}" with geometry version "${parsed.data.geometryVersion}" already exists.`,
      };
    }
    await putInStore(db, STORES.nodeDesigns, parsed.data);
    await this.logAudit(
      db,
      'NodeDesign',
      parsed.data.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Created' : 'Updated'} node design ${parsed.data.nodeDesignCode}-${parsed.data.geometryVersion} (${parsed.data.title})`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async deleteNodeDesign(
    id: string,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const db = await openDatabase();
    const [experiments, specimens, features] = await Promise.all([
      getAllFromStore<Experiment>(db, STORES.experiments),
      getAllFromStore<Specimen>(db, STORES.specimens),
      getAllFromStore<NodeFeatureDefinition>(db, STORES.nodeFeatureDefinitions),
    ]);
    const depExp = experiments.filter((e) => e.nodeDesignId === id);
    const depSpec = specimens.filter((s) => s.nodeDesignId === id);
    if (depExp.length > 0 || depSpec.length > 0) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity guard: NodeDesign is referenced by ${depExp.length} experiment(s) and ${depSpec.length} specimen(s).`,
      };
    }
    for (const f of features.filter((x) => x.nodeDesignId === id)) {
      await deleteFromStore(db, STORES.nodeFeatureDefinitions, f.id);
    }
    await deleteFromStore(db, STORES.nodeDesigns, id);
    await this.logAudit(
      db,
      'NodeDesign',
      id,
      'DELETE',
      `Deleted NodeDesign ${id} and its associated feature definitions`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async saveNodeFeatureDefinition(
    feature: NodeFeatureDefinition,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const parsed = NodeFeatureDefinitionSchema.safeParse(
      isNew ? feature : { ...feature, isSampleFixture: false }
    );
    if (!parsed.success) {
      return {
        ok: false,
        error: `NodeFeatureDefinition validation failed: ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      };
    }
    const db = await openDatabase();
    const nodeDesigns = await getAllFromStore<NodeDesign>(db, STORES.nodeDesigns);
    if (!nodeDesigns.some((n) => n.id === parsed.data.nodeDesignId)) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity error: Parent NodeDesign "${parsed.data.nodeDesignId}" does not exist.`,
      };
    }
    await putInStore(db, STORES.nodeFeatureDefinitions, parsed.data);
    await this.logAudit(
      db,
      'NodeFeatureDefinition',
      parsed.data.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Created' : 'Updated'} node feature ${parsed.data.featureCode} (${parsed.data.featureName})`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async deleteNodeFeatureDefinition(
    id: string,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const db = await openDatabase();
    const measurements = await getAllFromStore<Measurement>(db, STORES.measurements);
    const depMeas = measurements.filter((m) => m.featureId === id);
    if (depMeas.length > 0) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity guard: Feature is referenced by ${depMeas.length} measurement record(s).`,
      };
    }
    await deleteFromStore(db, STORES.nodeFeatureDefinitions, id);
    await this.logAudit(
      db,
      'NodeFeatureDefinition',
      id,
      'DELETE',
      `Deleted NodeFeatureDefinition ${id}`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async saveExperiment(
    experiment: Experiment,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const parsed = ExperimentSchema.safeParse(experiment);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Schema validation failed: ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      };
    }

    const db = await openDatabase();
    const [existingExperiments, materials, hardwares, nodeDesigns] = await Promise.all([
      getAllFromStore<Experiment>(db, STORES.experiments),
      getAllFromStore<MaterialProfile>(db, STORES.materialProfiles),
      getAllFromStore<HardwareProfile>(db, STORES.hardwareProfiles),
      getAllFromStore<NodeDesign>(db, STORES.nodeDesigns),
    ]);

    const duplicateCode = existingExperiments.find(
      (e) =>
        e.id !== experiment.id &&
        e.experimentCode.trim().toLowerCase() ===
          experiment.experimentCode.trim().toLowerCase()
    );
    if (duplicateCode) {
      db.close();
      return {
        ok: false,
        error: `Duplicate experiment code "${experiment.experimentCode}" already exists on experiment "${duplicateCode.title}".`,
      };
    }

    if (!materials.some((m) => m.id === experiment.materialProfileId)) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity error: Material Profile "${experiment.materialProfileId}" does not exist.`,
      };
    }

    if (!hardwares.some((h) => h.id === experiment.hardwareProfileId)) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity error: Hardware Profile "${experiment.hardwareProfileId}" does not exist.`,
      };
    }

    if (
      experiment.nodeDesignId &&
      !nodeDesigns.some((nd) => nd.id === experiment.nodeDesignId)
    ) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity error: Node Design "${experiment.nodeDesignId}" does not exist.`,
      };
    }

    if (
      experiment.referenceBaselineExperimentId &&
      experiment.referenceBaselineExperimentId !== experiment.id &&
      !existingExperiments.some((e) => e.id === experiment.referenceBaselineExperimentId)
    ) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity error: Reference Baseline Experiment "${experiment.referenceBaselineExperimentId}" does not exist.`,
      };
    }

    const recordToSave: Experiment = isNew
      ? parsed.data
      : {
          ...parsed.data,
          isSampleFixture: false,
          processParameters: {
            ...parsed.data.processParameters,
            isSampleFixture: false,
          },
        };

    await putInStore(db, STORES.experiments, recordToSave);
    await putInStore(db, STORES.processParameterSets, recordToSave.processParameters);
    await this.logAudit(
      db,
      'Experiment',
      recordToSave.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Created' : 'Updated'} experiment ${recordToSave.experimentCode}: ${recordToSave.title} [${recordToSave.status}]`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async deleteExperiment(
    id: string,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const db = await openDatabase();
    const [
      experiments,
      specimens,
      sessions,
      trials,
      measurements,
      assemblyVerifications,
      observations,
      prodMetrics,
      references,
      files,
    ] = await Promise.all([
      getAllFromStore<Experiment>(db, STORES.experiments),
      getAllFromStore<Specimen>(db, STORES.specimens),
      getAllFromStore<CalibrationSession>(db, STORES.calibrationSessions),
      getAllFromStore<CalibrationTrial>(db, STORES.calibrationTrials),
      getAllFromStore<Measurement>(db, STORES.measurements),
      getAllFromStore<AssemblyVerification>(db, STORES.assemblyVerifications),
      getAllFromStore<ProcessObservation>(db, STORES.processObservations),
      getAllFromStore<ProductionMetricRecord>(db, STORES.productionMetrics),
      getAllFromStore<ResearchReference>(db, STORES.researchReferences),
      getAllFromStore<FileDatasetMetadata>(db, STORES.fileMetadata),
    ]);

    const target = experiments.find((e) => e.id === id);
    const dependentExps = experiments.filter(
      (e) => e.id !== id && e.referenceBaselineExperimentId === id
    );
    if (dependentExps.length > 0) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity guard: Experiment is referenced as baseline by ${dependentExps.map((e) => e.experimentCode).join(', ')}.`,
      };
    }

    const dependentSess = sessions.filter((s) => s.referenceExperimentId === id);
    if (dependentSess.length > 0) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity guard: Experiment is referenced by Calibration Session ${dependentSess.map((s) => s.sessionCode).join(', ')}.`,
      };
    }

    const dependentTrials = trials.filter((t) => t.experimentId === id);
    if (dependentTrials.length > 0) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity guard: Experiment is referenced by ${dependentTrials.length} Calibration Trial(s).`,
      };
    }

    await deleteFromStore(db, STORES.experiments, id);
    if (target) {
      await deleteFromStore(
        db,
        STORES.processParameterSets,
        target.processParameters.id
      );
    }

    for (const s of specimens.filter((x) => x.experimentId === id)) {
      await deleteFromStore(db, STORES.specimens, s.id);
    }
    for (const m of measurements.filter((x) => x.experimentId === id)) {
      await deleteFromStore(db, STORES.measurements, m.id);
    }
    for (const a of assemblyVerifications.filter((x) => x.experimentId === id)) {
      await deleteFromStore(db, STORES.assemblyVerifications, a.id);
    }
    for (const o of observations.filter((x) => x.experimentId === id)) {
      await deleteFromStore(db, STORES.processObservations, o.id);
    }
    for (const p of prodMetrics.filter((x) => x.experimentId === id)) {
      await deleteFromStore(db, STORES.productionMetrics, p.id);
    }
    for (const f of files.filter((x) => x.experimentId === id)) {
      await deleteFromStore(db, STORES.fileMetadata, f.id);
    }
    for (const ref of references) {
      if (ref.relatedExperimentIds.includes(id)) {
        await putInStore(db, STORES.researchReferences, {
          ...ref,
          relatedExperimentIds: ref.relatedExperimentIds.filter((eid) => eid !== id),
        });
      }
    }

    await this.logAudit(
      db,
      'Experiment',
      id,
      'DELETE',
      `Deleted experiment ${target?.experimentCode || id} and cleaned up child records`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async saveSpecimen(
    specimen: Specimen,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const parsed = SpecimenSchema.safeParse(
      isNew ? specimen : { ...specimen, isSampleFixture: false }
    );
    if (!parsed.success) {
      return {
        ok: false,
        error: `Specimen validation failed: ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      };
    }

    const db = await openDatabase();
    const [existingSpecimens, experiments, verifications] = await Promise.all([
      getAllFromStore<Specimen>(db, STORES.specimens),
      getAllFromStore<Experiment>(db, STORES.experiments),
      getAllFromStore<AssemblyVerification>(db, STORES.assemblyVerifications),
    ]);

    if (!experiments.some((e) => e.id === parsed.data.experimentId)) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity error: Parent Experiment "${parsed.data.experimentId}" does not exist.`,
      };
    }

    const dupCode = existingSpecimens.find(
      (s) =>
        s.id !== parsed.data.id &&
        s.specimenCode.trim().toLowerCase() ===
          parsed.data.specimenCode.trim().toLowerCase()
    );
    if (dupCode) {
      db.close();
      return {
        ok: false,
        error: `Duplicate specimen code "${parsed.data.specimenCode}" already exists.`,
      };
    }

    // Scientific guard: Specimen cannot be marked 'Assembly Accepted' without a PASS physical AssemblyVerification record
    if (
      parsed.data.acceptanceStatus === 'Assembly Accepted' ||
      parsed.data.specimenStatus === 'Assembly Accepted'
    ) {
      const hasPassingAssemblyTest = verifications.some(
        (v) =>
          (v.specimenRecordId === parsed.data.id ||
            v.specimenId === parsed.data.id ||
            v.specimenId === parsed.data.specimenCode) &&
          v.passFailStatus !== 'NOT_TESTED' &&
          v.verificationResult !== 'NOT_TESTED' &&
          (v.passFailStatus === 'PASS' || v.verificationResult === 'PASS')
      );
      if (!hasPassingAssemblyTest) {
        db.close();
        return {
          ok: false,
          error: `Scientific Guard: Specimen "${parsed.data.specimenCode}" cannot be marked "Assembly Accepted" without a recorded PASS physical AssemblyVerification record.`,
        };
      }
    }

    await putInStore(db, STORES.specimens, parsed.data);
    await this.logAudit(
      db,
      'Specimen',
      parsed.data.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Registered' : 'Updated'} specimen ${parsed.data.specimenCode} [${parsed.data.currentPhysicalStage} · ${parsed.data.acceptanceStatus}]`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async saveSpecimensBatch(
    specimens: Specimen[],
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const db = await openDatabase();
    const existing = await getAllFromStore<Specimen>(db, STORES.specimens);
    const seenCodes = new Set(
      existing.map((s) => s.specimenCode.trim().toLowerCase())
    );

    const validatedBatch: Specimen[] = [];
    for (const s of specimens) {
      const parsed = SpecimenSchema.safeParse(s);
      if (!parsed.success) {
        db.close();
        return {
          ok: false,
          error: `Batch specimen validation failed for "${s.specimenCode}": ${parsed.error.issues
            .map((i) => i.message)
            .join('; ')}`,
        };
      }
      const norm = parsed.data.specimenCode.trim().toLowerCase();
      if (seenCodes.has(norm)) {
        db.close();
        return {
          ok: false,
          error: `Duplicate specimen code "${parsed.data.specimenCode}" in batch or existing registry.`,
        };
      }
      seenCodes.add(norm);
      validatedBatch.push(parsed.data);
    }

    for (const item of validatedBatch) {
      await putInStore(db, STORES.specimens, item);
    }
    await this.logAudit(
      db,
      'Specimen',
      validatedBatch[0]?.experimentId || 'batch-specimens',
      'CREATE',
      `Generated ${validatedBatch.length} planned specimen record(s)`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async deleteSpecimen(
    id: string,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const db = await openDatabase();
    const [measurements, verifications] = await Promise.all([
      getAllFromStore<Measurement>(db, STORES.measurements),
      getAllFromStore<AssemblyVerification>(db, STORES.assemblyVerifications),
    ]);
    const depMeas = measurements.filter((m) => m.specimenRecordId === id);
    const depVer = verifications.filter(
      (v) => v.specimenRecordId === id || v.specimenId === id
    );
    if (depMeas.length > 0 || depVer.length > 0) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity guard: Specimen is referenced by ${depMeas.length} measurement(s) and ${depVer.length} assembly verification(s).`,
      };
    }
    await deleteFromStore(db, STORES.specimens, id);
    await this.logAudit(
      db,
      'Specimen',
      id,
      'DELETE',
      `Deleted Specimen ${id}`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async saveMeasurement(
    measurement: Measurement,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const enforcedCandidate: Measurement = {
      ...measurement,
      physicalStage: measurement.physicalStage || 'Stage Unknown',
      verifiedPhysicalMeasurement:
        measurement.sourceType === 'AI-Assisted Annotation' ||
        measurement.sourceType === 'Computed'
          ? false
          : measurement.verifiedPhysicalMeasurement,
      isSampleFixture: isNew ? measurement.isSampleFixture : false,
    };
    const parsed = MeasurementSchema.safeParse(enforcedCandidate);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    }
    const enforced = parsed.data;
    const db = await openDatabase();
    await putInStore(db, STORES.measurements, enforced);
    await this.logAudit(
      db,
      'Measurement',
      enforced.id,
      isNew ? 'CREATE' : 'UPDATE',
      `Logged ${enforced.measurementType} = ${enforced.measuredValue} ${enforced.unit} [${enforced.physicalStage}] (${enforced.sourceType}) for specimen ${enforced.specimenId}`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async saveMeasurementsBatch(
    measurements: Measurement[],
    fileMeta?: FileDatasetMetadata,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const db = await openDatabase();
    for (const m of measurements) {
      const enforcedCandidate: Measurement = {
        ...m,
        physicalStage: m.physicalStage || 'Stage Unknown',
        verifiedPhysicalMeasurement:
          m.sourceType === 'AI-Assisted Annotation' || m.sourceType === 'Computed'
            ? false
            : m.verifiedPhysicalMeasurement,
      };
      const parsed = MeasurementSchema.safeParse(enforcedCandidate);
      if (!parsed.success) {
        db.close();
        return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
      }
      await putInStore(db, STORES.measurements, parsed.data);
    }
    if (fileMeta) {
      const validMeta = FileDatasetMetadataSchema.parse(fileMeta);
      await putInStore(db, STORES.fileMetadata, validMeta);
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
    return { ok: true };
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

  async saveAssemblyVerification(
    verification: AssemblyVerification,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const parsed = AssemblyVerificationSchema.safeParse(
      isNew ? verification : { ...verification, isSampleFixture: false }
    );
    if (!parsed.success) {
      return {
        ok: false,
        error: `AssemblyVerification validation failed: ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      };
    }
    const db = await openDatabase();
    const [specimens, experiments] = await Promise.all([
      getAllFromStore<Specimen>(db, STORES.specimens),
      getAllFromStore<Experiment>(db, STORES.experiments),
    ]);
    const spec = specimens.find(
      (s) =>
        s.id === parsed.data.specimenRecordId ||
        s.id === parsed.data.specimenId ||
        s.specimenCode === parsed.data.specimenId
    );
    if (!spec) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity error: Specimen "${parsed.data.specimenId}" does not exist.`,
      };
    }
    if (!experiments.some((e) => e.id === parsed.data.experimentId)) {
      db.close();
      return {
        ok: false,
        error: `Referential integrity error: Experiment "${parsed.data.experimentId}" does not exist.`,
      };
    }

    await putInStore(db, STORES.assemblyVerifications, parsed.data);

    // Synchronize specimen status if physical assembly test passed or failed
    if (
      parsed.data.passFailStatus === 'PASS' ||
      parsed.data.verificationResult === 'PASS'
    ) {
      await putInStore(db, STORES.specimens, {
        ...spec,
        status: 'Assembled',
        acceptanceStatus: 'Assembly Accepted',
        specimenStatus: 'Assembly Accepted',
        isSampleFixture: false,
      });
    } else if (
      parsed.data.passFailStatus === 'FAIL' ||
      parsed.data.verificationResult === 'FAIL'
    ) {
      await putInStore(db, STORES.specimens, {
        ...spec,
        status: 'Rejected',
        acceptanceStatus: 'Assembly Rejected',
        specimenStatus: 'Assembly Rejected',
        isSampleFixture: false,
      });
    }

    await this.logAudit(
      db,
      'AssemblyVerification',
      parsed.data.id,
      isNew ? 'CREATE' : 'UPDATE',
      `Recorded physical assembly verification for specimen ${spec.specimenCode}: ${parsed.data.fitClassification} (${parsed.data.passFailStatus})`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async deleteAssemblyVerification(id: string, actor = 'Researcher'): Promise<void> {
    const db = await openDatabase();
    await deleteFromStore(db, STORES.assemblyVerifications, id);
    await this.logAudit(
      db,
      'AssemblyVerification',
      id,
      'DELETE',
      `Deleted assembly verification record ${id}`,
      actor
    );
    db.close();
  }

  async saveProcessObservation(
    obs: ProcessObservation,
    actor = 'Researcher'
  ): Promise<void> {
    const validated = ProcessObservationSchema.parse(obs);
    const db = await openDatabase();
    const existing = await getAllFromStore<ProcessObservation>(
      db,
      STORES.processObservations
    );
    const isUpdate = existing.some((x) => x.id === validated.id);
    const recordToSave: ProcessObservation = isUpdate
      ? { ...validated, isSampleFixture: false }
      : validated;
    await putInStore(db, STORES.processObservations, recordToSave);
    await this.logAudit(
      db,
      'ProcessObservation',
      recordToSave.id,
      isUpdate ? 'UPDATE' : 'CREATE',
      `${isUpdate ? 'Updated' : 'Logged'} process observation ${recordToSave.observationType} = ${recordToSave.numericValue} ${recordToSave.unit} at Layer ${recordToSave.layerIndex}`,
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
  ): Promise<{ ok: boolean; error?: string }> {
    const candidate: CalibrationSession = isNew
      ? session
      : { ...session, isSampleFixture: false };
    const parsed = CalibrationSessionSchema.safeParse(candidate);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    }
    const validated = parsed.data;
    const db = await openDatabase();
    await putInStore(db, STORES.calibrationSessions, validated);
    await this.logAudit(
      db,
      'CalibrationSession',
      validated.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Created' : 'Updated'} calibration session ${validated.sessionCode}`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async saveCalibrationTrial(
    trial: CalibrationTrial,
    actor = 'Researcher'
  ): Promise<{ ok: boolean; error?: string }> {
    const parsed = CalibrationTrialSchema.safeParse(trial);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    }
    const validated = parsed.data;
    const db = await openDatabase();
    await putInStore(db, STORES.calibrationTrials, validated);
    await this.logAudit(
      db,
      'CalibrationTrial',
      validated.id,
      'CREATE',
      `Logged calibration trial #${validated.trialNumber} (${validated.recordOrigin}) in session ${validated.calibrationSessionId}`,
      actor
    );
    db.close();
    return { ok: true };
  }

  async saveResearchReference(
    ref: ResearchReference,
    isNew: boolean,
    actor = 'Researcher'
  ): Promise<void> {
    const candidate: ResearchReference = isNew
      ? ref
      : { ...ref, isSampleFixture: false };
    const validated = ResearchReferenceSchema.parse(candidate);
    const db = await openDatabase();
    await putInStore(db, STORES.researchReferences, validated);
    await this.logAudit(
      db,
      'ResearchReference',
      validated.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Added' : 'Updated'} literature reference: ${validated.title}`,
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
    const candidate: ProductionMetricRecord = isNew
      ? record
      : { ...record, isSampleFixture: false };
    const validated = ProductionMetricRecordSchema.parse(candidate);
    const db = await openDatabase();
    await putInStore(db, STORES.productionMetrics, validated);
    await this.logAudit(
      db,
      'ProductionMetricRecord',
      validated.id,
      isNew ? 'CREATE' : 'UPDATE',
      `${isNew ? 'Logged' : 'Updated'} production efficiency record for experiment ${validated.experimentId}`,
      actor
    );
    db.close();
  }

  /**
   * Loads the MRAC sample dataset without overwriting or deleting any user-created or user-modified records,
   * and automatically disambiguates any sample experimentCode that would collide with an existing user experimentCode.
   */
  async loadSampleDatasetNonDestructive(actor = 'Researcher'): Promise<void> {
    const db = await openDatabase();
    const projects = await getAllFromStore<Project>(db, STORES.projects);
    const projectId = projects[0]?.id || 'proj-mrac-2026-2027';
    const sample = createSampleDataset(projectId);

    const existingExps = await getAllFromStore<Experiment>(db, STORES.experiments);
    const userExpCodes = new Set(
      existingExps
        .filter((e) => e.isSampleFixture === false)
        .map((e) => e.experimentCode.trim().toLowerCase())
    );

    const disambiguatedSampleExps = sample.experiments.map((exp) => {
      if (
        userExpCodes.has(exp.experimentCode.trim().toLowerCase()) &&
        !existingExps.some((e) => e.id === exp.id && e.isSampleFixture === false)
      ) {
        return {
          ...exp,
          experimentCode: `${exp.experimentCode}-SMP`,
        };
      }
      return exp;
    });

    const putSampleIfNotUserModified = async <
      T extends { id: string; isSampleFixture?: boolean }
    >(
      storeName: string,
      items: T[]
    ) => {
      const existing = await getAllFromStore<T>(db, storeName);
      const userModifiedIds = new Set(
        existing.filter((x) => x.isSampleFixture === false).map((x) => x.id)
      );
      for (const item of items) {
        if (!userModifiedIds.has(item.id)) {
          await putInStore(db, storeName, item);
        }
      }
    };

    await putSampleIfNotUserModified(STORES.materialProfiles, sample.materialProfiles);
    await putSampleIfNotUserModified(STORES.hardwareProfiles, sample.hardwareProfiles);
    await putSampleIfNotUserModified(STORES.nodeDesigns, sample.nodeDesigns);
    await putSampleIfNotUserModified(
      STORES.nodeFeatureDefinitions,
      sample.nodeFeatureDefinitions
    );
    await putSampleIfNotUserModified(
      STORES.processParameterSets,
      sample.processParameterSets
    );
    await putSampleIfNotUserModified(STORES.experiments, disambiguatedSampleExps);
    await putSampleIfNotUserModified(STORES.specimens, sample.specimens);
    await putSampleIfNotUserModified(STORES.measurements, sample.measurements);
    await putSampleIfNotUserModified(
      STORES.assemblyVerifications,
      sample.assemblyVerifications
    );
    await putSampleIfNotUserModified(
      STORES.processObservations,
      sample.processObservations
    );
    await putSampleIfNotUserModified(
      STORES.calibrationSessions,
      sample.calibrationSessions
    );
    await putSampleIfNotUserModified(
      STORES.calibrationTrials,
      sample.calibrationTrials
    );
    await putSampleIfNotUserModified(
      STORES.researchReferences,
      sample.researchReferences
    );
    await putSampleIfNotUserModified(
      STORES.productionMetrics,
      sample.productionMetrics
    );
    await putSampleIfNotUserModified(STORES.fileMetadata, sample.fileMetadata);

    await this.logAudit(
      db,
      'System',
      projectId,
      'SEED_SAMPLE',
      'Loaded non-destructive MRAC 2026–2027 sample dataset fixtures (v0.1.1 Ceramic Node + Extrusion fixtures, preserving all user records)',
      actor
    );
    db.close();
  }

  /**
   * Removes ONLY records flagged with `isSampleFixture === true` that are NOT referenced
   * by any user research record (`isSampleFixture === false`).
   * Any sample parent record referenced by user data is promoted to `isSampleFixture = false`
   * so user research records are never orphaned and relational integrity is preserved.
   */
  async removeSampleFixturesOnly(actor = 'Researcher'): Promise<number> {
    const db = await openDatabase();

    const [
      materials,
      hardwares,
      nodeDesigns,
      nodeFeatures,
      experiments,
      specimens,
      ppsList,
      measurements,
      assemblyVerifications,
      observations,
      sessions,
      trials,
      references,
      prodMetrics,
      files,
    ] = await Promise.all([
      getAllFromStore<MaterialProfile>(db, STORES.materialProfiles),
      getAllFromStore<HardwareProfile>(db, STORES.hardwareProfiles),
      getAllFromStore<NodeDesign>(db, STORES.nodeDesigns),
      getAllFromStore<NodeFeatureDefinition>(db, STORES.nodeFeatureDefinitions),
      getAllFromStore<Experiment>(db, STORES.experiments),
      getAllFromStore<Specimen>(db, STORES.specimens),
      getAllFromStore<ProcessParameterSet>(db, STORES.processParameterSets),
      getAllFromStore<Measurement>(db, STORES.measurements),
      getAllFromStore<AssemblyVerification>(db, STORES.assemblyVerifications),
      getAllFromStore<ProcessObservation>(db, STORES.processObservations),
      getAllFromStore<CalibrationSession>(db, STORES.calibrationSessions),
      getAllFromStore<CalibrationTrial>(db, STORES.calibrationTrials),
      getAllFromStore<ResearchReference>(db, STORES.researchReferences),
      getAllFromStore<ProductionMetricRecord>(db, STORES.productionMetrics),
      getAllFromStore<FileDatasetMetadata>(db, STORES.fileMetadata),
    ]);

    const requiredExpIds = new Set<string>(
      experiments.filter((e) => !e.isSampleFixture).map((e) => e.id)
    );
    const requiredSpecIds = new Set<string>(
      specimens.filter((s) => !s.isSampleFixture).map((s) => s.id)
    );
    const requiredNodeDesignIds = new Set<string>(
      nodeDesigns.filter((n) => !n.isSampleFixture).map((n) => n.id)
    );
    const requiredFeatureIds = new Set<string>(
      nodeFeatures.filter((f) => !f.isSampleFixture).map((f) => f.id)
    );
    const requiredSessIds = new Set<string>(
      sessions.filter((s) => !s.isSampleFixture).map((s) => s.id)
    );
    const requiredMatIds = new Set<string>(
      materials.filter((m) => !m.isSampleFixture).map((m) => m.id)
    );
    const requiredHwIds = new Set<string>(
      hardwares.filter((h) => !h.isSampleFixture).map((h) => h.id)
    );
    const requiredPpsIds = new Set<string>(
      ppsList.filter((p) => !p.isSampleFixture).map((p) => p.id)
    );

    for (const m of measurements) {
      if (!m.isSampleFixture) {
        requiredExpIds.add(m.experimentId);
        if (m.specimenRecordId) requiredSpecIds.add(m.specimenRecordId);
        if (m.nodeDesignId) requiredNodeDesignIds.add(m.nodeDesignId);
        if (m.featureId) requiredFeatureIds.add(m.featureId);
      }
    }
    for (const a of assemblyVerifications) {
      if (!a.isSampleFixture) {
        requiredExpIds.add(a.experimentId);
        requiredSpecIds.add(a.specimenId);
        if (a.nodeDesignId) requiredNodeDesignIds.add(a.nodeDesignId);
        if (a.featureId) requiredFeatureIds.add(a.featureId);
      }
    }
    for (const o of observations) {
      if (!o.isSampleFixture) {
        requiredExpIds.add(o.experimentId);
        if (o.specimenId) requiredSpecIds.add(o.specimenId);
      }
    }
    for (const p of prodMetrics) {
      if (!p.isSampleFixture) requiredExpIds.add(p.experimentId);
    }
    for (const f of files) {
      if (!f.isSampleFixture && f.experimentId) requiredExpIds.add(f.experimentId);
    }
    for (const t of trials) {
      if (!t.isSampleFixture) {
        requiredSessIds.add(t.calibrationSessionId);
        requiredExpIds.add(t.experimentId);
      }
    }

    for (const s of sessions) {
      if (requiredSessIds.has(s.id)) {
        requiredExpIds.add(s.referenceExperimentId);
        requiredMatIds.add(s.materialProfileId);
      }
    }

    for (const spec of specimens) {
      if (requiredSpecIds.has(spec.id)) {
        requiredExpIds.add(spec.experimentId);
        if (spec.hardwareProfileId) requiredHwIds.add(spec.hardwareProfileId);
        if (spec.processParameterSetId) requiredPpsIds.add(spec.processParameterSetId);
        if (spec.nodeDesignId) requiredNodeDesignIds.add(spec.nodeDesignId);
      }
    }

    for (const feat of nodeFeatures) {
      if (requiredFeatureIds.has(feat.id)) {
        requiredNodeDesignIds.add(feat.nodeDesignId);
      }
    }

    // Transitive baseline references across experiments
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of experiments) {
        if (requiredExpIds.has(e.id)) {
          if (
            e.referenceBaselineExperimentId &&
            !requiredExpIds.has(e.referenceBaselineExperimentId)
          ) {
            requiredExpIds.add(e.referenceBaselineExperimentId);
            changed = true;
          }
          requiredMatIds.add(e.materialProfileId);
          requiredHwIds.add(e.hardwareProfileId);
          requiredPpsIds.add(e.processParameters.id);
          if (e.nodeDesignId) requiredNodeDesignIds.add(e.nodeDesignId);
        }
      }
    }

    // If a NodeDesign is protected, also protect its features so it stays intact
    for (const feat of nodeFeatures) {
      if (requiredNodeDesignIds.has(feat.nodeDesignId)) {
        requiredFeatureIds.add(feat.id);
      }
    }

    let removedCount = 0;

    const purgeOrPromote = async <
      T extends { id: string; isSampleFixture?: boolean }
    >(
      storeName: string,
      items: T[],
      protectedIds: Set<string>,
      transformOnPromote?: (item: T) => T
    ) => {
      for (const item of items) {
        if (item.isSampleFixture === true) {
          if (protectedIds.has(item.id)) {
            const promoted = transformOnPromote
              ? transformOnPromote({ ...item, isSampleFixture: false })
              : { ...item, isSampleFixture: false };
            await putInStore(db, storeName, promoted);
          } else {
            await deleteFromStore(db, storeName, item.id);
            removedCount++;
          }
        }
      }
    };

    await purgeOrPromote(STORES.materialProfiles, materials, requiredMatIds);
    await purgeOrPromote(STORES.hardwareProfiles, hardwares, requiredHwIds);
    await purgeOrPromote(STORES.nodeDesigns, nodeDesigns, requiredNodeDesignIds);
    await purgeOrPromote(
      STORES.nodeFeatureDefinitions,
      nodeFeatures,
      requiredFeatureIds
    );
    await purgeOrPromote(STORES.processParameterSets, ppsList, requiredPpsIds);
    await purgeOrPromote(
      STORES.experiments,
      experiments,
      requiredExpIds,
      (exp) => ({
        ...exp,
        isSampleFixture: false,
        processParameters: {
          ...exp.processParameters,
          isSampleFixture: false,
        },
      })
    );
    await purgeOrPromote(STORES.specimens, specimens, requiredSpecIds);
    await purgeOrPromote(STORES.calibrationSessions, sessions, requiredSessIds);

    // Leaf stores
    await purgeOrPromote(STORES.measurements, measurements, new Set());
    await purgeOrPromote(
      STORES.assemblyVerifications,
      assemblyVerifications,
      new Set()
    );
    await purgeOrPromote(STORES.processObservations, observations, new Set());
    await purgeOrPromote(STORES.calibrationTrials, trials, new Set());
    await purgeOrPromote(STORES.productionMetrics, prodMetrics, new Set());
    await purgeOrPromote(STORES.fileMetadata, files, new Set());

    for (const ref of references) {
      if (ref.isSampleFixture === true) {
        await deleteFromStore(db, STORES.researchReferences, ref.id);
        removedCount++;
      } else if (
        ref.relatedExperimentIds.some((eid) => !requiredExpIds.has(eid))
      ) {
        await putInStore(db, STORES.researchReferences, {
          ...ref,
          relatedExperimentIds: ref.relatedExperimentIds.filter((eid) =>
            requiredExpIds.has(eid)
          ),
        });
      }
    }

    await this.logAudit(
      db,
      'System',
      'sample-cleanup',
      'REMOVE_SAMPLE',
      `Removed ${removedCount} sample fixture record(s) while preserving all user research data and referenced dependencies.`,
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
      await putInStore(db, STORES.projects, snapshot.project);
    } else {
      const existingProjects = await getAllFromStore<Project>(db, STORES.projects);
      if (existingProjects.length === 0) {
        await putInStore(db, STORES.projects, snapshot.project);
      }
    }

    const putRecordsByMode = async <
      T extends { id: string; isSampleFixture?: boolean }
    >(
      storeName: string,
      incomingItems: T[]
    ) => {
      if (mode === 'replace_all') {
        for (const item of incomingItems) {
          await putInStore(db, storeName, item);
        }
        return;
      }
      const existing = await getAllFromStore<T>(db, storeName);
      const protectedUserIds = new Set(
        existing.filter((x) => x.isSampleFixture === false).map((x) => x.id)
      );
      for (const item of incomingItems) {
        if (!protectedUserIds.has(item.id)) {
          await putInStore(db, storeName, item);
        }
      }
    };

    let incomingExperiments = snapshot.experiments;
    if (mode === 'merge_preserve_user_data') {
      const existingExps = await getAllFromStore<Experiment>(db, STORES.experiments);
      const protectedCodeMap = new Map<string, string>();
      for (const e of existingExps) {
        if (e.isSampleFixture === false) {
          protectedCodeMap.set(e.experimentCode.trim().toLowerCase(), e.id);
        }
      }
      incomingExperiments = snapshot.experiments.map((exp) => {
        const existingProtectedId = protectedCodeMap.get(
          exp.experimentCode.trim().toLowerCase()
        );
        if (existingProtectedId && existingProtectedId !== exp.id) {
          return {
            ...exp,
            experimentCode: `${exp.experimentCode}-MERGED`,
          };
        }
        return exp;
      });
    }

    await putRecordsByMode(STORES.materialProfiles, snapshot.materialProfiles);
    await putRecordsByMode(STORES.hardwareProfiles, snapshot.hardwareProfiles);
    await putRecordsByMode(STORES.nodeDesigns, snapshot.nodeDesigns || []);
    await putRecordsByMode(
      STORES.nodeFeatureDefinitions,
      snapshot.nodeFeatureDefinitions || []
    );
    await putRecordsByMode(
      STORES.processParameterSets,
      snapshot.processParameterSets
    );
    await putRecordsByMode(STORES.experiments, incomingExperiments);
    await putRecordsByMode(STORES.specimens, snapshot.specimens || []);
    await putRecordsByMode(STORES.measurements, snapshot.measurements);
    await putRecordsByMode(
      STORES.assemblyVerifications,
      snapshot.assemblyVerifications || []
    );
    await putRecordsByMode(
      STORES.processObservations,
      snapshot.processObservations
    );
    await putRecordsByMode(
      STORES.calibrationSessions,
      snapshot.calibrationSessions
    );
    await putRecordsByMode(STORES.calibrationTrials, snapshot.calibrationTrials);
    await putRecordsByMode(STORES.researchReferences, snapshot.researchReferences);
    await putRecordsByMode(STORES.productionMetrics, snapshot.productionMetrics);
    await putRecordsByMode(STORES.fileMetadata, snapshot.fileMetadata);

    await this.logAudit(
      db,
      'System',
      snapshot.project.id,
      'RESTORE_BACKUP',
      `Restored workspace snapshot (${mode === 'merge_preserve_user_data' ? 'non-destructive merge preserving existing user records' : 'full replacement'})`,
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
  selectedSpecimenId: string | null;
  setSelectedSpecimenId: (id: string | null) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  storageHealth: StorageHealthInfo;
  toastMessage: string | null;
  notifyToast: (msg: string) => void;
  repository: ResearchRepository;
  refreshWorkspace: () => Promise<void>;
  navigateToExperimentInModule: (experimentId: string, module: ActiveModuleId) => void;
  navigateToSpecimenInModule: (
    experimentId: string,
    specimenId: string,
    module: ActiveModuleId
  ) => void;
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
  const [selectedSpecimenId, setSelectedSpecimenId] = useState<string | null>(null);
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
      setSelectedSpecimenId((prev) => {
        if (prev && data.specimens.some((s) => s.id === prev)) {
          return prev;
        }
        return data.specimens[0]?.id || null;
      });
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
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

  const navigateToSpecimenInModule = useCallback(
    (experimentId: string, specimenId: string, module: ActiveModuleId) => {
      setSelectedExperimentId(experimentId);
      setSelectedSpecimenId(specimenId);
      setActiveModule(module);
    },
    []
  );

  const countRecords = () => {
    if (!snapshot) return { sample: 0, user: 0 };
    const allArrays = [
      snapshot.materialProfiles,
      snapshot.hardwareProfiles,
      snapshot.nodeDesigns,
      snapshot.nodeFeatureDefinitions,
      snapshot.experiments,
      snapshot.specimens,
      snapshot.processParameterSets,
      snapshot.measurements,
      snapshot.assemblyVerifications,
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
    adapterName: 'IndexedDB Local Repository (v2)',
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
        selectedSpecimenId,
        setSelectedSpecimenId,
        globalSearchQuery,
        setGlobalSearchQuery,
        storageHealth,
        toastMessage,
        notifyToast,
        repository: repoInstance,
        refreshWorkspace,
        navigateToExperimentInModule,
        navigateToSpecimenInModule,
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
