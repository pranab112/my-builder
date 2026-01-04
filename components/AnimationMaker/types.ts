
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
export type Tab = 'tools' | 'hierarchy' | 'material' | 'specs' | 'environment' | 'export' | 'print' | 'bookmarks';
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
