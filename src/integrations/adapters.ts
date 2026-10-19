import {
  Measurement,
  ProcessObservation,
  ProcessParameterSet,
} from '../domain/models';

/**
 * Platform-neutral integration contracts for external computational fabrication tools.
 *
 * Phase A Status: Offline file/schema contracts only.
 * Direct live hardware control or socket streaming is intentionally deferred.
 */

export interface ToolpathHeaderMetadata {
  generatorName: 'Grasshopper / Rhino' | 'Python Slicer' | 'RobotStudio / RAPID' | 'Desktop G-Code Slicer';
  generatorVersion: string;
  coordinateFrame: string;
  units: 'mm';
  totalLayers: number;
  estimatedDurationSec: number;
}

export interface ToolpathWaypoint {
  segmentId: string;
  layerIndex: number;
  xMm: number;
  yMm: number;
  zMm: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  targetSpeedMmPerSec: number;
  relativeFlowPercent: number;
  isCheckpointStop: boolean;
}

export interface GrasshopperIntegrationContract {
  contractVersion: '0.1.0';
  mode: 'File Exchange (JSON/CSV)';
  exportParameterSetToGrasshopperJson(params: ProcessParameterSet): string;
  parseGrasshopperToolpathJson(rawJson: string): {
    header: ToolpathHeaderMetadata;
    waypoints: ToolpathWaypoint[];
  };
}

export interface PythonAnalysisBridgeContract {
  contractVersion: '0.1.0';
  mode: 'Schema-Validated JSON / CSV Exchange';
  exportMeasurementsForPython(measurements: Measurement[]): string;
  importComputedMeasurementsFromPython(
    rawJson: string,
    experimentId: string
  ): Measurement[];
}

export interface OpticalMetrologyImportContract {
  contractVersion: '0.1.0';
  supportedModalities: Array<'Digital Caliper CSV' | 'Calibrated RGB Checkpoint' | 'RGB-D PointCloud Slice'>;
  requiresCoordinateFrameAlignment: true;
  requiresCalibrationReference: true;
}

export interface RobotControllerExportContract {
  contractVersion: '0.1.0';
  targetPlatform: 'ABB RAPID (IRB 120/140)' | 'Standard G-Code (Desktop Testbed)';
  liveConnectionSupportedInPhaseA: false;
  generateCheckpointParameterSnippet(
    params: ProcessParameterSet,
    checkpointLayer: number
  ): string;
}

export const PHASE_A_INTEGRATION_ADAPTERS: {
  grasshopper: GrasshopperIntegrationContract;
  robotExport: RobotControllerExportContract;
} = {
  grasshopper: {
    contractVersion: '0.1.0',
    mode: 'File Exchange (JSON/CSV)',
    exportParameterSetToGrasshopperJson(params: ProcessParameterSet): string {
      return JSON.stringify(
        {
          schema: 'fro.grasshopper.params.v1',
          exportedAt: new Date().toISOString(),
          units: {
            geometry: 'mm',
            speed: 'mm/s',
            relativeFlow: '%',
            volumetricFlow: params.volumetricFlowUnit,
          },
          parameters: {
            experimentId: params.experimentId,
            printSpeedMmPerSec: params.printSpeedMmPerSec,
            relativeFlowPercent: params.relativeFlowPercent,
            volumetricFlowValue: params.volumetricFlowValue,
            volumetricFlowUnit: params.volumetricFlowUnit,
            layerHeightMm: params.layerHeightMm,
            targetBeadWidthMm: params.targetBeadWidthMm,
            nozzleDiameterMm: params.nozzleDiameterMm,
            toolOrientation: params.toolOrientation,
            materialSpecificParameters: params.materialSpecificParameters,
          },
        },
        null,
        2
      );
    },
    parseGrasshopperToolpathJson(rawJson: string) {
      const parsed = JSON.parse(rawJson);
      return {
        header: parsed.header as ToolpathHeaderMetadata,
        waypoints: (parsed.waypoints || []) as ToolpathWaypoint[],
      };
    },
  },
  robotExport: {
    contractVersion: '0.1.0',
    targetPlatform: 'ABB RAPID (IRB 120/140)',
    liveConnectionSupportedInPhaseA: false,
    generateCheckpointParameterSnippet(
      params: ProcessParameterSet,
      checkpointLayer: number
    ): string {
      return [
        `! --- Fabrication Research OS v0.1.0 Offline Parameter Snippet ---`,
        `! Target Checkpoint Layer: ${checkpointLayer}`,
        `! Parameter Source: ${params.parameterSource}`,
        `! NOTE: Offline configuration snippet only. Verify bounds in RobotStudio before execution.`,
        ` PERS speeddata vPrintCheckpoint := [${params.printSpeedMmPerSec}, 50, 5000, 1000];`,
        ` PERS num nLayerHeightMm := ${params.layerHeightMm};`,
        ` PERS num nTargetBeadWidthMm := ${params.targetBeadWidthMm};`,
        ` PERS num nRelativeFlowPct := ${params.relativeFlowPercent};`,
        params.volumetricFlowValue !== null
          ? ` ! Physical Volumetric Rate: ${params.volumetricFlowValue} ${params.volumetricFlowUnit}`
          : ` ! Physical Volumetric Rate: Not characterized`,
      ].join('\n');
    },
  },
};

export interface IntegrationStatusDescriptor {
  id: string;
  name: string;
  category: 'CAD / Computational Design' | 'Robotic Motion Target' | 'Metrology & Vision' | 'Scientific Computing';
  phaseAStatus: 'Active Offline File Contract' | 'Planned Interface (Phase B)';
  protocolDescription: string;
  liveHardwareConnected: false;
}

export const INTEGRATION_REGISTRY: IntegrationStatusDescriptor[] = [
  {
    id: 'int-gh',
    name: 'Rhino / Grasshopper Parameter & Toolpath JSON Bridge',
    category: 'CAD / Computational Design',
    phaseAStatus: 'Active Offline File Contract',
    protocolDescription: 'Exports validated ProcessParameterSet JSON and imports layer waypoint tables.',
    liveHardwareConnected: false,
  },
  {
    id: 'int-abb',
    name: 'ABB RAPID (IRB 120 / 140) Checkpoint Snippet Exporter',
    category: 'Robotic Motion Target',
    phaseAStatus: 'Active Offline File Contract',
    protocolDescription: 'Generates offline RAPID speeddata and flow variables for manual verification.',
    liveHardwareConnected: false,
  },
  {
    id: 'int-gcode',
    name: 'Desktop FDM / Syringe Extrusion G-Code Parameter Header',
    category: 'Robotic Motion Target',
    phaseAStatus: 'Active Offline File Contract',
    protocolDescription: 'Generates annotated G-Code comment headers and M221/M220 checkpoint overrides.',
    liveHardwareConnected: false,
  },
  {
    id: 'int-rgbd',
    name: 'Calibrated RGB / RGB-D Optical Checkpoint Importer',
    category: 'Metrology & Vision',
    phaseAStatus: 'Planned Interface (Phase B)',
    protocolDescription: 'Requires extrinsic camera-to-robot frame calibration matrix and CSV/JSON profile import.',
    liveHardwareConnected: false,
  },
  {
    id: 'int-py',
    name: 'Python / SciPy Offline Metrology & Rheology Script Schema',
    category: 'Scientific Computing',
    phaseAStatus: 'Active Offline File Contract',
    protocolDescription: 'Exchanges schema-versioned CSV/JSON measurement and observation records.',
    liveHardwareConnected: false,
  },
];
