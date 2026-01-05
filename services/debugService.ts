
/**
 * 3D Builder Debug Service
 *
 * Comprehensive debugging infrastructure for the 3D Builder section.
 * Tracks data flow across all components before and after generation.
 */

// Debug Levels
export type DebugLevel = 'off' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

// Debug Categories
export type DebugCategory =
  | 'input'           // User input, prompts, images
  | 'generation'      // AI code generation
  | 'render'          // Iframe rendering
  | 'message'         // PostMessage communication
  | 'state'           // Store state changes
  | 'interaction'     // Panel interactions
  | 'export'          // Export operations
  | 'error'           // Runtime errors
  | 'performance';    // Performance metrics

interface DebugEntry {
  timestamp: number;
  category: DebugCategory;
  level: DebugLevel;
  section: string;
  action: string;
  data?: any;
  duration?: number;
  correlationId?: string;
}

interface PerformanceMarker {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class DebugService {
  private static instance: DebugService;
  private enabled: boolean = false;
  private level: DebugLevel = 'info';
  private logs: DebugEntry[] = [];
  private maxLogs: number = 1000;
  private performanceMarkers: Map<string, PerformanceMarker> = new Map();
  private correlationStack: string[] = [];
  private listeners: ((entry: DebugEntry) => void)[] = [];

  private constructor() {
    // Check localStorage for debug settings
    if (typeof window !== 'undefined') {
      this.enabled = localStorage.getItem('proshot_debug') === 'true';
      this.level = (localStorage.getItem('proshot_debug_level') as DebugLevel) || 'info';
    }
  }

  static getInstance(): DebugService {
    if (!DebugService.instance) {
      DebugService.instance = new DebugService();
    }
    return DebugService.instance;
  }

  // Enable/Disable debugging
  enable(level: DebugLevel = 'info'): void {
    this.enabled = true;
    this.level = level;
    localStorage.setItem('proshot_debug', 'true');
    localStorage.setItem('proshot_debug_level', level);
    console.log(`🐛 [Debug] Enabled at level: ${level}`);
  }

  disable(): void {
    this.enabled = false;
    localStorage.setItem('proshot_debug', 'false');
    console.log('🐛 [Debug] Disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Correlation ID management for tracing flows
  startCorrelation(name: string): string {
    const id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.correlationStack.push(id);
    return id;
  }

  endCorrelation(): void {
    this.correlationStack.pop();
  }

  getCurrentCorrelation(): string | undefined {
    return this.correlationStack[this.correlationStack.length - 1];
  }

  // Level comparison
  private shouldLog(level: DebugLevel): boolean {
    if (!this.enabled) return false;
    const levels: DebugLevel[] = ['off', 'error', 'warn', 'info', 'debug', 'trace'];
    return levels.indexOf(level) <= levels.indexOf(this.level);
  }

  // Core logging method
  private log(entry: Omit<DebugEntry, 'timestamp' | 'correlationId'>): void {
    if (!this.shouldLog(entry.level)) return;

    const fullEntry: DebugEntry = {
      ...entry,
      timestamp: Date.now(),
      correlationId: this.getCurrentCorrelation()
    };

    this.logs.push(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with styling
    const color = this.getCategoryColor(entry.category);
    const levelIcon = this.getLevelIcon(entry.level);

    console.groupCollapsed(
      `${levelIcon} [${entry.category.toUpperCase()}] ${entry.section} → ${entry.action}`,
      `color: ${color}; font-weight: bold;`
    );
    console.log('Timestamp:', new Date(fullEntry.timestamp).toISOString());
    if (fullEntry.correlationId) console.log('Correlation:', fullEntry.correlationId);
    if (entry.data !== undefined) console.log('Data:', entry.data);
    if (entry.duration !== undefined) console.log('Duration:', `${entry.duration}ms`);
    console.groupEnd();

    // Notify listeners
    this.listeners.forEach(fn => fn(fullEntry));
  }

  private getCategoryColor(category: DebugCategory): string {
    const colors: Record<DebugCategory, string> = {
      input: '#10b981',      // emerald
      generation: '#6366f1', // indigo
      render: '#f59e0b',     // amber
      message: '#8b5cf6',    // violet
      state: '#3b82f6',      // blue
      interaction: '#ec4899', // pink
      export: '#14b8a6',     // teal
      error: '#ef4444',      // red
      performance: '#f97316' // orange
    };
    return colors[category];
  }

  private getLevelIcon(level: DebugLevel): string {
    const icons: Record<DebugLevel, string> = {
      off: '',
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🐛',
      trace: '📍'
    };
    return icons[level];
  }

  // Performance tracking
  startMark(name: string): void {
    if (!this.enabled) return;
    this.performanceMarkers.set(name, {
      name,
      startTime: performance.now()
    });
  }

  endMark(name: string): number | null {
    if (!this.enabled) return null;
    const marker = this.performanceMarkers.get(name);
    if (!marker) return null;

    marker.endTime = performance.now();
    marker.duration = marker.endTime - marker.startTime;

    this.log({
      category: 'performance',
      level: 'debug',
      section: 'Performance',
      action: name,
      duration: marker.duration
    });

    return marker.duration;
  }

  // Subscribe to debug events
  subscribe(callback: (entry: DebugEntry) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(fn => fn !== callback);
    };
  }

  // Get logs
  getLogs(filter?: { category?: DebugCategory; section?: string; correlationId?: string }): DebugEntry[] {
    if (!filter) return [...this.logs];

    return this.logs.filter(entry => {
      if (filter.category && entry.category !== filter.category) return false;
      if (filter.section && entry.section !== filter.section) return false;
      if (filter.correlationId && entry.correlationId !== filter.correlationId) return false;
      return true;
    });
  }

  clearLogs(): void {
    this.logs = [];
  }

  // Export logs
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // ============================================
  // SECTION-SPECIFIC DEBUG METHODS
  // ============================================

  // === PRE-GENERATION FLOW ===

  // InputPanel debugging
  inputPromptChanged(prompt: string, hasImages: boolean): void {
    this.log({
      category: 'input',
      level: 'debug',
      section: 'InputPanel',
      action: 'Prompt Changed',
      data: { promptLength: prompt.length, hasImages, preview: prompt.substring(0, 100) }
    });
  }

  inputImageAdded(imageCount: number, imageSize?: number): void {
    this.log({
      category: 'input',
      level: 'info',
      section: 'InputPanel',
      action: 'Image Added',
      data: { imageCount, imageSize }
    });
  }

  inputTemplateSelected(templateName: string, promptGenerated: string): void {
    this.log({
      category: 'input',
      level: 'info',
      section: 'InputPanel',
      action: 'Template Selected',
      data: { templateName, promptLength: promptGenerated.length }
    });
  }

  inputSuggestionApplied(suggestion: string): void {
    this.log({
      category: 'input',
      level: 'debug',
      section: 'InputPanel',
      action: 'Suggestion Applied',
      data: { suggestion }
    });
  }

  inputEnhanceStarted(originalPrompt: string): void {
    this.startMark('enhance-prompt');
    this.log({
      category: 'input',
      level: 'info',
      section: 'InputPanel',
      action: 'Enhance Started',
      data: { originalLength: originalPrompt.length }
    });
  }

  inputEnhanceCompleted(enhancedPrompt: string): void {
    const duration = this.endMark('enhance-prompt');
    this.log({
      category: 'input',
      level: 'info',
      section: 'InputPanel',
      action: 'Enhance Completed',
      data: { enhancedLength: enhancedPrompt.length },
      duration: duration || undefined
    });
  }

  // === GENERATION FLOW ===

  generationStarted(params: { prompt: string; hasExistingCode: boolean; hasImage: boolean; category: string; mode: string }): void {
    this.startCorrelation('generation');
    this.startMark('generation-total');
    this.log({
      category: 'generation',
      level: 'info',
      section: 'Builder',
      action: 'Generation Started',
      data: params
    });
  }

  generationAPICall(model: string, systemPromptLength: number, contentLength: number): void {
    this.startMark('generation-api');
    this.log({
      category: 'generation',
      level: 'debug',
      section: 'GeminiService',
      action: 'API Call Started',
      data: { model, systemPromptLength, contentLength }
    });
  }

  generationAPIResponse(responseLength: number, hasError: boolean): void {
    const duration = this.endMark('generation-api');
    this.log({
      category: 'generation',
      level: hasError ? 'error' : 'info',
      section: 'GeminiService',
      action: 'API Response Received',
      data: { responseLength, hasError },
      duration: duration || undefined
    });
  }

  generationCompleted(codeLength: number): void {
    const duration = this.endMark('generation-total');
    this.log({
      category: 'generation',
      level: 'info',
      section: 'Builder',
      action: 'Generation Completed',
      data: { codeLength },
      duration: duration || undefined
    });
    this.endCorrelation();
  }

  generationFailed(error: string): void {
    this.endMark('generation-total');
    this.log({
      category: 'generation',
      level: 'error',
      section: 'Builder',
      action: 'Generation Failed',
      data: { error }
    });
    this.endCorrelation();
  }

  // === POST-GENERATION / RENDER FLOW ===

  renderIframeLoading(codeLength: number): void {
    this.startMark('iframe-load');
    this.log({
      category: 'render',
      level: 'debug',
      section: 'Viewport',
      action: 'Iframe Loading',
      data: { codeLength }
    });
  }

  renderDriverInjected(): void {
    this.log({
      category: 'render',
      level: 'debug',
      section: 'Viewport',
      action: 'Driver Script Injected'
    });
  }

  renderSceneDetected(hasScene: boolean, hasCamera: boolean, hasRenderer: boolean): void {
    const duration = this.endMark('iframe-load');
    this.log({
      category: 'render',
      level: 'info',
      section: 'Driver',
      action: 'Scene Detection',
      data: { hasScene, hasCamera, hasRenderer },
      duration: duration || undefined
    });
  }

  renderLightsAutoInjected(count: number): void {
    this.log({
      category: 'render',
      level: 'info',
      section: 'Driver',
      action: 'Lights Auto-Injected',
      data: { count }
    });
  }

  renderToolsInitialized(): void {
    this.log({
      category: 'render',
      level: 'debug',
      section: 'Driver',
      action: 'Tools Initialized (TransformControls, CSG)'
    });
  }

  // === MESSAGE PASSING ===

  messageToIframe(type: string, data?: any): void {
    this.log({
      category: 'message',
      level: 'trace',
      section: 'React→Iframe',
      action: type,
      data: data ? JSON.stringify(data).substring(0, 200) : undefined
    });
  }

  messageFromIframe(type: string, data?: any): void {
    this.log({
      category: 'message',
      level: 'trace',
      section: 'Iframe→React',
      action: type,
      data: data ? JSON.stringify(data).substring(0, 200) : undefined
    });
  }

  // === STATE CHANGES ===

  stateChanged(storeName: string, action: string, prevValue: any, newValue: any): void {
    this.log({
      category: 'state',
      level: 'debug',
      section: storeName,
      action: action,
      data: {
        prev: typeof prevValue === 'object' ? '[Object]' : prevValue,
        next: typeof newValue === 'object' ? '[Object]' : newValue
      }
    });
  }

  stateHistoryUpdated(historyLength: number, historyIndex: number): void {
    this.log({
      category: 'state',
      level: 'debug',
      section: 'BuilderStore',
      action: 'History Updated',
      data: { historyLength, historyIndex }
    });
  }

  // === PANEL INTERACTIONS ===

  panelTabChanged(from: string, to: string): void {
    this.log({
      category: 'interaction',
      level: 'debug',
      section: 'Panels',
      action: 'Tab Changed',
      data: { from, to }
    });
  }

  panelToolClicked(toolName: string, toolPrompt: string): void {
    this.log({
      category: 'interaction',
      level: 'info',
      section: 'Panels',
      action: 'Tool Clicked',
      data: { toolName, promptPreview: toolPrompt.substring(0, 50) }
    });
  }

  panelPrimitiveAdded(type: string): void {
    this.log({
      category: 'interaction',
      level: 'info',
      section: 'Panels',
      action: 'Primitive Added',
      data: { type }
    });
  }

  panelBooleanStarted(operation: string, targetId: string): void {
    this.log({
      category: 'interaction',
      level: 'info',
      section: 'Panels',
      action: 'Boolean Operation Started',
      data: { operation, targetId }
    });
  }

  panelBooleanCompleted(operation: string, success: boolean): void {
    this.log({
      category: 'interaction',
      level: success ? 'info' : 'error',
      section: 'Panels',
      action: 'Boolean Operation Completed',
      data: { operation, success }
    });
  }

  panelParameterChanged(name: string, value: any): void {
    this.log({
      category: 'interaction',
      level: 'debug',
      section: 'Panels',
      action: 'Parameter Changed',
      data: { name, value }
    });
  }

  panelSketchExtruded(pointCount: number, height: number): void {
    this.log({
      category: 'interaction',
      level: 'info',
      section: 'Panels',
      action: 'Sketch Extruded',
      data: { pointCount, height }
    });
  }

  panelHistoryRestored(entryId: string, prompt: string): void {
    this.log({
      category: 'interaction',
      level: 'info',
      section: 'Panels',
      action: 'History Restored',
      data: { entryId, promptPreview: prompt.substring(0, 50) }
    });
  }

  panelObjectSelected(objectId: string | null, objectName?: string): void {
    this.log({
      category: 'interaction',
      level: 'debug',
      section: 'Panels',
      action: 'Object Selected',
      data: { objectId, objectName }
    });
  }

  // === EXPORT ===

  exportStarted(format: string): void {
    this.startMark(`export-${format}`);
    this.log({
      category: 'export',
      level: 'info',
      section: 'Panels',
      action: 'Export Started',
      data: { format }
    });
  }

  exportCompleted(format: string): void {
    const duration = this.endMark(`export-${format}`);
    this.log({
      category: 'export',
      level: 'info',
      section: 'Driver',
      action: 'Export Completed',
      data: { format },
      duration: duration || undefined
    });
  }

  // === ERRORS ===

  runtimeError(error: string, source?: string): void {
    this.log({
      category: 'error',
      level: 'error',
      section: source || 'Iframe',
      action: 'Runtime Error',
      data: { error: error.substring(0, 500) }
    });
  }

  autoFixStarted(error: string, attemptNumber: number): void {
    this.startMark('auto-fix');
    this.log({
      category: 'error',
      level: 'info',
      section: 'Builder',
      action: 'Auto-Fix Started',
      data: { errorPreview: error.substring(0, 100), attemptNumber }
    });
  }

  autoFixCompleted(success: boolean, newCodeLength?: number): void {
    const duration = this.endMark('auto-fix');
    this.log({
      category: 'error',
      level: success ? 'info' : 'warn',
      section: 'Builder',
      action: 'Auto-Fix Completed',
      data: { success, newCodeLength },
      duration: duration || undefined
    });
  }

  // === SCENE GRAPH ===

  sceneGraphUpdated(nodeCount: number, selectedCount: number): void {
    this.log({
      category: 'render',
      level: 'trace',
      section: 'Driver',
      action: 'Scene Graph Updated',
      data: { nodeCount, selectedCount }
    });
  }

  guiConfigReceived(controlCount: number): void {
    this.log({
      category: 'render',
      level: 'debug',
      section: 'Driver',
      action: 'GUI Config Received',
      data: { controlCount }
    });
  }
}

// Singleton export
export const debug = DebugService.getInstance();

// Convenience functions
export const enableDebug = (level?: DebugLevel) => debug.enable(level);
export const disableDebug = () => debug.disable();

// Make available globally for console access
if (typeof window !== 'undefined') {
  (window as any).proshotDebug = debug;
  (window as any).enableDebug = enableDebug;
  (window as any).disableDebug = disableDebug;
}
