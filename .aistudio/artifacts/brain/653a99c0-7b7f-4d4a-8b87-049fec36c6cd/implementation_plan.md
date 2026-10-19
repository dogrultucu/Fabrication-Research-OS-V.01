# Fabrication Research OS (v0.1.0)

Fabrication Research OS is a modular, local-first scientific research platform developed for IAAC Master in Robotics and Advanced Construction (MRAC 2026–2027) to design, execute, inspect, calibrate, and evaluate adaptive robotic additive manufacturing processes (feedforward planning and checkpoint recalibration) against fixed-parameter and manual recalibration baselines.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and product decisions incorporate your confirmed guidance from Phase 1 and establish the foundation for v0.1.0.

- **Confirmed Decision 1 — Clean Zero-State with Optional Sample Dataset Loader**: The platform launches with an initialized project frame and an empty experiment database by default so no fabricated evidence or unverified thesis claims pollute your workspace. A one-click **Load Sample MRAC Dataset** action in **Data Management** (and accessible from empty-state cards) populates realistic clay and polymer baseline/checkpoint trials, hardware profiles, measurements, and references for testing or demonstration, alongside a one-click reset.
- **Confirmed Decision 2 — High-Precision Visualizers, Response Curves & Data Portability**:
  - **Quality Inspector & Process Explorer** include an interactive 2D layer/bead cross-section and toolpath deviation canvas with crosshair coordinate inspection (`mm`, `mm/s`, residual error).
  - **Calibration Studio** provides empirical parameter trade-off response curves (print speed vs. relative/volumetric flow vs. bead geometry error) and a rule-based/regression checkpoint recommendation calculator.
  - **Data Management** supports full project JSON backup/restore and CSV/JSON import and export for experiments, measurements, and process observations with explicit dataset provenance and checksums.
- **Confirmed Decision 3 — Platform-Neutral Configurable Hardware Profiles**: Hardware profiles explicitly model both **Industrial Robotic Extrusion** (e.g., ABB IRB 120/140, pneumatic clay extruders, optional pellet extruders) and **Desktop Extrusion Testbeds** (e.g., FDM/FFF printers, syringe/auger testbeds), along with measurement equipment (digital calipers, calibrated RGB/RGB-D cameras, optional optical sensors). Every piece of equipment carries an explicit operational state (**Planned**, **Available**, **Configured**, or **Connected**) with zero hard-coded assumptions about live robot connectivity in v0.1.0.

---

## 1. Overview & Core Concept

- **What It Does**: Provides a single, unified scientific workstation connecting six research modules—**Experiment Lab**, **Quality Inspector**, **Calibration Studio**, **Process Explorer**, **Research Library**, and **Industry Metrics**—plus shared **Overview**, **Data Management**, **Project Settings**, and **System Status** views over a single relational IndexedDB repository.
- **Target Audience / Persona**: Architectural robotics researchers and computational fabrication engineers conducting rigorous empirical comparisons between fixed-parameter baselines, manual recalibration workflows, and feedforward/checkpoint recalibration strategies across clay/ceramic and polymer extrusion.
- **Key Value**: Eliminates fragmented spreadsheets and disconnected scripts by enforcing strict unit discipline (`mm`, `mm/s`, `%`, `mm³/s`), explicit measurement provenance (**Manual**, **Imported**, **Computed**, **AI-Assisted Annotation**), audit logging, and cross-module traceability from hypothesis to physical specimen measurements and production efficiency metrics.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Project & Equipment Framing**: Configure working thesis title, submitted abstract, research questions, hypotheses, evaluation criteria, extensible Material Profiles (clay, ceramic, polymer, custom), and Hardware Profiles (with Planned/Available/Configured/Connected states) in **Project Settings** and **Experiment Lab**.
  2. **Experiment Design & Execution (Experiment Lab)**: Use the 7-step **New Experiment Wizard** to bind a Material Profile and Hardware Profile, specify baseline vs. manual vs. feedforward/checkpoint method, define physical process parameters (strictly separating relative flow `%` from volumetric flow rate `mm³/s` or `mL/min`), and snapshot target tolerances. Compare runs side-by-side in the **Experiment Registry & Comparison Matrix**.
  3. **Geometric Verification (Quality Inspector)**: Log or import physical measurements (bead width, bead height, XYZ residual, surface deviation, dimensional error) with coordinate frame and uncertainty metadata. Inspect cross-sectional bead profiles and layer deviations on an interactive 2D technical canvas and automatically evaluate pass/fail status against experiment tolerances.
  4. **Checkpoint Recalibration (Calibration Studio)**: Create calibration sessions linked to a reference experiment and material batch. Log sequential calibration trials, visualize parameter trade-off response curves, and compute bounded parameter adjustments (e.g., print speed or flow compensation at layer checkpoints) with explicit constraint validation.
  5. **Temporal & Layer Telemetry (Process Explorer)**: Inspect time-series and layer-indexed process observations (extrusion pressure, motor torque, speed, nozzle height, ambient humidity/temperature) synchronized with toolpath segments and checkpoint markers.
  6. **Literature & Gap Traceability (Research Library)**: Curate citations with DOI, methodological category, evidence level, verification status, and direct links to experiments testing those claims.
  7. **Baseline vs. Proposed Viability (Industry Metrics)**: Quantify accepted/rejected parts, material waste (`g` / `kg`), setup/print/calibration duration (`min`), energy usage (`kWh`), and manual cost inputs to evaluate whether checkpoint recalibration improves net yield and efficiency over fixed baselines.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Precision scientific instrument and computational fabrication workstation—disciplined, high-density, low-noise, with flat structural surfaces and 1px hairline borders.
  - *Color Palette & Mood (60-30-10 Budget)*:
    - **60% Dominant Canvas**: Deep graphite obsidian (`#0B0E14`) primary workspace background with `#0F141C` structural panels.
    - **30% Structural Surfaces & Borders**: Elevated charcoal slate (`#151C28`), crisp hairline dividers (`#1E293B`), muted technical labels (`#94A3B8`), high-contrast primary text (`#F1F5F9`).
    - **10% Calibrated Telemetry Accents**: Precision cyan (`#06B6D4`) for primary interactive focus and active traces; semantic status pairs combining glyphs and text—Emerald (`#10B981`, `● Nominal / Within Tolerance`), Amber (`#F59E0B`, `▲ Drifting / Manual`), Rose (`#F43F5E`, `✖ Out of Tolerance / Aborted`).
  - *Typography & Hierarchy (2+1 Font Rule)*:
    - **Display & Section Structure**: `Plus Jakarta Sans` (SemiBold 600, tight tracking, balanced headlines).
    - **Dense Interface & Prose**: `Public Sans` (Regular 400 / Medium 500) for clear legibility at 12px–14px density.
    - **Numeric Telemetry, Units & Coordinates**: `IBM Plex Mono` (`font-mono tabular-nums`) for all experiment codes, parameter matrices, tolerances, residuals, and timestamps. Numeric values are visually separated from explicit unit suffixes (`mm`, `mm/s`, `kPa`).
  - *Component Styling & Layout*:
    - Desktop-first 1440px full-viewport layout: Left navigation sidebar (`240px` fixed width with top module links and bottom utility links), compact top workspace bar (project context, global search, active experiment selector, data mode indicator, and import/export triggers), contextual breadcrumb strip, and asymmetric split consoles for inspection and calibration views.
    - Strict adherence to **Zero-Pill Metadata Discipline**: static metadata (material types, batch IDs, dates, units, source types) rendered as clean inline text with `·` or `/` separators, reserving boxed controls strictly for interactive filters and buttons.

- **Interactive Feedback & Motion**:
  - Instant ($\le 150\text{ms}$) filter, sort, and tab transitions.
  - Interactive `cursor-crosshair` HUD on 2D bead/layer canvases and Recharts telemetry plots with snapped coordinate readouts.
  - Unsaved-change guards on forms, explicit schema validation feedback via Zod, and non-intrusive audit confirmation toasts.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Repository Pattern over IndexedDB with Explicit Migrations**
  - *Chosen Approach*: Implement a typed `ResearchRepository` interface backed by a versioned IndexedDB engine (`FabricationResearchDB_v1`) that stores all 12 core entities and records an `AuditEvent` on every create/update/delete operation.
  - *Why*: Guarantees offline reliability in the robotics lab, zero external cloud lock-in, full referential integrity across all six modules, and a clean seam to swap in SQLite or PostgreSQL later in the MRAC thesis year.
  - *Alternatives Considered*: `localStorage` (rejected due to 5MB size limits and lack of transactional indexing for time-series observations and measurement datasets).

- **Decision 2 — Strict Physical Unit & Provenance Enforcement**
  - *Chosen Approach*: Separate `relativeFlowPercent` (`%`) from `volumetricFlowValue` (`mm³/s` or `mL/min`) at the schema and form validation level, and require a `sourceType` (`Manual`, `Imported`, `Computed`, `AI-Assisted Annotation`) on every measurement record.
  - *Why*: Prevents common robotic slicing vs. physical rheology conflation and ensures AI-assisted or computed estimates can never be mistaken for verified physical measurements in thesis analysis.

- **Decision 3 — Purely Scientific Domain Calculations in Standalone Engine**
  - *Chosen Approach*: Isolate statistical calculations (mean, standard deviation, RMSE, dimensional residual $\Delta$, Cp/Cpk capability indices, yield rate, material waste ratio, and linear/polynomial parameter response curves) in a pure TypeScript scientific calculation layer with zero UI or external API dependencies.
  - *Why*: Ensures every chart and comparison metric is deterministic, inspectable, and unit-testable.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              FABRICATION RESEARCH OS                                 │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Top Workspace Bar: Project Context · Search · Active Exp · Mode · Import/Export│  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────┐  ┌────────────────────────────────────────────────────────┐  │
│  │ Left Navigation    │  │ Main Scientific Workspace Viewport                     │  │
│  │                    │  │                                                        │  │
│  │ • Overview         │  │  ┌──────────────────────┐  ┌────────────────────────┐  │  │
│  │ • Experiment Lab   │  │  │ 01. Experiment Lab   │  │ 02. Quality Inspector  │  │  │
│  │ • Quality Inspector│  │  │ Registry, 7-Step     │  │ Specimen Measurements, │  │  │
│  │ • Calibration      │  │  │ Wizard, Material &   │  │ 2D Layer/Bead Canvas,  │  │  │
│  │   Studio           │  │  │ Hardware Profiles,   │  │ Residual & Tolerance   │  │  │
│  │ • Process Explorer │  │  │ Baseline Comparison  │  │ Evaluator              │  │  │
│  │ • Research Library │  │  └──────────────────────┘  └────────────────────────┘  │  │
│  │ • Industry Metrics │  │  ┌──────────────────────┐  ┌────────────────────────┐  │  │
│  │ ────────────────── │  │  │ 03. Calibration      │  │ 04. Process Explorer   │  │  │
│  │ • Data Management  │  │  │     Studio           │  │ Layer & Time-Series    │  │  │
│  │ • Project Settings │  │  │ Session Bounds,      │  │ Telemetry, Toolpath    │  │  │
│  │ • System Status    │  │  │ Trial Log, Response  │  │ Deviation & Checkpoint │  │  │
│  │                    │  │  │ Curves & Recommender │  │ Correlation            │  │  │
│  │                    │  │  └──────────────────────┘  └────────────────────────┘  │  │
│  │                    │  │  ┌──────────────────────┐  ┌────────────────────────┐  │  │
│  │                    │  │  │ 05. Research Library │  │ 06. Industry Metrics   │  │  │
│  │                    │  │  │ Citations, Evidence  │  │ Yield, Waste, Cycle    │  │  │
│  │                    │  │  │ Level, Gap Matrix &  │  │ Duration, Energy &     │  │  │
│  │                    │  │  │ Experiment Links     │  │ Baseline Efficiency    │  │  │
│  │                    │  │  └──────────────────────┘  └────────────────────────┘  │  │
│  └────────────────────┘  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────┬────────────────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                 SCIENTIFIC DOMAIN & CALCULATION ENGINE (Pure TS + Zod)               │
│  • Residual & Tolerance Statistics (Mean, SD, RMSE, Max Deviation, Pass/Fail Rate)   │
│  • Checkpoint Calibration Solver (Parameter Bounds Check, Response Interpolation)    │
│  • Manufacturing Efficiency Evaluator (Yield %, Waste Ratio, Time & Cost Delta)      │
│  • CSV / JSON Dataset Parser, Checksum Generator & Schema Validator                  │
└─────────────────────────────────────────┬────────────────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│               REPOSITORY ABSTRACTION & INDEXEDDB PERSISTENCE ADAPTER                 │
│  Stores: Projects · MaterialProfiles · HardwareProfiles · Experiments ·              │
│          ProcessParameterSets · Measurements · ProcessObservations ·                 │
│          CalibrationSessions · CalibrationTrials · ResearchReferences ·              │
│          ProductionMetricRecords · FileDatasetMetadata · AuditEvents                 │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

All twelve domain entities use UUIDv4 identifiers, ISO-8601 timestamps, schema version tags, and referential integrity checks:

1. **Project**: Stores editable working thesis title, submitted abstract (empty until entered by researcher), research questions, hypotheses, objectives, and evaluation criteria.
2. **MaterialProfile**: Extensible key-value measured material properties with explicit units (e.g., moisture content `%`, yield stress `Pa`, nozzle temperature `°C`, auger RPM) supporting clay, ceramic, polymer, or custom materials.
3. **HardwareProfile**: Configurable equipment profiles supporting industrial robotic cells (ABB 120/140, pneumatic/pellet extruders) and desktop testbeds (FDM/FFF, syringe/auger) plus measurement instruments (digital calipers, RGB/RGB-D cameras, optical sensors) with explicit readiness status (`Planned`, `Available`, `Configured`, `Connected`).
4. **Experiment & ProcessParameterSet**: Links material and hardware profiles, method classification (`Fixed Baseline`, `Manual Recalibration`, `Feedforward Planning`, `Checkpoint Recalibration`), lifecycle status (`Planned`, `In Progress`, `Completed`, `Aborted`), and physical parameters (`printSpeedMmPerSec`, `relativeFlowPercent`, `volumetricFlowValue` + unit, `layerHeightMm`, `targetBeadWidthMm`, `nozzleDiameterMm`, `toolOrientation`).
5. **Measurement**: Specimen-level geometric records (`bead width`, `bead height`, `XYZ residual`, `surface deviation`, `dimensional error`, `custom`) with `measuredValue`, `targetValue`, `tolerance`, `unit`, `sourceType`, `coordinateFrame`, and `uncertaintyMetadata`.
6. **ProcessObservation**: Timestamped and `layerIndex` / `toolpathSegmentId`-indexed observations (`pressure`, `speed`, `flow`, `temperature`, `z-height`, `checkpoint-event`).
7. **CalibrationSession & CalibrationTrial**: Bounded optimization sessions referencing a baseline experiment, tracking sequential parameter sets, measured outcomes, and constraint statuses.
8. **ResearchReference, ProductionMetricRecord, FileDatasetMetadata & AuditEvent**: Complete traceability for literature citations, production efficiency comparisons, imported files with SHA-256 checksums, and an immutable change log.

### Interactive Component & State Mapping

- **Global Context & Cross-Module Navigation**: Selecting an active experiment in the top bar or clicking any experiment code in **Overview**, **Experiment Lab**, **Research Library**, or **Industry Metrics** deep-links directly into **Quality Inspector**, **Calibration Studio**, or **Process Explorer** pre-filtered to that experiment's parameter sets, measurements, and telemetry.
- **New Experiment 7-Step Wizard**: Step-by-step validated state machine allowing inline creation of Material or Hardware profiles if none exist, real-time unit validation, and immediate persistence to IndexedDB with an audit entry.
- **Interactive 2D Layer/Bead Cross-Section Visualizer**: Renders nominal target bead geometry (`targetBeadWidthMm` × `layerHeightMm`) overlaid with empirical measured cross-sections and XYZ toolpath residuals across layers, supporting layer scrubbing, zoom/pan, and crosshair probe inspection.
- **Data Management & Sample Dataset Loader**: Provides one-click loading of a clearly labeled sample MRAC dataset (comparing fixed-parameter clay/polymer runs against checkpoint-recalibrated runs), CSV/JSON file import with column mapping and schema validation, full JSON workspace export, and complete database clear with confirmation.
