
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../Button';
import { SavedProject, Tab, WorkspaceMode } from './types';
import { generateAnimationCode, fixThreeJSCode, enhanceUserPrompt } from '../../services/geminiService';
import { Panels } from './Panels';
import { injectDriverScript } from './utils';
import { useBuilderStore } from '../../stores/builderStore';
import { useGlobalStore } from '../../stores/globalStore';
import { CommandPalette } from './CommandPalette';
import { HelpModal } from './HelpModal';
import { BuilderHeader } from './Builder/Header';
import { BuilderInputPanel } from './Builder/InputPanel';
import { BuilderViewport } from './Builder/Viewport';
import { BuilderStatusBar } from './Builder/StatusBar';
import { debug } from '../../services/debugService';
import { DebugPanel } from './DebugPanel';
import { iframeCommands, commands } from '../../services/iframeCommandService';
import { successTracking } from '../../services/successTrackingService';

interface BuilderProps {
  project: SavedProject;
  onBack: () => void;
  onUpdateProject: (code: string) => void;
}

const MODE_CONFIG: Record<WorkspaceMode, { tabs: Tab[], label: string, icon: string }> = {
  maker: { label: '3D Print', icon: '🖨️', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'animator', 'library', 'material', 'print', 'export', 'history'] },
  engineer: { label: 'CAD / Eng', icon: '⚙️', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'sketch', 'animator', 'library', 'export', 'history'] },
  designer: { label: 'Product Design', icon: '🎨', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'animator', 'library', 'material', 'environment', 'export', 'history', 'bookmarks'] },
  game_dev: { label: 'Game Assets', icon: '🎮', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'animator', 'library', 'material', 'export', 'history'] },
  architect: { label: 'Architecture', icon: '🏛️', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'sketch', 'animator', 'library', 'environment', 'export', 'history', 'bookmarks'] },
  animator: { label: 'Animation/VFX', icon: '🎬', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'animator', 'library', 'material', 'environment', 'export', 'history'] },
  jewelry: { label: 'Jewelry Design', icon: '💎', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'animator', 'library', 'material', 'environment', 'export', 'history'] },
  medical: { label: 'Medical/Sci', icon: '🏥', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'library', 'print', 'export', 'history'] },
  ecommerce: { label: 'E-commerce', icon: '🛒', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'animator', 'library', 'material', 'environment', 'export', 'history'] },
  sculptor: { label: 'Digital Art', icon: '🗿', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'animator', 'library', 'material', 'environment', 'export', 'history'] },
  automotive: { label: 'Automotive', icon: '🚗', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'animator', 'library', 'material', 'environment', 'export', 'history'] },
  fashion: { label: 'Fashion', icon: '👗', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'animator', 'library', 'material', 'environment', 'export', 'history'] },
  education: { label: 'Learning', icon: '📚', tabs: ['tools', 'hierarchy', 'specs', 'parameters', 'animator', 'library', 'export', 'history'] }
};

export const Builder: React.FC<BuilderProps> = ({ project, onBack, onUpdateProject }) => {
  const store = useBuilderStore();
  const { workspaceMode } = useGlobalStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Safety mechanism for auto-debug loops
  const fixAttemptsRef = useRef(0);
  
  // OS Detection
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const cmdKey = isMac ? 'Cmd' : 'Ctrl';

  // --- INIT & SYNC ---
  useEffect(() => {
    store.loadProject(project);

    // Initialize command service with iframe ref
    iframeCommands.init(iframeRef);

    return () => {
      store.resetStore();
      iframeCommands.destroy();
    };
  }, [project.id]);

  useEffect(() => {
    if (store.htmlCode) {
      onUpdateProject(store.htmlCode);
      // Reset fix attempts on successful code generation (assuming it works initially)
      if (!store.runtimeError) {
          fixAttemptsRef.current = 0;
      }
    }
  }, [store.htmlCode]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      // Debug: Log all messages from iframe
      debug.messageFromIframe(event.data.type, event.data);

      switch (event.data.type) {
        case 'error':
          debug.runtimeError(event.data.message, 'Iframe');
          store.setRuntimeError(event.data.message);
          break;

        case 'geometryStats':
          store.setSpecs(event.data.stats);
          break;

        case 'exportComplete':
          debug.exportCompleted('unknown');
          alert("Export started! Check your downloads.");
          break;

        case 'sceneGraphUpdate':
          store.setSceneGraph(event.data.graph);
          const selected = event.data.graph.filter((n: any) => n.selected).map((n: any) => n.id);
          store.setSelectedObjectIds(selected);
          debug.sceneGraphUpdated(event.data.graph.length, selected.length);
          break;

        case 'selectionChanged':
          // Direct selection change from iframe (e.g., click-to-select)
          // Only update if source is not 'command' (to avoid echo)
          if (event.data.source !== 'command') {
            store.setSelectedObjectIds(event.data.selectedIds || []);
            debug.log?.(`Selection changed from ${event.data.source}: ${event.data.selectedIds?.join(', ') || 'none'}`);
          }
          break;

        case 'commandAck':
          // Command acknowledgment from iframe
          // Can be used for optimistic UI updates or error handling
          if (!event.data.success) {
            console.warn(`[Command Failed] ${event.data.commandType}: ${event.data.error}`);
            // Optionally show error to user for critical commands
            if (event.data.commandType === 'addPrimitive' || event.data.commandType === 'performBoolean') {
              store.setError(`Operation failed: ${event.data.error}`);
            }
          } else {
            // On successful add/boolean, we could update selection optimistically
            // but the sceneGraphUpdate will handle this
            debug.log?.(`Command ${event.data.commandType} acknowledged`);
          }
          break;

        case 'codeExecuted':
          // User code execution completed
          if (event.data.success) {
            debug.log?.(`Code executed: ${event.data.stats?.executionTime}ms, ${event.data.stats?.objectsAdded} objects`);
          }
          break;

        case 'cameraState':
          const { position, target } = event.data;
          store.addBookmark({
            id: crypto.randomUUID(),
            name: `View ${store.bookmarks.length + 1}`,
            position,
            target
          });
          break;

        case 'guiConfig':
          store.setParameters(event.data.controls);
          debug.guiConfigReceived(event.data.controls.length);
          break;

        case 'sceneReady':
          debug.renderSceneDetected(true, true, true);
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- SMART AUTO-DEBUG LOGIC (with history tracking) ---
  const autoDebugTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  // Helper to check if we've already tried to fix this exact error
  const hasTriedSameError = (currentError: string): boolean => {
    const recentAttempts = store.fixAttempts.slice(-3);
    return recentAttempts.some(a => a.errorBefore === currentError);
  };

  // Helper to check if last fix created a new error (regression)
  const lastFixCausedRegression = (): boolean => {
    if (store.fixAttempts.length < 2) return false;
    const lastAttempt = store.fixAttempts[store.fixAttempts.length - 1];
    const prevAttempt = store.fixAttempts[store.fixAttempts.length - 2];
    // If previous attempt succeeded but last one failed with different error
    return prevAttempt.errorAfter === null && lastAttempt.errorAfter !== null;
  };

  useEffect(() => {
      // Clear any pending auto-debug timer
      if (autoDebugTimerRef.current) {
          clearTimeout(autoDebugTimerRef.current);
          autoDebugTimerRef.current = null;
      }

      // Guard: Skip if already fixing to prevent race condition
      if (store.isFixing) return;

      // If we have an error and auto-debug is ON
      if (store.runtimeError && store.autoDebug) {
          // SMART CHECK 1: Don't retry if same error as last time
          if (lastErrorRef.current === store.runtimeError) {
              console.log(`🤖 [Smart Auto-Debug] Same error detected, skipping retry`);
              return;
          }

          // SMART CHECK 2: Don't retry if we've already tried this exact error
          if (hasTriedSameError(store.runtimeError)) {
              console.log(`🤖 [Smart Auto-Debug] Already attempted this error, suggesting manual review`);
              store.setError("This error was already attempted. Consider different approach or manual fix.");
              store.toggleAutoDebug();
              return;
          }

          // SMART CHECK 3: If last fix caused regression, revert
          if (lastFixCausedRegression() && store.lastSuccessfulCode) {
              console.log(`🤖 [Smart Auto-Debug] Fix caused regression, reverting to last working version`);
              store.revertToLastSuccessful();
              store.toggleAutoDebug();
              return;
          }

          // DEBOUNCE: Wait 1.5 seconds before triggering auto-fix
          autoDebugTimerRef.current = setTimeout(() => {
              if (fixAttemptsRef.current < 3) {
                  console.log(`🤖 [Smart Auto-Debug] Triggering fix attempt ${fixAttemptsRef.current + 1}/3`);
                  fixAttemptsRef.current += 1;
                  lastErrorRef.current = store.runtimeError;
                  void handleAutoFix();
              } else {
                  // Check if we should offer revert option
                  if (store.lastSuccessfulCode) {
                      store.setError("Auto-debug paused: Multiple fixes failed. Click 'Revert' to restore last working version.");
                  } else {
                      store.setError("Auto-debug paused: Too many consecutive errors. Please review the code manually.");
                  }
                  store.toggleAutoDebug();
                  fixAttemptsRef.current = 0;
              }
          }, 1500);
      }

      // Cleanup timer on unmount or deps change
      return () => {
          if (autoDebugTimerRef.current) {
              clearTimeout(autoDebugTimerRef.current);
          }
      };
  }, [store.runtimeError, store.autoDebug, store.isFixing]);

  // Sync Store State to Iframe
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    const win = iframeRef.current.contentWindow;

    win.postMessage({ type: 'setRenderMode', mode: store.renderMode }, '*');
    win.postMessage({ type: 'toggleGrid', visible: store.showGrid }, '*');
    win.postMessage({ type: 'toggleAxes', visible: true }, '*');
    win.postMessage({ type: 'setGizmoMode', mode: store.gizmoMode }, '*');
    win.postMessage({ type: 'setTurntable', active: store.turntableActive }, '*');
    win.postMessage({ type: 'setClipping', value: store.clippingValue }, '*');
    win.postMessage({ type: 'setEnvironment', env: store.environment }, '*');
    
    win.postMessage({ type: 'setPrinterBed', preset: store.printerPreset, active: store.activeTab === 'print' }, '*');
    win.postMessage({ type: 'setSlicerLayer', percent: store.slicerLayer, active: store.activeTab === 'print' && store.renderMode === 'slicer' }, '*');
    win.postMessage({ type: 'autoOrient', active: false }, '*'); 

    win.postMessage({ type: 'updateMaterial', config: store.materialConfig }, '*');
    
    if (store.activeTab === 'specs' || store.activeTab === 'print') {
        win.postMessage({ type: 'requestStats' }, '*');
    }
  }, [store.renderMode, store.showGrid, store.materialConfig, store.activeTab, store.gizmoMode, store.turntableActive, store.clippingValue, store.environment, store.printerPreset, store.slicerLayer]);

  useEffect(() => {
      const allowedTabs = MODE_CONFIG[workspaceMode].tabs;
      if (!allowedTabs.includes(store.activeTab)) {
          store.setActiveTab(allowedTabs[0]);
      }
  }, [workspaceMode]);

  // --- SHORTCUTS LISTENER ---
  // Helper to send messages to iframe with command ID for acknowledgment pattern
  const sendToIframe = (message: any) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(message, '*');
    }
  };

  const sendViewCommand = (cmd: string) => sendToIframe({ type: 'setView', view: cmd });
  const takeSnapshot = () => sendToIframe({ type: 'takeSnapshot' });
  const handleExport = (format: string) => sendToIframe({ type: 'exportModel', format });
  const handleAutoOrient = () => sendToIframe({ type: 'autoOrient', active: true });
  const handleSelectObject = (id: string | null) => sendToIframe({ type: 'selectObject', objectId: id, commandId: `select_${Date.now()}` });
  const handleCaptureBookmark = () => sendToIframe({ type: 'requestCameraState' });
  const handleRestoreBookmark = (bm: any) => sendToIframe({ type: 'setCameraState', position: bm.position, target: bm.target });
  const handleParameterChange = (name: string, value: any) => sendToIframe({ type: 'updateParam', name, value, commandId: `param_${Date.now()}` });
  const handleSketchExtrude = (points: {x:number, y:number}[], height: number) => sendToIframe({ type: 'extrudeSketch', points, height, commandId: `extrude_${Date.now()}` });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                (e.target as HTMLElement).blur();
                store.setCommandPaletteOpen(true);
            }
            return;
        }
        if (store.isCommandPaletteOpen || store.isHelpOpen) return;
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); store.setCommandPaletteOpen(true); return; }
        if (e.key.toLowerCase() === 'g') store.setGizmoMode('translate');
        if (e.key.toLowerCase() === 'r') store.setGizmoMode('rotate');
        if (e.key.toLowerCase() === 's') store.setGizmoMode('scale');
        if (e.key === 'Escape') store.setGizmoMode('none');
        if (e.key === '1') sendViewCommand('front');
        if (e.key === '3') sendViewCommand('side');
        if (e.key === '7') sendViewCommand('top');
        if (e.key === '0') sendViewCommand('center');
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); store.undo(); }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); }
        if (e.key === ' ') { e.preventDefault(); store.toggleFullScreen(); }
        if (e.key === '?') { e.preventDefault(); store.setHelpOpen(true); }
        if (e.key === 'Delete' || e.key === 'Backspace') { if (window.confirm("Clear project code?")) { store.setHtmlCode('', false); } }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store]);

  // --- ACTIONS ---
  const handleGenerate = async () => {
    // Debug: Start generation tracking
    debug.generationStarted({
      prompt: store.prompt,
      hasExistingCode: !!store.htmlCode,
      hasImage: store.refImages.length > 0,
      category: project.category,
      mode: workspaceMode
    });

    store.setGenerating(true);
    store.setError(null);
    store.setRuntimeError(null);
    store.setValidationReport(null);
    store.setShowCode(false);
    store.clearFixAttempts(); // Clear fix history on new generation
    fixAttemptsRef.current = 0; // Reset fix counter on manual generate
    try {
      // Pass ALL reference images to AI for multi-view analysis (not just first one)
      const imagesToUse = store.refImages.length > 0 ? store.refImages : [];
      let finalPrompt = store.prompt;
      if (project.importedData && !store.htmlCode) {
          finalPrompt += ` \n[SYSTEM: Use 'await window.loadImportedModel(window.IMPORTED_MODEL_URL, window.IMPORTED_MODEL_TYPE)'. Model type: '${project.importedType || 'stl'}'.]`;
      }
      const result = await generateAnimationCode(finalPrompt, store.htmlCode || undefined, imagesToUse, project.category, workspaceMode, store.sceneGraph);
      if (!result.code || result.code.length < 50) throw new Error("Generated code seems invalid.");

      // Store validation report for UI display
      store.setValidationReport({
        isValid: result.validation.isValid,
        warnings: result.validation.warnings,
        errors: result.validation.errors,
        stats: {
          linesOfCode: result.validation.stats.linesOfCode,
          complexity: result.validation.stats.complexity
        },
        timestamp: Date.now()
      });

      // Debug: Generation completed
      debug.generationCompleted(result.code.length);

      // Track successful generation for learning
      successTracking.record(
        store.prompt,
        result.code,
        result.validation.isValid,  // Initial success based on validation
        result.validation.stats.complexity
      );

      // Pass the prompt to history
      store.setHtmlCode(result.code, true, store.prompt || "Generated Model");

      // Save as last successful code for potential revert (if validation passed)
      if (result.validation.isValid) {
        store.setLastSuccessfulCode(result.code);
      }

      store.setPrompt('');
      store.setRefImages([]);
    } catch (err: any) {
      debug.generationFailed(err.message || "Unknown error");
      store.setError(err.message || "Failed to generate.");

      // Track failed generation
      successTracking.record(
        store.prompt,
        '',
        false,
        'medium',
        err.message || "Unknown error"
      );
    } finally {
      store.setGenerating(false);
    }
  };

  const handleAutoFix = async () => {
      if (!store.htmlCode || !store.runtimeError) return;

      // Debug: Start auto-fix tracking
      debug.autoFixStarted(store.runtimeError, fixAttemptsRef.current);

      // Create fix attempt record
      const attemptId = crypto.randomUUID();
      const codeBeforeFix = store.htmlCode;

      store.addFixAttempt({
        id: attemptId,
        timestamp: Date.now(),
        errorBefore: store.runtimeError,
        errorAfter: null,  // Will be updated when we know the result
        fixDescription: `Fix attempt for: ${store.runtimeError.substring(0, 50)}...`,
        codeSnapshot: codeBeforeFix
      });

      store.setFixing(true);
      try {
          // Include previous fix attempts context for smarter fixes
          const previousErrors = store.fixAttempts
            .slice(-3)
            .map(a => a.errorBefore)
            .filter(e => e !== store.runtimeError);

          const contextualError = previousErrors.length > 0
            ? `${store.runtimeError}\n\n[CONTEXT: Previous errors that were NOT this one: ${previousErrors.join(', ')}. Do NOT introduce those errors again.]`
            : store.runtimeError;

          const fixed = await fixThreeJSCode(store.htmlCode, contextualError);

          // Update the code
          store.setHtmlCode(fixed, true, `Auto-Fix: ${store.runtimeError.substring(0, 30)}...`);

          // Debug: Auto-fix completed
          debug.autoFixCompleted(true, fixed.length);

          // Clear old error to let iframe determine if fix worked
          store.setRuntimeError(null);

          // Note: The fix attempt result will be updated when we receive (or don't receive)
          // a new runtime error from the iframe

      } catch (e) {
          debug.autoFixCompleted(false);
          store.setError("Failed to auto-fix.");

          // Update attempt as failed
          store.updateFixAttemptResult(attemptId, "Fix generation failed");
      } finally {
          store.setFixing(false);
      }
  };

  const handleEnhancePrompt = async () => {
      store.setEnhancing(true);
      try {
          const improved = await enhanceUserPrompt(store.prompt, project.category, workspaceMode);
          store.setPrompt(improved);
      } catch (e) {} finally { store.setEnhancing(false); }
  };

  const handleApplyCustomCode = () => { store.setHtmlCode(store.codeEdits, true, "Manual Code Edit"); store.setShowCode(false); };
  
  // FIXED: Auto-trigger generation for CAD Tools to make them responsive
  const handleToolClick = (toolPrompt: string) => { 
      const context = store.selectedObjectIds.length > 0 ? ` on selected object` : ``;
      store.setPrompt(`${toolPrompt}${context}`);
      if (store.htmlCode) {
          // If we already have code, treat this as a quick action
          setTimeout(handleGenerate, 100);
      }
  };

  const handleDownload = () => {
    if (!store.htmlCode) return;
    const blob = new Blob([store.htmlCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // CRITICAL: Revoke blob URL to prevent memory leak
    URL.revokeObjectURL(url);
  };

  const injectContextAndDriver = (html: string) => {
      let modified = injectDriverScript(html);
      if (project.importedData) {
          // SECURITY: Escape user data to prevent XSS injection
          const escapeForJS = (str: string) =>
              str.replace(/\\/g, '\\\\')
                 .replace(/"/g, '\\"')
                 .replace(/'/g, "\\'")
                 .replace(/</g, '\\x3c')
                 .replace(/>/g, '\\x3e')
                 .replace(/\n/g, '\\n')
                 .replace(/\r/g, '\\r');

          const safeUrl = escapeForJS(project.importedData);
          const safeType = escapeForJS(project.importedType || 'stl');
          const injection = `<script>window.IMPORTED_MODEL_URL = "${safeUrl}"; window.IMPORTED_MODEL_TYPE = "${safeType}";</script>`;
          modified = modified.replace('<head>', '<head>' + injection);
      }
      return modified;
  };

  const templates = [
    { icon: '📦', label: 'Box', prompt: 'Create a parametric box with adjustable width, height, and depth.' },
    { icon: '🏠', label: 'House', prompt: 'Create a simple parametric house structure with a roof.' },
    { icon: '⚙️', label: 'Gear', prompt: 'Create a parametric gear with adjustable teeth count.' },
    { icon: '🏺', label: 'Vase', prompt: 'Create a twisted vase using a lathe geometry.' },
  ];

  const suggestions = [
    { label: 'Add handle', text: 'Add a curved handle to it.' },
    { label: 'Add holes', text: 'Add 4 mounting holes to the corners.' },
    { label: 'Round edges', text: 'Apply a fillet to smooth the sharp edges.' },
    { label: 'Add base', text: 'Add a wide base for stability.' },
    { label: 'Hollow it', text: 'Hollow out the inside to create a shell.' }
  ];

  const activeModeConfig = MODE_CONFIG[workspaceMode];

  return (
    <>
      {store.isCommandPaletteOpen && <CommandPalette onClose={() => store.setCommandPaletteOpen(false)} onViewChange={sendViewCommand} onExport={handleExport} />}
      {store.isHelpOpen && <HelpModal onClose={() => store.setHelpOpen(false)} />}
      <DebugPanel />

      <div className={`h-full transition-all duration-300 ${store.isFullScreen ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col' : 'grid grid-cols-1 lg:grid-cols-12 gap-8'}`}>
        <div className={`flex flex-col space-y-6 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar pr-2 transition-all duration-300 ${store.isFullScreen ? 'hidden' : 'lg:col-span-4'}`}>
          <div className="flex flex-col">
             <BuilderHeader 
                project={project} 
                onBack={onBack} 
                activeModeConfig={activeModeConfig} 
                modeConfig={MODE_CONFIG} 
             />
             <BuilderInputPanel 
                onGenerate={handleGenerate}
                onEnhance={handleEnhancePrompt}
                templates={templates}
                suggestions={suggestions}
             />
             {store.htmlCode && (
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm space-y-3 mt-6">
                    <div className="flex gap-2">
                        <Button onClick={() => store.setShowCode(!store.showCode)} variant="secondary" className="flex-1 text-sm">{store.showCode ? "Preview Design" : "Edit Code"}</Button>
                        <Button onClick={handleDownload} variant="secondary" className="flex-1 text-sm">Download HTML</Button>
                    </div>
                    <Button onClick={() => store.setActiveTab('export')} className="w-full !bg-gradient-to-r !from-amber-600 !to-orange-600 hover:!from-amber-500 !shadow-amber-500/20 text-sm">Commercial Export (GLB/OBJ/STL)</Button>
                </div>
             )}
          </div>
        </div>

        <div className={`relative flex flex-col gap-4 transition-all duration-300 ${store.isFullScreen ? 'flex-1 w-full h-full p-4' : 'lg:col-span-8 h-full min-h-[600px]'}`}>
           <BuilderViewport 
              iframeRef={iframeRef}
              injectContextAndDriver={injectContextAndDriver}
              onApplyCustomCode={handleApplyCustomCode}
              sendViewCommand={sendViewCommand}
              takeSnapshot={takeSnapshot}
              activeModeTabs={activeModeConfig.tabs}
              cmdKey={cmdKey}
           />
           
           {store.htmlCode && !store.showCode && (
                <Panels
                    handleToolClick={handleToolClick}
                    handleExport={handleExport}
                    sendViewCommand={sendViewCommand}
                    handleAutoOrient={handleAutoOrient}
                    workspaceMode={workspaceMode}
                    handleSelectObject={handleSelectObject}
                    handleParameterChange={handleParameterChange}
                    handleSketchExtrude={handleSketchExtrude}
                    sendToIframe={sendToIframe}
                />
           )}
           <BuilderStatusBar onAutoFix={handleAutoFix} />
        </div>
      </div>
    </>
  );
};
