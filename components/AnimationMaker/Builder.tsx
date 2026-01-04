
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../Button';
import { ImageUpload } from '../ImageUpload';
import { SavedProject, Tab, WorkspaceMode } from './types';
import { generateAnimationCode, fixThreeJSCode, enhanceUserPrompt } from '../../services/geminiService';
import { Panels } from './Panels';
import { injectDriverScript } from './utils';
import { useBuilderStore } from '../../stores/builderStore';
import { useGlobalStore } from '../../stores/globalStore';
import { CommandPalette } from './CommandPalette';
import { HelpModal } from './HelpModal';
import { ViewCube } from './ViewCube';

interface BuilderProps {
  project: SavedProject;
  onBack: () => void;
  onUpdateProject: (code: string) => void;
}

const MODE_CONFIG: Record<WorkspaceMode, { tabs: Tab[], label: string, icon: string }> = {
  maker: {
    label: '3D Print',
    icon: '🖨️',
    tabs: ['tools', 'print', 'specs', 'export']
  },
  engineer: {
    label: 'CAD / Eng',
    icon: '⚙️',
    tabs: ['tools', 'specs', 'export']
  },
  designer: {
    label: 'Product Design',
    icon: '🎨',
    tabs: ['tools', 'material', 'environment', 'export']
  },
  game_dev: {
    label: 'Game Assets',
    icon: '🎮',
    tabs: ['tools', 'material', 'export']
  }
};

export const Builder: React.FC<BuilderProps> = ({ project, onBack, onUpdateProject }) => {
  const store = useBuilderStore();
  const { workspaceMode, setWorkspaceMode } = useGlobalStore();
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  
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

  // Ensure active tab is valid for current mode
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

        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            store.setCommandPaletteOpen(true);
            return;
        }

        if (e.key.toLowerCase() === 'g') store.setGizmoMode('translate');
        if (e.key.toLowerCase() === 'r') store.setGizmoMode('rotate');
        if (e.key.toLowerCase() === 's') store.setGizmoMode('scale');
        if (e.key === 'Escape') store.setGizmoMode('none');

        if (e.key === '1') sendViewCommand('front');
        if (e.key === '3') sendViewCommand('side');
        if (e.key === '7') sendViewCommand('top');
        if (e.key === '0') sendViewCommand('center');

        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            store.undo();
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            store.redo();
        }

        if (e.key === ' ') {
            e.preventDefault();
            store.toggleFullScreen();
        }
        
        if (e.key === '?') {
            e.preventDefault();
            store.setHelpOpen(true);
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
             if (window.confirm("Clear current project code? This cannot be undone.")) {
                 store.setHtmlCode('', false);
             }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store]);

  // --- HELPER: Inject Imported Model Variable ---
  const injectContextAndDriver = (html: string) => {
      let modified = injectDriverScript(html);
      
      // If we have an imported model in the project data, inject it as a global var
      // The store.loadProject puts it into state? No, store only has prompt/code.
      // We need to access project prop directly or put it in store.
      // Assuming 'project' prop has it (mapped in AnimationMaker.tsx)
      const importedData = (project as any).importedData;
      
      if (importedData) {
          const injection = `<script>window.IMPORTED_MODEL_URL = "${importedData}";</script>`;
          modified = modified.replace('<head>', '<head>' + injection);
      }
      return modified;
  };

  // --- ACTIONS ---

  const handleGenerate = async () => {
    if (!store.prompt.trim() && store.refImages.length === 0) return;

    if (store.prompt.trim()) {
       setPromptHistory(prev => [store.prompt, ...prev.filter(p => p !== store.prompt)].slice(0, 10));
    }

    store.setGenerating(true);
    store.setError(null);
    store.setRuntimeError(null);
    store.setShowCode(false);

    try {
      const imageToUse = store.refImages.length > 0 ? store.refImages[0] : undefined;
      
      // Check if we have imported model context to add to prompt
      let finalPrompt = store.prompt;
      if ((project as any).importedData && !store.htmlCode) {
          finalPrompt += " \n[SYSTEM: An imported model is available at window.IMPORTED_MODEL_URL. Use a Three.js loader (STLLoader, GLTFLoader, OBJLoader) based on the file type to load and display it.]";
      }

      const code = await generateAnimationCode(finalPrompt, store.htmlCode || undefined, imageToUse, project.category);
      
      if (!code || code.length < 50) throw new Error("Generated code seems invalid.");

      store.setHtmlCode(code, true);
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
          store.setHtmlCode(fixed, true);
      } catch (e) {
          store.setError("Failed to auto-fix.");
      } finally {
          store.setFixing(false);
      }
  };

  const handleEnhancePrompt = async () => {
      if (!store.prompt.trim()) return;
      store.setEnhancing(true);
      try {
          const improved = await enhanceUserPrompt(store.prompt, project.category);
          store.setPrompt(improved);
      } catch (e) {
          // ignore
      } finally {
          store.setEnhancing(false);
      }
  };

  const handleApplyCustomCode = () => {
      store.setHtmlCode(store.codeEdits, true);
      store.setShowCode(false); 
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
  };

  const handleToolClick = (toolPrompt: string) => {
    store.setPrompt(toolPrompt);
    if (toolPrompt.includes('[') && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  // --- UI HELPERS ---

  const handleAppendPrompt = (text: string) => {
    const current = store.prompt.trim();
    const separator = current && !current.endsWith(' ') ? ' ' : '';
    const next = current ? `${current}${separator}${text}` : text;
    store.setPrompt(next);
    textareaRef.current?.focus();
  };

  const suggestions = [
    { label: 'Add handle', text: 'Add a curved handle to it.' },
    { label: 'Add holes', text: 'Add 4 mounting holes to the corners.' },
    { label: 'Round edges', text: 'Apply a fillet to smooth the sharp edges.' },
    { label: 'Add base', text: 'Add a wide base for stability.' },
    { label: 'Hollow it', text: 'Hollow out the inside to create a shell.' }
  ];

  const templates = [
    { icon: '📦', label: 'Box', prompt: 'Create a parametric box with adjustable width, height, and depth.' },
    { icon: '🏠', label: 'House', prompt: 'Create a simple parametric house structure with a roof.' },
    { icon: '⚙️', label: 'Gear', prompt: 'Create a parametric gear with adjustable teeth count.' },
    { icon: '🏺', label: 'Vase', prompt: 'Create a twisted vase using a lathe geometry.' },
  ];

  const activeModeConfig = MODE_CONFIG[workspaceMode];

  return (
    <>
      {store.isCommandPaletteOpen && (
          <CommandPalette 
              onClose={() => store.setCommandPaletteOpen(false)} 
              onViewChange={sendViewCommand}
              onExport={handleExport}
          />
      )}

      {store.isHelpOpen && (
          <HelpModal onClose={() => store.setHelpOpen(false)} />
      )}

      <div className={`h-full transition-all duration-300 ${store.isFullScreen ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col' : 'grid grid-cols-1 lg:grid-cols-12 gap-8'}`}>
        {/* SIDEBAR INPUT SECTION */}
        <div className={`flex flex-col space-y-6 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar pr-2 transition-all duration-300 ${store.isFullScreen ? 'hidden' : 'lg:col-span-4'}`}>
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm flex flex-col">
            
            {/* PROJECT HEADER & MODE SELECTOR */}
            <div className="flex items-center gap-2 mb-4 justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div>
                        <h2 className="text-lg font-semibold text-white leading-tight">{project.name}</h2>
                        <span className="text-xs text-slate-500 font-medium">{project.category}</span>
                    </div>
                </div>
                
                {/* Workspace Mode Dropdown */}
                <div className="relative">
                    <button 
                        onClick={() => setShowModeSelector(!showModeSelector)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-lg transition-all group"
                    >
                        <span className="text-lg">{activeModeConfig.icon}</span>
                        <div className="text-left hidden sm:block">
                            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Mode</div>
                            <div className="text-xs font-semibold text-white flex items-center gap-1">
                                {activeModeConfig.label}
                                <svg className="w-3 h-3 text-slate-500 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </button>

                    {showModeSelector && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowModeSelector(false)} />
                            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                                {Object.entries(MODE_CONFIG).map(([key, config]) => (
                                    <button
                                        key={key}
                                        onClick={() => { setWorkspaceMode(key as WorkspaceMode); setShowModeSelector(false); }}
                                        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0 ${workspaceMode === key ? 'bg-slate-800/50' : ''}`}
                                    >
                                        <span className="text-xl">{config.icon}</span>
                                        <div>
                                            <div className={`text-sm font-semibold ${workspaceMode === key ? 'text-indigo-400' : 'text-slate-200'}`}>{config.label}</div>
                                        </div>
                                        {workspaceMode === key && <div className="ml-auto w-2 h-2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50"></div>}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="min-h-[120px]">
                  <ImageUpload onImagesChange={store.setRefImages} selectedImages={store.refImages} compact={true} />
              </div>
              
              <div className="flex flex-col gap-2 relative">
                  <div className="flex justify-between items-end">
                      <p className="text-sm text-slate-300 font-medium">{store.htmlCode ? "Refine your design:" : "Describe the object:"}</p>
                      
                      <div className="flex items-center gap-2">
                          {promptHistory.length > 0 && (
                             <div className="relative">
                                 <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                                     History
                                 </button>
                                 {showHistory && (
                                     <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                                         <div className="p-2 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase">Recent Prompts</div>
                                         <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                            {promptHistory.map((h, i) => (
                                                <button 
                                                    key={i} 
                                                    onClick={() => { store.setPrompt(h); setShowHistory(false); }}
                                                    className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 border-b border-slate-800/50 last:border-0 truncate"
                                                >
                                                    {h}
                                                </button>
                                            ))}
                                         </div>
                                     </div>
                                 )}
                                 {showHistory && <div className="fixed inset-0 z-40" onClick={() => setShowHistory(false)} />}
                             </div>
                          )}

                          <button onClick={handleEnhancePrompt} disabled={store.isEnhancing || !store.prompt.trim()} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 disabled:opacity-50 transition-colors">
                              {store.isEnhancing ? <span className="animate-pulse">Enhancing...</span> : "✨ Enhance"}
                          </button>
                      </div>
                  </div>
                  
                  <textarea
                      ref={textareaRef}
                      value={store.prompt}
                      onChange={(e) => store.setPrompt(e.target.value)}
                      placeholder="e.g. Create a phone stand with adjustable angle..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all h-24 resize-none font-mono text-sm"
                  />
                  
                  {/* Suggestions */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide pt-1">
                    <span className="text-xs text-slate-500 py-1 select-none">💡</span>
                    {suggestions.map((s, i) => (
                        <button 
                            key={i}
                            onClick={() => handleAppendPrompt(s.text)}
                            className="whitespace-nowrap px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-slate-300 transition-colors"
                        >
                            {s.label}
                        </button>
                    ))}
                  </div>

                  {/* Templates */}
                  <div className="mt-2 pt-2 border-t border-slate-800/50">
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">📚 Templates</p>
                     <div className="grid grid-cols-4 gap-2">
                        {templates.map((t, i) => (
                            <button
                                key={i}
                                onClick={() => store.setPrompt(t.prompt)}
                                className="flex flex-col items-center justify-center p-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl transition-all group"
                            >
                                <span className="text-xl mb-1 group-hover:scale-110 transition-transform">{t.icon}</span>
                                <span className="text-[10px] text-slate-400 group-hover:text-emerald-400">{t.label}</span>
                            </button>
                        ))}
                     </div>
                  </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button onClick={handleGenerate} isLoading={store.isGenerating} disabled={!store.prompt.trim() && store.refImages.length === 0} className="flex-1 !bg-gradient-to-r !from-emerald-600 !to-teal-600 hover:!from-emerald-500 hover:!to-teal-500 !shadow-emerald-500/20">
                  {store.isGenerating ? (store.htmlCode ? "Engineering..." : "Initializing...") : (store.htmlCode ? "Update Design" : "Generate CAD Model")}
              </Button>
            </div>
            {store.error && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-200 text-xs">{store.error}</div>}
          </div>
          
          {store.htmlCode && (
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm space-y-3">
                <div className="flex gap-2">
                  <Button onClick={() => store.setShowCode(!store.showCode)} variant="secondary" className="flex-1 text-sm">{store.showCode ? "Preview Design" : "Edit Code"}</Button>
                  <Button onClick={handleDownload} variant="secondary" className="flex-1 text-sm">Download HTML</Button>
                </div>
                <Button onClick={() => store.setActiveTab('export')} className="w-full !bg-gradient-to-r !from-amber-600 !to-orange-600 hover:!from-amber-500 !shadow-amber-500/20 text-sm">Commercial Export (GLB/OBJ/STL)</Button>
            </div>
          )}
        </div>

        {/* OUTPUT SECTION */}
        <div className={`relative flex flex-col gap-4 transition-all duration-300 ${store.isFullScreen ? 'flex-1 w-full h-full p-4' : 'lg:col-span-8 h-full min-h-[600px]'}`}>
          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl shadow-2xl p-2 flex flex-col relative overflow-hidden backdrop-blur-sm">
              
              {store.htmlCode && !store.showCode && (
                <div className="absolute top-4 left-4 z-20 flex gap-2 flex-wrap max-w-[80%] pointer-events-none">
                    <div className="bg-slate-900/90 rounded-xl border border-slate-700 shadow-xl p-1 flex gap-1 backdrop-blur-md pointer-events-auto">
                        {activeModeConfig.tabs.map(t => (
                          <button key={t} onClick={() => store.setActiveTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${store.activeTab === t ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                        ))}
                    </div>
                </div>
              )}
              
              {store.htmlCode && !store.showCode && (
                  <>
                      {/* VIEW CUBE */}
                      <ViewCube onViewChange={sendViewCommand} />
                      
                      <div className="absolute bottom-4 right-4 z-20 flex gap-2">
                          <button onClick={() => store.setHelpOpen(true)} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Keyboard Shortcuts">?</button>
                          <button onClick={() => store.toggleGrid()} className={`p-2 rounded-lg bg-slate-900/80 border border-slate-700 backdrop-blur text-xs ${store.showGrid ? 'text-emerald-400 border-emerald-500/30' : 'text-slate-500'}`} title="Toggle Grid">Grid</button>
                          <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
                          <button onClick={() => store.toggleFullScreen()} className={`p-2 rounded-lg bg-slate-900/80 border border-slate-700 backdrop-blur text-slate-300 hover:text-white hover:border-emerald-500/50 transition-all`}>
                              {store.isFullScreen ? "Exit Full Screen" : "Full Screen"}
                          </button>
                      </div>

                      {/* CMD+K Hint */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none opacity-50">
                           <span className="px-2 py-1 bg-slate-900/50 rounded text-[10px] text-slate-400 border border-slate-800">{cmdKey} + K</span>
                      </div>
                  </>
              )}

              <div className="absolute inset-0 z-0">
                {store.htmlCode ? (
                    <div className="w-full h-full bg-white rounded-2xl overflow-hidden relative">
                      {store.showCode ? (
                        <div className="w-full h-full bg-slate-950 p-0 flex flex-col">
                            <div className="flex items-center justify-between p-2 bg-slate-900 border-b border-slate-800">
                                  <span className="text-xs text-slate-400 font-mono px-2">index.html</span>
                                  <button onClick={handleApplyCustomCode} className="px-3 py-1 bg-emerald-600 text-white text-xs rounded">Run Custom</button>
                            </div>
                            <textarea value={store.codeEdits} onChange={(e) => store.setCodeEdits(e.target.value)} className="flex-1 w-full bg-slate-950 text-emerald-400 font-mono text-xs p-4 resize-none focus:outline-none" spellCheck={false}/>
                        </div>
                      ) : (
                        <iframe ref={iframeRef} srcDoc={injectContextAndDriver(store.htmlCode)} title="3D Preview" className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-downloads" />
                      )}
                      
                      {!store.showCode && (
                          <button onClick={takeSnapshot} className="absolute bottom-6 left-6 z-20 p-3 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full text-white shadow-lg border border-white/20 transition-all group" title="Take Snapshot">
                              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </button>
                      )}
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                      <div className="w-24 h-24 mb-6 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                          <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                      </div>
                      <h3 className="text-xl font-semibold text-slate-300 mb-2">Ready to Build</h3>
                      <p className="text-slate-500">Describe your object or use a template below.</p>
                      
                      {/* Templates Quick Links (Empty State) */}
                      <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-xs">
                          {templates.slice(0, 2).map((t, i) => (
                              <button key={i} onClick={() => store.setPrompt(t.prompt)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-4 transition-colors flex flex-col items-center gap-2">
                                  <span className="text-2xl">{t.icon}</span>
                                  <span className="text-sm font-medium text-slate-300">{t.label}</span>
                              </button>
                          ))}
                      </div>

                      <div className="mt-6 text-sm text-slate-600 font-mono bg-slate-900/50 px-3 py-1 rounded border border-slate-800">
                          Press <kbd className="text-emerald-500">{cmdKey}+K</kbd> for commands
                      </div>
                    </div>
                )}
            </div>

            {/* FLOATING PANELS */}
            {store.htmlCode && !store.showCode && (
                <Panels 
                    handleToolClick={handleToolClick}
                    handleExport={handleExport}
                    sendViewCommand={sendViewCommand}
                    handleAutoOrient={handleAutoOrient}
                    workspaceMode={workspaceMode}
                />
            )}

            {/* UNDO/REDO & ERROR */}
            {store.htmlCode && !store.showCode && (
              <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md">
                 <button onClick={store.undo} disabled={store.historyIndex <= 0} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30" title="Undo (Ctrl+Z)"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                 <div className="w-px h-4 bg-slate-700 mx-1"></div>
                 <button onClick={store.redo} disabled={store.historyIndex >= store.history.length - 1} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30" title="Redo (Ctrl+Y)"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
              </div>
            )}

            {store.runtimeError && (
                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 border border-red-500/50 rounded-xl p-4 shadow-2xl z-30 flex flex-col gap-3 min-w-[320px]">
                     <div className="flex items-center gap-2 text-red-400">
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                         <h4 className="font-bold text-sm">Runtime Error</h4>
                     </div>
                     <p className="text-red-300 text-xs font-mono bg-red-950/30 p-2 rounded border border-red-500/20">{store.runtimeError}</p>
                     
                     <div className="flex gap-2 justify-end">
                        <button onClick={() => store.setRuntimeError(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Dismiss</button>
                        <button onClick={handleAutoFix} disabled={store.isFixing} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50">
                            {store.isFixing ? "Fixing..." : "Auto-Fix Code"}
                        </button>
                     </div>
                 </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
