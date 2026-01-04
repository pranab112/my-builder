
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

interface BuilderProps {
  project: SavedProject;
  onBack: () => void;
  onUpdateProject: (code: string) => void;
}

const MODE_CONFIG: Record<WorkspaceMode, { tabs: Tab[], label: string, icon: string }> = {
  maker: { label: '3D Print', icon: '🖨️', tabs: ['tools', 'history', 'parameters', 'sketch', 'hierarchy', 'print', 'specs', 'export'] },
  engineer: { label: 'CAD / Eng', icon: '⚙️', tabs: ['tools', 'history', 'parameters', 'sketch', 'hierarchy', 'specs', 'export'] },
  designer: { label: 'Product Design', icon: '🎨', tabs: ['tools', 'history', 'parameters', 'material', 'environment', 'export', 'bookmarks'] },
  game_dev: { label: 'Game Assets', icon: '🎮', tabs: ['tools', 'history', 'parameters', 'hierarchy', 'material', 'export'] },
  architect: { label: 'Architecture', icon: '🏛️', tabs: ['tools', 'history', 'parameters', 'sketch', 'hierarchy', 'specs', 'environment', 'export', 'bookmarks'] },
  animator: { label: 'Animation/VFX', icon: '🎬', tabs: ['tools', 'history', 'environment', 'material', 'export'] },
  jewelry: { label: 'Jewelry Design', icon: '💎', tabs: ['tools', 'history', 'parameters', 'material', 'specs', 'environment', 'export'] },
  medical: { label: 'Medical/Sci', icon: '🏥', tabs: ['tools', 'history', 'hierarchy', 'specs', 'print', 'export'] },
  ecommerce: { label: 'E-commerce', icon: '🛒', tabs: ['tools', 'history', 'material', 'environment', 'export'] },
  sculptor: { label: 'Digital Art', icon: '🗿', tabs: ['tools', 'history', 'material', 'environment', 'export'] },
  automotive: { label: 'Automotive', icon: '🚗', tabs: ['tools', 'history', 'parameters', 'hierarchy', 'specs', 'material', 'environment', 'export'] },
  fashion: { label: 'Fashion', icon: '👗', tabs: ['tools', 'history', 'material', 'environment', 'export'] },
  education: { label: 'Learning', icon: '📚', tabs: ['tools', 'history', 'parameters', 'hierarchy', 'specs', 'export'] }
};

export const Builder: React.FC<BuilderProps> = ({ project, onBack, onUpdateProject }) => {
  const store = useBuilderStore();
  const { workspaceMode } = useGlobalStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // OS Detection
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const cmdKey = isMac ? 'Cmd' : 'Ctrl';

  // --- INIT & SYNC ---
  useEffect(() => {
    store.loadProject(project);
    return () => store.resetStore();
  }, [project.id]);

  useEffect(() => {
    if (store.htmlCode) {
      onUpdateProject(store.htmlCode);
    }
  }, [store.htmlCode]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'error') store.setRuntimeError(event.data.message);
      if (event.data.type === 'geometryStats') store.setSpecs(event.data.stats);
      if (event.data.type === 'exportComplete') alert("Export started! Check your downloads.");
      if (event.data.type === 'sceneGraphUpdate') {
          store.setSceneGraph(event.data.graph);
          const selected = event.data.graph.filter((n: any) => n.selected).map((n: any) => n.id);
          store.setSelectedObjectIds(selected);
      }
      if (event.data.type === 'cameraState') {
          const { position, target } = event.data;
          store.addBookmark({
              id: crypto.randomUUID(),
              name: `View ${store.bookmarks.length + 1}`,
              position,
              target
          });
      }
      if (event.data.type === 'guiConfig') {
          store.setParameters(event.data.controls);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
  const sendViewCommand = (cmd: string) => iframeRef.current?.contentWindow?.postMessage({ type: 'setView', view: cmd }, '*');
  const takeSnapshot = () => iframeRef.current?.contentWindow?.postMessage({ type: 'takeSnapshot' }, '*');
  const handleExport = (format: string) => iframeRef.current?.contentWindow?.postMessage({ type: 'exportModel', format }, '*');
  const handleAutoOrient = () => iframeRef.current?.contentWindow?.postMessage({ type: 'autoOrient', active: true }, '*');
  const handleSelectObject = (id: string | null) => iframeRef.current?.contentWindow?.postMessage({ type: 'selectObject', objectId: id }, '*');
  const handleCaptureBookmark = () => iframeRef.current?.contentWindow?.postMessage({ type: 'requestCameraState' }, '*');
  const handleRestoreBookmark = (bm: any) => iframeRef.current?.contentWindow?.postMessage({ type: 'setCameraState', position: bm.position, target: bm.target }, '*');
  const handleParameterChange = (name: string, value: any) => iframeRef.current?.contentWindow?.postMessage({ type: 'updateParam', name, value }, '*');
  const handleSketchExtrude = (points: {x:number, y:number}[], height: number) => iframeRef.current?.contentWindow?.postMessage({ type: 'extrudeSketch', points, height }, '*');

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
    store.setGenerating(true);
    store.setError(null);
    store.setRuntimeError(null);
    store.setShowCode(false);
    try {
      const imageToUse = store.refImages.length > 0 ? store.refImages[0] : undefined;
      let finalPrompt = store.prompt;
      if (project.importedData && !store.htmlCode) {
          finalPrompt += ` \n[SYSTEM: Use 'await window.loadImportedModel(window.IMPORTED_MODEL_URL, window.IMPORTED_MODEL_TYPE)'. Model type: '${project.importedType || 'stl'}'.]`;
      }
      const code = await generateAnimationCode(finalPrompt, store.htmlCode || undefined, imageToUse, project.category, workspaceMode);
      if (!code || code.length < 50) throw new Error("Generated code seems invalid.");
      
      // Pass the prompt to history
      store.setHtmlCode(code, true, store.prompt || "Generated Model");
      
      store.setPrompt(''); 
      store.setRefImages([]);
    } catch (err: any) {
      store.setError(err.message || "Failed to generate.");
    } finally {
      store.setGenerating(false);
    }
  };

  const handleAutoFix = async () => {
      if (!store.htmlCode || !store.runtimeError) return;
      store.setFixing(true);
      try {
          const fixed = await fixThreeJSCode(store.htmlCode, store.runtimeError);
          store.setHtmlCode(fixed, true, "Auto-Fix");
      } catch (e) {
          store.setError("Failed to auto-fix.");
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
  const handleToolClick = (toolPrompt: string) => { store.setPrompt(toolPrompt); };

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
  };

  const injectContextAndDriver = (html: string) => {
      let modified = injectDriverScript(html);
      if (project.importedData) {
          const injection = `<script>window.IMPORTED_MODEL_URL = "${project.importedData}"; window.IMPORTED_MODEL_TYPE = "${project.importedType || 'stl'}";</script>`;
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
                />
           )}
           <BuilderStatusBar onAutoFix={handleAutoFix} />
        </div>
      </div>
    </>
  );
};
