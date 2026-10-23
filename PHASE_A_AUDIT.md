# Phase A Acceptance Audit Report — Fabrication Research OS v0.1.0

**Application:** Fabrication Research OS (`v0.1.0`)
**Project Context:** IAAC — Master in Robotics and Advanced Construction (MRAC 2026–2027)
**Audit Date:** 2026-10-19
**Audit Scope:** End-to-end Phase A vertical slice inspection, automated verification, defect remediation, data-integrity analysis, and Phase B readiness evaluation.

---

## 1. Implemented Functionality Matrix

Based on direct source code inspection across `src/domain`, `src/repositories`, `src/scientific`, `src/services`, `src/integrations`, and `src/modules`:

| Module / Capability | Implementation Status | Source Files | Audit Notes |
| :--- | :--- | :--- | :--- |
| **Canonical 13-Entity Shared Data Model** | **Genuinely Implemented** | `src/domain/models.ts` | All 13 entities (`Project`, `MaterialProfile`, `HardwareProfile`, `Experiment`, `ProcessParameterSet`, `Measurement`, `ProcessObservation`, `CalibrationSession`, `CalibrationTrial`, `ResearchReference`, `ProductionMetricRecord`, `FileDatasetMetadata`, `AuditEvent`) are defined with strict Zod schemas. |
| **IndexedDB Persistent Repository** | **Genuinely Implemented** | `src/repositories/repository.ts` | Uses native IndexedDB (`fabrication_research_os_db_v1`) with 13 object stores, schema versioning, Zod runtime validation on write, referential integrity checks, and audit event logging. |
| **Module 00: Research Overview** | **Genuinely Implemented** | `src/modules/OverviewModule.tsx` | Live rollups of experiments, material/hardware profiles, verified vs. unverified measurements, research questions/hypotheses, evaluation criteria, and audit log stream. |
| **Module 01: Experiment Lab (CRUD, 7-Step Wizard, Comparison, Profiles)** | **Genuinely Implemented** | `src/modules/ExperimentLabModule.tsx` | Full Experiment CRUD (Create via 7-step wizard, Read/Filter/Sort registry, Update via 7-step Edit mode + quick status selector, Delete with referential integrity checks), side-by-side Baseline vs. Proposed comparison, and inline Material & Hardware Profile editors. |
| **Module 02: Quality Inspector (Numerical & Schematic)** | **Genuinely Implemented** | `src/modules/QualityInspectorModule.tsx`, `src/scientific/calculations.ts` | Computes sample mean, sample standard deviation ($n-1$), RMSE, max abs deviation, tolerance pass rate, guarded $C_p/C_{pk}$ ($n \ge 25$, uniform tolerance, user-confirmed stability), layer scatter plot, and parametric capsule cross-section schematic explicitly labeled as non-scanned. |
| **Module 03: Calibration Studio** | **Genuinely Implemented** | `src/modules/CalibrationStudioModule.tsx`, `src/scientific/calculations.ts` | Separates `Observed Experimental Trial` from `Theoretical / Unvalidated Candidate` ledgers. Performs deterministic parameter bounds checking, kinematic cross-section area/volumetric calculations, and OLS linear checkpoint interpolation strictly guarded by $\ge 3$ observed trials across $\ge 3$ distinct flow states. |
| **Module 04: Process Explorer** | **Genuinely Implemented (Offline Streams)** | `src/modules/ProcessExplorerModule.tsx`, `src/scientific/calculations.ts` | Logs and inspects `ProcessObservation` records with explicit clock synchronization status (`NTP/PTP`, `Manual Offset`, `Unsynchronized`), acquisition source, and coordinate frame. Blocks multi-stream correlation unless clocks are aligned, timestamps are valid ISO-8601, and coordinate frames match. |
| **Module 05: Research Library** | **Genuinely Implemented** | `src/modules/ResearchLibraryModule.tsx` | Manages `ResearchReference` entries with DOI/URL, citation key, claim-to-evidence rationale, and bidirectional linking to `Experiment` IDs. |
| **Module 06: Industry & Production Metrics** | **Genuinely Implemented** | `src/modules/IndustryMetricsModule.tsx`, `src/scientific/calculations.ts` | Records `ProductionMetricRecord` entries and computes yield rate, scrap/waste ratio, calibration time overhead, and manual-input cost per accepted part. |
| **CSV / JSON Import & Export Service** | **Genuinely Implemented** | `src/services/importExport.ts` | RFC-4180 CSV parser/exporter for measurements and experiments (preserving units, custom labels, XYZ coordinates, uncertainty metadata, and provenance) plus versioned JSON workspace backup/restore with full relational integrity validation. |
| **External Hardware & CAD Integration Adapters** | **Offline File Contracts Only (Phase A By Design)** | `src/integrations/adapters.ts`, `src/modules/SystemModules.tsx` | Grasshopper JSON parameter/waypoint contract and offline ABB RAPID parameter snippet generator with physical velocity clamping and mandatory simulation/operator stop warnings. Live socket/robot/sensor streaming is explicitly marked as `Planned Interface (Phase B)` with `liveHardwareConnected: false`. |

---

## 2. Defects Identified & Remediated During Audit

Every issue discovered during the code inspection and edge-case audit is documented below with its severity, location, reproduction steps, expected vs. actual behavior, and applied fix.

### Issue 01 — Missing Full Experiment Edit Workflow in Experiment Lab UI
- **Severity:** Major
- **Affected Module:** Module 01 · Experiment Lab
- **File and Function:** `src/modules/ExperimentLabModule.tsx` (`ExperimentLabModule`, `handleSubmitExperimentWizard`)
- **Reproduction Steps:**
  1. Create an experiment in Experiment Lab.
  2. Select the experiment in the Registry table.
  3. Attempt to edit its process parameters, hypothesis, or tolerance criteria (only status dropdown and delete button were exposed in the UI).
- **Expected vs. Actual Behavior:**
  - *Expected:* Full CRUD support allowing researchers to edit existing experiment metadata, process parameters, and tolerance snapshots in place without deleting and recreating the experiment.
  - *Actual:* `repository.saveExperiment(exp, false)` supported updates at the repository layer, but the UI only exposed quick status updates and creation of new experiments.
- **Applied Fix:** Added `editingExperimentId` state and `handleLoadExperimentForEdit(exp)` in `ExperimentLabModule.tsx`, wired an `Edit` action button in the experiment inspection header, and updated `handleSubmitExperimentWizard` to preserve `id`, `processParameters.id`, and `createdAt` when updating an existing experiment.

### Issue 02 — Cross-Module `selectedExperimentId` Desynchronization in Calibration Studio
- **Severity:** Major
- **Affected Module:** Module 03 · Calibration Studio
- **File and Function:** `src/modules/CalibrationStudioModule.tsx` (`CalibrationStudioModule`)
- **Reproduction Steps:**
  1. In Experiment Lab, select `EXP-2026-002` and click **Open in Calibration Studio**.
  2. Observe which calibration session is selected in Calibration Studio.
- **Expected vs. Actual Behavior:**
  - *Expected:* Calibration Studio should bind to `selectedExperimentId` from `useResearchWorkspace()` so navigating from Experiment Lab automatically selects the calibration session associated with that experiment, and switching sessions updates `selectedExperimentId`.
  - *Actual:* `CalibrationStudioModule` did not read `selectedExperimentId` and always defaulted to `calibrationSessions[0]`.
- **Applied Fix:** Connected `selectedExperimentId` and `setSelectedExperimentId` in `CalibrationStudioModule.tsx` so `activeSession` resolves matching `referenceExperimentId` and session changes synchronize `selectedExperimentId`.

### Issue 03 — Hardcoded `'unassigned'` Foreign Keys When Creating Calibration Sessions on Empty/Custom Workspaces
- **Severity:** Critical
- **Affected Module:** Module 03 · Calibration Studio & IndexedDB Repository
- **File and Function:** `src/modules/CalibrationStudioModule.tsx` (`handleCreateSession`) and `src/repositories/repository.ts` (`saveCalibrationSession`)
- **Reproduction Steps:**
  1. Start with an empty database (before creating materials or experiments) or with multiple materials/experiments.
  2. Open Calibration Studio, click **+ New Calibration Session**, enter a title, and submit.
  3. Export a Workspace JSON Backup and attempt to restore it.
- **Expected vs. Actual Behavior:**
  - *Expected:* Creating a Calibration Session must require selecting a valid `materialProfileId` and `referenceExperimentId`, and the repository must reject dangling foreign keys before persistence.
  - *Actual:* `handleCreateSession` lacked Material and Reference Experiment selectors and fell back to `'unassigned'` when empty, which would subsequently fail backup relational integrity checks.
- **Applied Fix:** Added Material Profile and Reference Experiment `<select>` inputs to the New Calibration Session form, blocked creation if no Material Profile or Experiment exists, and added strict foreign-key and Zod validation in `repository.saveCalibrationSession` and `repository.saveCalibrationTrial`.

### Issue 04 — Transitive Foreign-Key Orphans When Removing Sample Dataset Fixtures
- **Severity:** Critical
- **Affected Module:** Data Management / IndexedDB Repository
- **File and Function:** `src/repositories/repository.ts` (`removeSampleFixturesOnly`)
- **Reproduction Steps:**
  1. Load the Sample Dataset (`isSampleFixture: true`).
  2. Create a user Experiment (`isSampleFixture: false`) that references a sample Material Profile (`sample-mat-clay-b01`) or sample Hardware Profile (`sample-hw-abb140-clay`), or a user Calibration Trial inside a sample Calibration Session.
  3. Click **Remove Sample Dataset Only** in Data Management.
- **Expected vs. Actual Behavior:**
  - *Expected:* Any sample Material Profile, Hardware Profile, Experiment, or Calibration Session referenced by a user record (`isSampleFixture === false`) must be retained so user research data never suffers broken foreign keys.
  - *Actual:* `removeSampleFixturesOnly` only checked direct references from `experiments` to materials/hardware, missing references from `calibrationSessions`, `calibrationTrials`, `measurements`, `processObservations`, and `productionMetrics`.
- **Applied Fix:** Updated `removeSampleFixturesOnly` in `src/repositories/repository.ts` to compute the full transitive closure of protected IDs (`protectedSessionIds`, `protectedExpIds`, `protectedMatIds`, `protectedHwIds`) across all dependent user records before deleting sample fixtures, and cleaned up removed sample experiment IDs from user `ResearchReference.linkedExperimentIds`.

### Issue 05 — Duplicate `experimentCode` Collision on Sample Load or Merge Restore
- **Severity:** Major
- **Affected Module:** Data Management / IndexedDB Repository
- **File and Function:** `src/repositories/repository.ts` (`loadSampleDatasetNonDestructive`, `restoreWorkspaceSnapshot`)
- **Reproduction Steps:**
  1. On a fresh database, create a user experiment with default code `EXP-2026-001`.
  2. Go to Data Management and click **Load Sample Dataset** (which also contains `EXP-2026-001` with ID `sample-exp-001`).
- **Expected vs. Actual Behavior:**
  - *Expected:* Sample loading and merge-restores must never overwrite user records and must disambiguate colliding `experimentCode` values (e.g., `EXP-2026-001-SMP`).
  - *Actual:* Loading the sample dataset inserted `sample-exp-001` with duplicate `experimentCode: "EXP-2026-001"`, causing subsequent JSON backup validation to fail the unique `experimentCode` constraint.
- **Applied Fix:** Added automatic `experimentCode` collision detection and suffix disambiguation (`-SMP` / `-RESTORED`) in both `loadSampleDatasetNonDestructive` and `restoreWorkspaceSnapshot`.

### Issue 06 — Incomplete Relational Integrity Checks in `validateAndMigrateWorkspaceSnapshot`
- **Severity:** Critical
- **Affected Module:** Data Management / Import & Export Service
- **File and Function:** `src/services/importExport.ts` (`validateAndMigrateWorkspaceSnapshot`)
- **Reproduction Steps:**
  1. Construct a JSON backup where a `CalibrationSession`, `CalibrationTrial`, `ProcessObservation`, or `ProductionMetricRecord` references a non-existent `experimentId`, `materialProfileId`, or `calibrationSessionId`.
  2. Pass the JSON to `validateAndMigrateWorkspaceSnapshot`.
- **Expected vs. Actual Behavior:**
  - *Expected:* Backup validation must verify all entity schemas (including `fileMetadata` and `auditEvents`), reject duplicate IDs, and verify foreign keys across all 13 entities.
  - *Actual:* Only `Experiment -> materialProfileId/hardwareProfileId` and `Measurement -> experimentId` were checked.
- **Applied Fix:** Added Zod array validation for all entity collections, duplicate ID/code checks, and complete relational foreign-key verification across `experiments`, `measurements`, `processObservations`, `calibrationSessions`, `calibrationTrials`, and `productionMetrics`, plus automatic synchronization of `processParameterSets`.

### Issue 07 — CSV Export/Import Round-Trip Omitted Spatial Coordinates, Custom Labels, and Notes
- **Severity:** Major
- **Affected Module:** Module 02 · Quality Inspector / Import & Export Service
- **File and Function:** `src/services/importExport.ts` (`exportMeasurementsToCsv`, `parseMeasurementsCsv`)
- **Reproduction Steps:**
  1. Export measurements containing `customMeasurementLabel`, `xCoordMm`, `yCoordMm`, `zCoordMm`, `confidenceLevelPercent`, `calibrationRef`, or `notes` to CSV.
  2. Re-import the exported CSV file into Quality Inspector.
- **Expected vs. Actual Behavior:**
  - *Expected:* All exported measurement fields and units should round-trip losslessly, and UTF-8 BOM headers (`\uFEFF`) should be stripped automatically.
  - *Actual:* `exportMeasurementsToCsv` omitted `xCoordMm`, `yCoordMm`, `zCoordMm`, `customMeasurementLabel`, `confidenceLevelPercent`, `calibrationRef`, and `notes`, and `parseMeasurementsCsv` did not strip UTF-8 BOM.
- **Applied Fix:** Updated `exportMeasurementsToCsv` and `parseMeasurementsCsv` to include all spatial, uncertainty, custom label, and notes columns, strip `\uFEFF` BOM, and reject duplicate measurement IDs within a CSV batch.

### Issue 08 — `Cp / Cpk` Guard Did Not Check for Non-Uniform Specification Limits Across Measurements
- **Severity:** Major
- **Affected Module:** Module 02 · Quality Inspector / Scientific Calculations
- **File and Function:** `src/scientific/calculations.ts` (`computeMeasurementStatistics`) and `src/modules/QualityInspectorModule.tsx`
- **Reproduction Steps:**
  1. Record 25 measurements of the same `measurementType` and `unit`, but with different `targetValue` or `tolerance` on some rows.
  2. Check "Confirm temporal stability & normality for Cp/Cpk".
- **Expected vs. Actual Behavior:**
  - *Expected:* $C_p / C_{pk}$ requires a single uniform specification band ($\text{target} \pm \text{tolerance}$) across all $n \ge 25$ observations; if mixed targets/tolerances exist, $C_p / C_{pk}$ must be withheld with an explanation. Furthermore, the UI badge should not display `n < 25` when $n \ge 25$ and $C_p / C_{pk}$ is withheld for another precondition.
  - *Actual:* `computeMeasurementStatistics` used `filtered[0].targetValue` and `filtered[0].tolerance` without checking uniformity across all rows, and `QualityInspectorModule.tsx` hardcoded `Withheld (n < 25)` in the badge header.
- **Applied Fix:** Added `hasNonUniformSpec` check in `computeMeasurementStatistics` and updated the `QualityInspectorModule.tsx` badge header to distinguish `n < 25` from other unmet preconditions.

### Issue 09 — Empirical Checkpoint Interpolation Allowed $< 3$ Distinct Flow States & Unclamped Speed
- **Severity:** Major
- **Affected Module:** Module 03 · Calibration Studio / Scientific Calculations
- **File and Function:** `src/scientific/calculations.ts` (`evaluateEmpiricalCheckpointCandidate`)
- **Reproduction Steps:**
  1. Log 3 observed trials where 2 trials share the exact same `relativeFlowPercent` (only 2 distinct flow levels), or pass a `currentSpeedMmPerSec` outside session bounds.
- **Expected vs. Actual Behavior:**
  - *Expected:* Linear sensitivity interpolation requires at least 3 observed trials spanning at least 3 distinct `relativeFlowPercent` levels, positive finite inputs, and clamping of `candidatePrintSpeedMmPerSec` to session bounds.
  - *Actual:* Only checked `observedTrials.length < 3` and `den < 1e-4`, and did not clamp `candidatePrintSpeedMmPerSec`.
- **Applied Fix:** Enforced `distinctFlowValues.size >= 3`, positive finite input validation, and session bounds clamping for `candidatePrintSpeedMmPerSec` in `evaluateEmpiricalCheckpointCandidate`.

### Issue 10 — Process Explorer Stream Correlation Did Not Validate Malformed ISO Timestamps
- **Severity:** Minor
- **Affected Module:** Module 04 · Process Explorer / Scientific Calculations
- **File and Function:** `src/scientific/calculations.ts` (`verifyStreamCorrelationCompatibility`)
- **Reproduction Steps:**
  1. Pass a `Measurement` or `ProcessObservation` with an unparseable timestamp string to `verifyStreamCorrelationCompatibility`.
- **Expected vs. Actual Behavior:**
  - *Expected:* `canCorrelate` must be `false` if any timestamp is missing or fails `Date.parse()`, or if `acquisitionSource` is blank.
  - *Actual:* Checked `clockSyncStatus` and `coordinateFrame`, but did not validate `Date.parse(timestamp)`.
- **Applied Fix:** Added ISO-8601 timestamp parsing checks and `acquisitionSource` presence checks in `verifyStreamCorrelationCompatibility`.

### Issue 11 — Offline ABB RAPID Snippet Export Lacked Velocity Clamping
- **Severity:** Minor
- **Affected Module:** Offline Integration Adapters
- **File and Function:** `src/integrations/adapters.ts` (`generateCheckpointParameterSnippet`)
- **Reproduction Steps:**
  1. Pass an extreme print speed (e.g., `9999 mm/s`) to `generateCheckpointParameterSnippet`.
- **Expected vs. Actual Behavior:**
  - *Expected:* Offline RAPID export must clamp parameters to safe physical ranges (`[1..250] mm/s`), emit a clamping warning comment when clamped, and clearly separate module-level `PERS` declarations from procedure-level `Stop;` instructions.
  - *Actual:* Interpolated raw `printSpeedMmPerSec` directly into `speeddata`.
- **Applied Fix:** Added physical safety clamping (`1..250 mm/s` speed, `0.1..50 mm` layer height, `0.2..100 mm` bead width, `0..300%` flow) and explicit RAPID section headers in `src/integrations/adapters.ts`.

---

## 3. Automated Test Execution Results

All automated verification suites were executed via Node.js / `tsx` (`npx tsx src/scientific/runAuditTests.ts`) and TypeScript compiler / Vite production build checks.

### Executed Test Suite Summary (`src/scientific/runAuditTests.ts` & `src/scientific/verification.ts`)

| Test ID | Audited Workflow & Edge Cases | Execution Status | Verified Output Summary |
| :--- | :--- | :--- | :--- |
| **T01** | Built-in Phase A Verification Suite (11 Domain & Scientific Invariants) | **PASSED** (Executed) | All 11 invariant checks in `runPhaseAVerificationChecks()` passed (`passed: true`). |
| **T02** | Workflow 1 & 3: Domain Schema Validation & Material/Hardware Associations | **PASSED** (Executed) | Verified all 13 canonical entities, Material/Hardware profile foreign keys, and Zod rejection of negative print speeds. |
| **T03** | Workflow 4: Numerical Measurement Accuracy, Sample Variance ($n-1$), RMSE & Tolerance | **PASSED** (Executed) | Verified `EXP-2026-001` bead width mean = `7.215 mm`, sample stdDev ($n-1$) = `0.1170 mm`, RMSE = `0.7221 mm`, passRate = `0.0%`, plus $n=1$ ($\sigma=0$, no `NaN`) and $n=0$ (`null`) edge cases. |
| **T04** | Workflow 5: CSV/JSON Import & Export with Unit & Metadata Preservation | **PASSED** (Executed) | Verified lossless CSV round-trip of 7 records including UTF-8 BOM stripping, custom measurement labels with embedded commas, escaped quotes, XYZ coordinates, and rejection of 2 malformed rows. |
| **T05** | Workflow 6: Project Backup & Restore with Complete Relational Integrity | **PASSED** (Executed) | Verified valid workspace snapshot acceptance and rejection of broken foreign keys across `calibrationSessions`, `calibrationTrials`, `processObservations`, and `productionMetrics`. |
| **T06** | Workflow 9: $C_p/C_{pk}$ Precondition Guards & Empirical Interpolation Safeguards | **PASSED** (Executed) | Verified $C_p/C_{pk}$ withheld for $n=24$, unconfirmed stability, zero variance ($\sigma=0$), and mixed tolerances; verified empirical interpolation withheld for $<3$ observed trials, $<3$ distinct flow levels, and theoretical-only candidates. |
| **T07** | Workflow 10: Strict Distinction Between Measured, Computed, and AI-Assisted Data | **PASSED** (Executed) | Verified `AI-Assisted Annotation` and `Computed` records are forced to `verifiedPhysicalMeasurement = false` and excluded from default statistical summaries and experiment quality rollups. |
| **T08** | Workflow 11: Process Timestamp Synchronization & Coordinate-Frame Safeguards | **PASSED** (Executed) | Verified `verifyStreamCorrelationCompatibility` blocks unsynchronized clocks, mismatched coordinate frames (`camera_raw_px` vs `wobjPrintTable_01`), and invalid ISO timestamps. |
| **T09** | Workflow 12: Safe Offline ABB RAPID Export & Clamping | **PASSED** (Executed) | Verified mandatory simulation/operator safety headers, clamping of extreme speed (`9999 mm/s` $\rightarrow$ `250 mm/s`), and `liveConnectionSupportedInPhaseA === false`. |

---

## 4. Manual UI Tests Still Required

In accordance with strict audit separation between automated Node.js verification and browser-interactive verification, the following workflows require manual verification in a live browser session:

1. **Browser IndexedDB Persistence Across Hard Page Reloads (Workflows 1, 7, 8):**
   - While IndexedDB repository transactions, Zod guards, and state hydration were inspected in `src/repositories/repository.ts`, automated tests ran in Node.js memory rather than a headless Chromium IndexedDB instance.
   - *Manual Step:* Create an Experiment, Material Profile, Hardware Profile, Calibration Session, and Calibration Trial in the browser UI, press `Cmd+R` / `F5` to reload the page, and confirm all records persist in IndexedDB (`fabrication_research_os_db_v1`).
2. **Interactive SVG Crosshair Probe & Recharts Rendering (Module 02 & Module 03):**
   - *Manual Step:* Hover the mouse over the Bead Width & Height Cross-Section SVG canvas in Quality Inspector to verify live `PROBE X / Z (mm)` coordinate readouts, and verify responsive chart rendering in Calibration Studio and Process Explorer.
3. **Browser File Picker & Blob Download Dialogs (Workflows 5, 6, 12):**
   - *Manual Step:* Click **Export Workspace JSON Backup**, **Import Measurements CSV**, and **Export ABB RAPID Snippet** in the browser to confirm native file dialogs and downloaded filenames.

---

## 5. Data-Integrity Risks & Mitigations

1. **Browser Storage Eviction & Quota Limits:**
   - *Risk:* IndexedDB storage is origin-scoped and subject to browser profile clearing, private-browsing teardown, or disk quota eviction.
   - *Mitigation Implemented:* Prominent persistent warnings in Data Management (`SystemModules.tsx`), SHA-256 / FNV-1a checksum generation on exports, and one-click versioned JSON workspace backup (`fro_workspace_backup_v1`).
2. **Accidental Deletion of Referenced Entities:**
   - *Risk:* Deleting a Material Profile, Hardware Profile, or Experiment that is referenced by downstream measurements, sessions, or baseline comparisons could corrupt relational integrity.
   - *Mitigation Implemented:* `deleteMaterialProfile`, `deleteHardwareProfile`, and `deleteExperiment` in `src/repositories/repository.ts` check all referencing stores before deletion and return a descriptive block error if dependencies exist.
3. **Contamination of Physical Statistics by Unverified / Computed Estimates:**
   - *Risk:* Mixing theoretical or AI-assisted annotations with physical caliper/optical measurements could falsify RMSE and tolerance compliance rates.
   - *Mitigation Implemented:* Both `saveMeasurement` and `parseMeasurementsCsv` force `verifiedPhysicalMeasurement = false` whenever `sourceType` is `'AI-Assisted Annotation'` or `'Computed'`, and `computeMeasurementStatistics` / `evaluateExperimentQuality` exclude unverified records by default.

---

## 6. Known Limitations in Phase A (v0.1.0)

1. **Single-Variable Checkpoint Interpolation:** Calibration Studio's empirical checkpoint calculator (`evaluateEmpiricalCheckpointCandidate`) currently performs 1D Ordinary Least Squares interpolation of Bead Width vs. Relative Flow % (with proportional Z-offset adjustment) rather than multivariate response-surface optimization across speed, nozzle height, temperature, and pressure simultaneously.
2. **Scalar Schematic Cross-Sections:** Quality Inspector renders idealized oblong capsule cross-sections parameterized by scalar width $W$ and height $H$ measurements unless an external `scannedProfilePointsMm` array is provided via JSON backup. Direct CSV/PLY laser-line point-cloud slice ingestion is deferred to Phase B.
3. **Offline File-Based Toolpath & Robot Exchange:** Grasshopper and ABB RAPID integrations operate strictly via offline file export/import contracts. No live Robot Web Services (RWS), ROS2, Machina, or serial G-Code streaming is implemented in Phase A.
4. **Manual Clock Offset Entry for Multi-Stream Correlation:** Process Explorer verifies clock synchronization metadata and coordinate frames before correlating observations and measurements, but does not yet perform automated cross-correlation lag estimation or sub-millisecond PTP packet alignment.

---

## 7. Phase B Readiness Recommendation: **GO**

**Recommendation:** **GO for Phase B** (subject to completing the 3 manual browser UI checks listed in Section 4).

**Rationale:**
- All **3 Critical** and **5 Major** data-integrity, foreign-key, CSV round-trip, and statistical precondition issues identified during the Phase A audit have been resolved and verified via automated tests.
- All **13 canonical domain entities** and **6 core modules** operate on a single shared schema with strict separation between observed physical measurements, computed/theoretical candidates, and planned hardware interfaces.
- Non-destructive sample fixture loading/removal and full relational backup validation protect researcher data throughout iterative development.
