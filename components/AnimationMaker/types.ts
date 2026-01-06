
export interface SavedProject {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
  date: number;
  importedData?: string;
  importedType?: string;
}

export type ViewState = 'dashboard' | 'create-details' | 'create-category' | 'builder';
export type RenderMode = 'blueprint' | 'realistic' | 'wireframe' | 'normal' | 'analysis' | 'overhang' | 'slicer' | 'heatmap';
export type Tab = 'tools' | 'hierarchy' | 'material' | 'specs' | 'environment' | 'export' | 'print' | 'bookmarks' | 'parameters' | 'sketch' | 'history' | 'animator' | 'library';
export type GizmoMode = 'translate' | 'rotate' | 'scale' | 'measure' | 'none';
export type PrinterPreset = 'ender3' | 'bambu' | 'prusa' | 'custom';
export type MaterialType = 'pla' | 'petg' | 'abs' | 'tpu';
export type UnitSystem = 'mm' | 'inch';

export type WorkspaceMode = 
  | 'maker' 
  | 'designer' 
  | 'engineer' 
  | 'game_dev'
  | 'architect'
  | 'animator'
  | 'jewelry'
  | 'medical'
  | 'ecommerce'
  | 'sculptor'
  | 'automotive'
  | 'fashion'
  | 'education';

export interface CameraBookmark {
  id: string;
  name: string;
  position: { x: number, y: number, z: number };
  target: { x: number, y: number, z: number };
}

export interface TextureConfig {
  enabled: boolean;
  prompt: string;
  diffuseMap?: string;      // Base64 or URL
  normalMap?: string;
  roughnessMap?: string;
  metalnessMap?: string;
  aoMap?: string;           // Ambient occlusion
  repeatX: number;
  repeatY: number;
  rotation: number;         // In degrees
}

export interface MaterialConfig {
  color: string;
  metalness: number;
  roughness: number;
  wireframe: boolean;
  texture?: TextureConfig;  // NEW: AI-generated texture support
}

export interface GeometrySpecs {
  width: number;
  height: number;
  depth: number;
  tris: number;
  manifold?: boolean;
}

export interface ParameterControl {
  name: string;
  value: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  type: 'number' | 'boolean' | 'string' | 'color' | 'button';
  folder?: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  prompt: string; // The user intent that created this state
  codeSnapshot: string;
}
