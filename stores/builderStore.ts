
import { create } from 'zustand';
import { Tab, RenderMode, GizmoMode, PrinterPreset, MaterialType, MaterialConfig, GeometrySpecs, SavedProject, UnitSystem, CameraBookmark, ParameterControl, HistoryEntry } from '../components/AnimationMaker/types';

// Helper to clamp values
const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

// Validation report type for AI-generated code
export interface ValidationReport {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  stats: {
    linesOfCode: number;
    complexity: 'low' | 'medium' | 'high';
  };
  timestamp: number;
}

// Fix attempt tracking for smart auto-fix
export interface FixAttempt {
  id: string;
  timestamp: number;
  errorBefore: string;
  errorAfter: string | null;  // null = fix succeeded
  fixDescription: string;
  codeSnapshot: string;  // Code before fix (for revert)
}

const initialState = {
  prompt: '',
  htmlCode: null as string | null,
  history: [] as string[], // Raw code history for undo/redo
  historyEntries: [] as HistoryEntry[], // Meta history for the Tree View
  historyIndex: -1,
  refImages: [] as string[],
  
  activeTab: 'tools' as Tab,
  showCode: false,
  codeEdits: '',
  isFullScreen: false,
  isGenerating: false,
  isEnhancing: false,
  isFixing: false,
  autoDebug: false, // New State
  error: null as string | null,
  runtimeError: null as string | null,
  validationReport: null as ValidationReport | null,
  fixAttempts: [] as FixAttempt[],
  lastSuccessfulCode: null as string | null,  // For revert on fix failure

  isCommandPaletteOpen: false,
  isHelpOpen: false,

  renderMode: 'normal' as RenderMode,
  showGrid: true,
  gizmoMode: 'none' as GizmoMode,
  turntableActive: false,
  clippingValue: 0,
  environment: 'studio' as 'studio' | 'sunset' | 'dark' | 'park' | 'lobby',
  isRecording: false,
  
  sceneGraph: [] as { id: string, name: string, type: string, visible: boolean, selected: boolean }[],
  selectedObjectIds: [] as string[],
  
  parameters: [] as ParameterControl[],
  
  booleanOp: null as 'union' | 'subtract' | 'intersect' | null,
  booleanTarget: null as string | null,

  units: 'mm' as UnitSystem,
  printerPreset: 'ender3' as PrinterPreset,
  materialType: 'pla' as MaterialType,
  infillPercentage: 20,
  slicerLayer: 100,
  showSupports: false,
  materialConfig: { color: '#ffffff', metalness: 0.5, roughness: 0.5, wireframe: false } as MaterialConfig,
  specs: null as GeometrySpecs | null,
  
  bookmarks: [] as CameraBookmark[],
};

interface BuilderState {
  // Data
  prompt: string;
  htmlCode: string | null;
  history: string[];
  historyEntries: HistoryEntry[];
  historyIndex: number;
  refImages: string[];
  
  // UI
  activeTab: Tab;
  showCode: boolean;
  codeEdits: string;
  isFullScreen: boolean;
  isGenerating: boolean;
  isEnhancing: boolean;
  isFixing: boolean;
  autoDebug: boolean;
  error: string | null;
  runtimeError: string | null;
  validationReport: ValidationReport | null;
  fixAttempts: FixAttempt[];
  lastSuccessfulCode: string | null;

  isCommandPaletteOpen: boolean;
  isHelpOpen: boolean;

  // 3D
  renderMode: RenderMode;
  showGrid: boolean;
  gizmoMode: GizmoMode;
  turntableActive: boolean;
  clippingValue: number;
  environment: 'studio' | 'sunset' | 'dark' | 'park' | 'lobby';
  isRecording: boolean;
  
  sceneGraph: { id: string, name: string, type: string, visible: boolean, selected: boolean }[];
  selectedObjectIds: string[];
  
  parameters: ParameterControl[];
  
  booleanOp: 'union' | 'subtract' | 'intersect' | null;
  booleanTarget: string | null;

  units: UnitSystem;
  printerPreset: PrinterPreset;
  materialType: MaterialType;
  infillPercentage: number;
  slicerLayer: number;
  showSupports: boolean;
  materialConfig: MaterialConfig;
  specs: GeometrySpecs | null;
  
  bookmarks: CameraBookmark[];

  // Actions
  setPrompt: (prompt: string) => void;
  setRefImages: (images: string[]) => void;
  setHtmlCode: (code: string, addToHistory?: boolean, promptContext?: string) => void;
  restoreHistoryEntry: (entry: HistoryEntry) => void;
  setCodeEdits: (code: string) => void;
  undo: () => void;
  redo: () => void;
  
  setActiveTab: (tab: Tab) => void;
  setShowCode: (show: boolean) => void;
  toggleFullScreen: () => void;
  setGenerating: (isGenerating: boolean) => void;
  setEnhancing: (isEnhancing: boolean) => void;
  setFixing: (isFixing: boolean) => void;
  toggleAutoDebug: () => void;
  setError: (error: string | null) => void;
  setRuntimeError: (error: string | null) => void;
  setValidationReport: (report: ValidationReport | null) => void;
  addFixAttempt: (attempt: FixAttempt) => void;
  updateFixAttemptResult: (id: string, errorAfter: string | null) => void;
  clearFixAttempts: () => void;
  setLastSuccessfulCode: (code: string | null) => void;
  revertToLastSuccessful: () => void;

  setCommandPaletteOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;

  setRenderMode: (mode: RenderMode) => void;
  toggleGrid: () => void;
  setGizmoMode: (mode: GizmoMode) => void;
  setTurntableActive: (active: boolean) => void;
  setClippingValue: (val: number) => void;
  setEnvironment: (env: any) => void;
  setIsRecording: (isRecording: boolean) => void;
  
  setSceneGraph: (graph: any[]) => void;
  setSelectedObjectIds: (ids: string[]) => void;
  
  setParameters: (parameters: ParameterControl[]) => void;
  updateParameter: (name, value) => void;
  
  setBooleanOp: (op: 'union' | 'subtract' | 'intersect' | null) => void;
  setBooleanTarget: (target: string | null) => void;

  setUnits: (units) => void;
  setPrinterPreset: (preset: PrinterPreset) => void;
  setMaterialType: (type: MaterialType) => void;
  setInfillPercentage: (val: number) => void;
  setSlicerLayer: (val: number) => void;
  setShowSupports: (show: boolean) => void;
  
  setMaterialConfig: (config: Partial<MaterialConfig> | ((prev: MaterialConfig) => MaterialConfig)) => void;
  
  setSpecs: (specs: GeometrySpecs | null) => void;
  
  addBookmark: (bookmark: CameraBookmark) => void;
  removeBookmark: (id: string) => void;

  resetStore: () => void;
  loadProject: (project: SavedProject) => void;
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  ...initialState,

  setPrompt: (prompt) => set({ prompt }),
  setRefImages: (refImages) => set({ refImages }),
  
  setHtmlCode: (htmlCode, addToHistory = false, promptContext = "Manual Edit") => set((state) => {
    if (addToHistory && htmlCode) {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(htmlCode);
      
      const newEntry: HistoryEntry = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          prompt: promptContext,
          codeSnapshot: htmlCode
      };
      
      return { 
        htmlCode, 
        codeEdits: htmlCode, 
        history: newHistory, 
        historyIndex: newHistory.length - 1, 
        historyEntries: [newEntry, ...state.historyEntries], // Newest first
        error: null 
      };
    }
    return { htmlCode, codeEdits: htmlCode || '' };
  }),

  restoreHistoryEntry: (entry) => set((state) => {
      // Find this code in the undo stack if possible, or just push a new state
      const codeIndex = state.history.indexOf(entry.codeSnapshot);
      let newHistoryIndex = codeIndex;
      let newHistory = state.history;
      
      if (codeIndex === -1) {
          // If lost from stack, push it as new head
          newHistory = [...state.history.slice(0, state.historyIndex + 1), entry.codeSnapshot];
          newHistoryIndex = newHistory.length - 1;
      }

      return {
          htmlCode: entry.codeSnapshot,
          codeEdits: entry.codeSnapshot,
          history: newHistory,
          historyIndex: newHistoryIndex,
          error: null
      };
  }),

  setCodeEdits: (codeEdits) => set({ codeEdits }),
  undo: () => set((state) => {
    if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        return { 
            historyIndex: newIndex, 
            htmlCode: state.history[newIndex], 
            codeEdits: state.history[newIndex] 
        };
    }
    return {};
  }),
  redo: () => set((state) => {
    if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        return { 
            historyIndex: newIndex, 
            htmlCode: state.history[newIndex], 
            codeEdits: state.history[newIndex] 
        };
    }
    return {};
  }),

  setActiveTab: (activeTab) => set({ activeTab }),
  setShowCode: (showCode) => set({ showCode }),
  toggleFullScreen: () => set((state) => ({ isFullScreen: !state.isFullScreen })),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setEnhancing: (isEnhancing) => set({ isEnhancing }),
  setFixing: (isFixing) => set({ isFixing }),
  toggleAutoDebug: () => set((state) => ({ autoDebug: !state.autoDebug })),
  setError: (error) => set({ error }),
  setRuntimeError: (runtimeError) => set({ runtimeError }),
  setValidationReport: (validationReport) => set({ validationReport }),
  addFixAttempt: (attempt) => set((state) => ({
    fixAttempts: [...state.fixAttempts.slice(-9), attempt]  // Keep last 10
  })),
  updateFixAttemptResult: (id, errorAfter) => set((state) => ({
    fixAttempts: state.fixAttempts.map(a =>
      a.id === id ? { ...a, errorAfter } : a
    )
  })),
  clearFixAttempts: () => set({ fixAttempts: [] }),
  setLastSuccessfulCode: (lastSuccessfulCode) => set({ lastSuccessfulCode }),
  revertToLastSuccessful: () => set((state) => {
    if (state.lastSuccessfulCode) {
      return {
        htmlCode: state.lastSuccessfulCode,
        codeEdits: state.lastSuccessfulCode,
        runtimeError: null,
        error: 'Reverted to last working version'
      };
    }
    return {};
  }),

  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
  setHelpOpen: (isHelpOpen) => set({ isHelpOpen }),

  setRenderMode: (renderMode) => set({ renderMode }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  setTurntableActive: (turntableActive) => set({ turntableActive }),
  setClippingValue: (clippingValue) => set({ clippingValue }),
  setEnvironment: (environment) => set({ environment }),
  setIsRecording: (isRecording) => set({ isRecording }),
  
  setSceneGraph: (sceneGraph) => set({ sceneGraph }),
  setSelectedObjectIds: (selectedObjectIds) => set({ selectedObjectIds }),
  
  setParameters: (parameters) => set({ parameters }),
  updateParameter: (name, value) => set((state) => ({
      parameters: state.parameters.map((p) => p.name === name ? { ...p, value } : p)
  })),
  
  setBooleanOp: (booleanOp) => set({ booleanOp }),
  setBooleanTarget: (booleanTarget) => set({ booleanTarget }),

  setUnits: (units) => set({ units }),
  setPrinterPreset: (printerPreset) => set({ printerPreset }),
  setMaterialType: (materialType) => set({ materialType }),
  setInfillPercentage: (val) => set({ infillPercentage: clamp(val, 0, 100) }),
  setSlicerLayer: (val) => set({ slicerLayer: clamp(val, 0, 100) }),
  setShowSupports: (showSupports) => set({ showSupports }),
  
  setMaterialConfig: (config) => set((state) => ({
      materialConfig: typeof config === 'function' ? config(state.materialConfig) : { ...state.materialConfig, ...config }
  })),
  
  setSpecs: (specs) => set({ specs }),
  
  addBookmark: (bookmark) => set((state) => ({ bookmarks: [...state.bookmarks, bookmark] })),
  removeBookmark: (id) => set((state) => ({ bookmarks: state.bookmarks.filter(b => b.id !== id) })),

  resetStore: () => set(initialState),
  
  loadProject: (project) => {
      // Create an initial history entry for the loaded state
      const initialEntry: HistoryEntry = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          prompt: "Project Loaded",
          codeSnapshot: project.code
      };

      set({
          ...initialState,
          prompt: project.description || '',
          htmlCode: project.code || null,
          codeEdits: project.code || '',
          history: project.code ? [project.code] : [],
          historyIndex: project.code ? 0 : -1,
          historyEntries: project.code ? [initialEntry] : []
      });
  }
}));
