
import { create } from 'zustand';
import { Tab, RenderMode, GizmoMode, PrinterPreset, MaterialType, MaterialConfig, GeometrySpecs, SavedProject, UnitSystem, CameraBookmark } from '../components/AnimationMaker/types';

interface BuilderState {
  // Project Data
  prompt: string;
  htmlCode: string | null;
  history: string[];
  historyIndex: number;
  refImages: string[];
  
  // UI State
  activeTab: Tab;
  showCode: boolean;
  codeEdits: string;
  isFullScreen: boolean;
  isGenerating: boolean;
  isEnhancing: boolean;
  isFixing: boolean;
  error: string | null;
  runtimeError: string | null;
  
  // Overlays
  isCommandPaletteOpen: boolean;
  isHelpOpen: boolean;

  // 3D Environment State
  renderMode: RenderMode;
  showGrid: boolean;
  gizmoMode: GizmoMode;
  turntableActive: boolean;
  clippingValue: number;
  environment: 'studio' | 'sunset' | 'dark' | 'park' | 'lobby';
  isRecording: boolean;
  
  // Assembly / Scene Graph
  sceneGraph: { id: string, name: string, type: string, visible: boolean, selected: boolean }[];
  selectedObjectIds: string[];
  
  // Modeling Tools
  booleanOp: 'union' | 'subtract' | 'intersect' | null;
  booleanTarget: string | null;

  // Engineering & Printing
  units: UnitSystem;
  printerPreset: PrinterPreset;
  materialType: MaterialType;
  infillPercentage: number;
  slicerLayer: number;
  showSupports: boolean;
  materialConfig: MaterialConfig;
  specs: GeometrySpecs | null;
  
  // Bookmarks
  bookmarks: CameraBookmark[];

  // Actions
  setPrompt: (prompt: string) => void;
  setRefImages: (images: string[]) => void;
  setHtmlCode: (code: string, addToHistory?: boolean) => void;
  setCodeEdits: (code: string) => void;
  undo: () => void;
  redo: () => void;
  
  // UI Actions
  setActiveTab: (tab: Tab) => void;
  setShowCode: (show: boolean) => void;
  toggleFullScreen: () => void;
  setGenerating: (isGenerating: boolean) => void;
  setEnhancing: (isEnhancing: boolean) => void;
  setFixing: (isFixing: boolean) => void;
  setError: (error: string | null) => void;
  setRuntimeError: (error: string | null) => void;
  
  setCommandPaletteOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;

  // 3D Actions
  setRenderMode: (mode: RenderMode) => void;
  toggleGrid: () => void;
  setGizmoMode: (mode: GizmoMode) => void;
  setTurntableActive: (turntableActive) => void;
  setClippingValue: (clippingValue) => void;
  setEnvironment: (environment: 'studio' | 'sunset' | 'dark' | 'park' | 'lobby') => void;
  setIsRecording: (isRecording: boolean) => void;
  
  setSceneGraph: (graph: any[]) => void;
  setSelectedObjectIds: (ids: string[]) => void;
  
  setBooleanOp: (op: 'union' | 'subtract' | 'intersect' | null) => void;
  setBooleanTarget: (id: string | null) => void;

  setUnits: (units: UnitSystem) => void;
  setPrinterPreset: (printerPreset: PrinterPreset) => void;
  setMaterialType: (materialType: MaterialType) => void;
  setInfillPercentage: (infillPercentage: number) => void;
  setSlicerLayer: (slicerLayer: number) => void;
  setShowSupports: (showSupports: boolean) => void;
  
  setMaterialConfig: (config: MaterialConfig | ((prev: MaterialConfig) => MaterialConfig)) => void;
  
  setSpecs: (specs: GeometrySpecs | null) => void;
  
  addBookmark: (bookmark: CameraBookmark) => void;
  removeBookmark: (id: string) => void;

  resetStore: () => void;
  
  loadProject: (project: SavedProject) => void;
}

const DEFAULT_MATERIAL: MaterialConfig = {
    color: '#e0e0e0',
    metalness: 0.1,
    roughness: 0.5,
    wireframe: false
};

const MAX_HISTORY_LENGTH = 15;

// HELPER: Input Sanitization
const clamp = (num: any, min: number, max: number, def: number): number => {
    const val = parseFloat(num);
    if (isNaN(val) || !isFinite(val)) return def;
    return Math.min(Math.max(val, min), max);
};

const initialState = {
    prompt: '',
    htmlCode: null,
    history: [],
    historyIndex: -1,
    refImages: [],
    
    activeTab: 'tools' as Tab,
    showCode: false,
    codeEdits: '',
    isFullScreen: false,
    isGenerating: false,
    isEnhancing: false,
    isFixing: false,
    error: null,
    runtimeError: null,
    
    isCommandPaletteOpen: false,
    isHelpOpen: false,

    renderMode: 'blueprint' as RenderMode,
    showGrid: true,
    gizmoMode: 'none' as GizmoMode,
    turntableActive: false,
    clippingValue: 0,
    environment: 'studio' as 'studio' | 'sunset' | 'dark' | 'park' | 'lobby',
    isRecording: false,
    
    sceneGraph: [],
    selectedObjectIds: [],
    
    booleanOp: null as any,
    booleanTarget: null,

    units: 'mm' as UnitSystem,
    printerPreset: 'ender3' as PrinterPreset,
    materialType: 'pla' as MaterialType,
    infillPercentage: 20,
    slicerLayer: 100,
    showSupports: false,
    materialConfig: DEFAULT_MATERIAL,
    specs: null,
    bookmarks: []
};

export const useBuilderStore = create<BuilderState>((set, get) => ({
  ...initialState,

  setPrompt: (prompt) => set({ prompt }),
  setRefImages: (refImages) => set({ refImages }),
  
  setHtmlCode: (code, addToHistory = true) => {
      const { history, historyIndex } = get();
      if (!addToHistory) {
          set({ htmlCode: code, codeEdits: code });
          return;
      }
      
      let newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(code);
      
      if (newHistory.length > MAX_HISTORY_LENGTH) {
          newHistory = newHistory.slice(newHistory.length - MAX_HISTORY_LENGTH);
      }
      
      set({ 
          htmlCode: code, 
          codeEdits: code,
          history: newHistory, 
          historyIndex: newHistory.length - 1,
          error: null,
          runtimeError: null
      });
  },

  setCodeEdits: (codeEdits) => set({ codeEdits }),

  undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          set({ 
              historyIndex: newIndex, 
              htmlCode: history[newIndex],
              codeEdits: history[newIndex],
              runtimeError: null 
          });
      }
  },

  redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          set({ 
              historyIndex: newIndex, 
              htmlCode: history[newIndex],
              codeEdits: history[newIndex],
              runtimeError: null 
          });
      }
  },

  setActiveTab: (activeTab) => set({ activeTab }),
  setShowCode: (showCode) => set({ showCode }),
  toggleFullScreen: () => set((state) => ({ isFullScreen: !state.isFullScreen })),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setEnhancing: (isEnhancing) => set({ isEnhancing }),
  setFixing: (isFixing) => set({ isFixing }),
  setError: (error) => set({ error }),
  setRuntimeError: (runtimeError) => set({ runtimeError }),
  
  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
  setHelpOpen: (isHelpOpen) => set({ isHelpOpen }),

  setRenderMode: (renderMode) => set({ renderMode }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  setTurntableActive: (turntableActive) => set({ turntableActive }),
  setClippingValue: (val) => set({ clippingValue: clamp(val, -100, 100, 0) }), // Validation
  setEnvironment: (environment) => set({ environment }),
  setIsRecording: (isRecording) => set({ isRecording }),
  
  setSceneGraph: (sceneGraph) => set({ sceneGraph }),
  setSelectedObjectIds: (selectedObjectIds) => set({ selectedObjectIds }),
  
  setBooleanOp: (booleanOp) => set({ booleanOp }),
  setBooleanTarget: (booleanTarget) => set({ booleanTarget }),

  setUnits: (units) => set({ units }),
  setPrinterPreset: (printerPreset) => set({ printerPreset }),
  setMaterialType: (materialType) => set({ materialType }),
  setInfillPercentage: (val) => set({ infillPercentage: clamp(val, 0, 100, 20) }), // Validation
  setSlicerLayer: (val) => set({ slicerLayer: clamp(val, 0, 100, 100) }), // Validation
  setShowSupports: (showSupports) => set({ showSupports }),
  
  setMaterialConfig: (config) => set((state) => ({
      materialConfig: typeof config === 'function' ? config(state.materialConfig) : config
  })),
  
  setSpecs: (specs) => set({ specs }), // Spec validation could be added here if needed, but it comes from internal geometry calculation usually
  
  addBookmark: (bookmark) => set((state) => ({ bookmarks: [...state.bookmarks, bookmark] })),
  removeBookmark: (id) => set((state) => ({ bookmarks: state.bookmarks.filter(b => b.id !== id) })),

  resetStore: () => set(initialState),
  
  loadProject: (project) => {
      set({
          ...initialState,
          prompt: project.description || '',
          htmlCode: project.code || null,
          codeEdits: project.code || '',
          history: project.code ? [project.code] : [],
          historyIndex: project.code ? 0 : -1,
      });
  }
}));
