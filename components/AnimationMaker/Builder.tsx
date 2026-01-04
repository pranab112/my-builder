import React, { useEffect, useRef } from 'react';
import { Button } from '../Button';
import { ImageUpload } from '../ImageUpload';
import { SavedProject, Tab } from './types';
import { generateAnimationCode, fixThreeJSCode, enhanceUserPrompt } from '../../services/geminiService';
import { Panels } from './Panels';
import { injectDriverScript } from './utils';
import { useBuilderStore } from '../../stores/builderStore';

interface BuilderProps {
  project: SavedProject;
  onBack: () => void;
  onUpdateProject: (code: string) => void;
}

export const Builder: React.FC<BuilderProps> = ({ project, onBack, onUpdateProject }) => {
  const store = useBuilderStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  // --- ACTIONS ---

  const handleGenerate = async () => {
    if (!store.prompt.trim() && store.refImages.length === 0) return;

    store.setGenerating(true);
    store.setError(null);
    store.setRuntimeError(null);
    store.setShowCode(false);

    try {
      const imageToUse = store.refImages.length > 0 ? store.refImages[0] : undefined;
      const code = await generateAnimationCode(store.prompt, store.htmlCode || undefined, imageToUse, project.category);
      
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

  const sendViewCommand = (cmd: string) => iframeRef.current?.contentWindow?.postMessage({ type: 'setView', view: cmd }, '*');
  const takeSnapshot = () => iframeRef.current?.contentWindow?.postMessage({ type: 'takeSnapshot' }, '*');
  const handleExport = (format: string) => iframeRef.current?.contentWindow?.postMessage({ type: 'exportModel', format }, '*');
  const handleAutoOrient = () => iframeRef.current?.contentWindow?.postMessage({ type: 'autoOrient', active: true }, '*');

  return (
    <div className={`h-full transition-all duration-300 ${store.isFullScreen ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col' : 'grid grid-cols-1 lg:grid-cols-12 gap-8'}`}>
      {/* SIDEBAR INPUT SECTION */}
      <div className={`flex flex-col space-y-6 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar pr-2 transition-all duration-300 ${store.isFullScreen ? 'hidden' : 'lg:col-span-4'}`}>
        <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
             <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             </button>
             <div>
                <h2 className="text-lg font-semibold text-white">{project.name}</h2>
                <span className="text-xs text-emerald-400 font-medium px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">{project.category}</span>
             </div>
          </div>
          
          <div className="flex flex-col gap-4">
             <div className="min-h-[120px]">
                <ImageUpload onImagesChange={store.setRefImages} selectedImages={store.refImages} compact={true} />
             </div>
             
             <div className="flex flex-col gap-2 relative">
                 <div className="flex justify-between items-end">
                    <p className="text-sm text-slate-300 font-medium">{store.htmlCode ? "Refine your design:" : "Describe the object:"}</p>
                    <button onClick={handleEnhancePrompt} disabled={store.isEnhancing || !store.prompt.trim()} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 disabled:opacity-50 transition-colors">
                        {store.isEnhancing ? <span className="animate-pulse">Enhancing...</span> : "Enhance Prompt"}
                    </button>
                 </div>
                 <textarea
                    ref={textareaRef}
                    value={store.prompt}
                    onChange={(e) => store.setPrompt(e.target.value)}
                    placeholder="e.g. Add a handle to the top..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all h-24 resize-none font-mono text-sm"
                 />
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
              <div className="absolute top-4 left-4 z-20 flex gap-2 flex-wrap max-w-[80%]">
                  <div className="bg-slate-900/90 rounded-xl border border-slate-700 shadow-xl p-1 flex gap-1 backdrop-blur-md">
                      {(['tools', 'print', 'material', 'environment', 'specs', 'export'] as Tab[]).map(t => (
                        <button key={t} onClick={() => store.setActiveTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${store.activeTab === t ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                      ))}
                  </div>
              </div>
            )}
            
            {store.htmlCode && !store.showCode && (
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                     <button onClick={() => store.toggleGrid()} className={`p-2 rounded-lg bg-slate-900/80 border border-slate-700 backdrop-blur text-xs ${store.showGrid ? 'text-emerald-400 border-emerald-500/30' : 'text-slate-500'}`} title="Toggle Grid">Grid</button>
                     <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
                     <button onClick={() => store.toggleFullScreen()} className={`p-2 rounded-lg bg-slate-900/80 border border-slate-700 backdrop-blur text-slate-300 hover:text-white hover:border-emerald-500/50 transition-all`}>
                        {store.isFullScreen ? "Exit Full Screen" : "Full Screen"}
                     </button>
                </div>
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
                       <iframe ref={iframeRef} srcDoc={injectDriverScript(store.htmlCode)} title="3D Preview" className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-downloads" />
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
                     <p className="text-slate-500">Describe your object or upload a reference.</p>
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
                />
            )}

            {/* UNDO/REDO & ERROR */}
            {store.htmlCode && !store.showCode && (
              <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md">
                 <button onClick={store.undo} disabled={store.historyIndex <= 0} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                 <div className="w-px h-4 bg-slate-700 mx-1"></div>
                 <button onClick={store.redo} disabled={store.historyIndex >= store.history.length - 1} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
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
  );
};
