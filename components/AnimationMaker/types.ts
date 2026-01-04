
export interface SavedProject {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
  date: number;
}

export type ViewState = 'dashboard' | 'create-details' | 'create-category' | 'builder';
export type RenderMode = 'blueprint' | 'realistic' | 'wireframe' | 'normal' | 'analysis' | 'overhang' | 'slicer' | 'heatmap';
export type Tab = 'tools' | 'material' | 'specs' | 'environment' | 'export' | 'print';
export type GizmoMode = 'translate' | 'rotate' | 'scale' | 'measure' | 'none';
export type PrinterPreset = 'ender3' | 'bambu' | 'prusa' | 'custom';
export type MaterialType = 'pla' | 'petg' | 'abs' | 'tpu';
export type UnitSystem = 'mm' | 'inch';

export interface CameraBookmark {
  id: string;
  name: string;
  position: { x: number, y: number, z: number };
  target: { x: number, y: number, z: number };
}

export interface MaterialConfig {
  color: string;
  metalness: number;
  roughness: number;
  wireframe: boolean;
}

export interface GeometrySpecs {
  width: number;
  height: number;
  depth: number;
  tris: number;
  manifold?: boolean;
}
