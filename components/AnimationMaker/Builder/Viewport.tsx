
import React from 'react';
import { useBuilderStore } from '../../../stores/builderStore';
import { ViewCube } from '../ViewCube';
import { Button } from '../../Button';
import { Tab } from '../types';

interface BuilderViewportProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  injectContextAndDriver: (html: string) => string;
  onApplyCustomCode: () => void;
  sendViewCommand: (cmd: string) => void;
  takeSnapshot: () => void;
  activeModeTabs: Tab[];
  cmdKey: string;
}

export const BuilderViewport: React.FC<BuilderViewportProps> = ({ 
  iframeRef, 
  injectContextAndDriver, 
  onApplyCustomCode, 
  sendViewCommand, 
  takeSnapshot,
  activeModeTabs,
  cmdKey
}) => {
  const store = useBuilderStore();

  return (
    <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl shadow-2xl p-2 flex flex-col relative overflow-hidden backdrop-blur-sm">
      
      {store.htmlCode && !store.showCode && (
        <div className="absolute top-4 left-4 z-20 flex gap-2 flex-wrap max-w-[80%] pointer-events-none">
          <div className="bg-slate-900/90 rounded-xl border border-slate-700 shadow-xl p-1 flex gap-1 backdrop-blur-md pointer-events-auto">
            {activeModeTabs.map(t => (
              <button key={t} onClick={() => store.setActiveTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${store.activeTab === t ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
        </div>
      )}
      
      {store.htmlCode && !store.showCode && (
        <>
          <ViewCube onViewChange={sendViewCommand} />
          
          <div className="absolute bottom-4 right-4 z-20 flex gap-2">
            <button onClick={() => store.setHelpOpen(true)} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Keyboard Shortcuts">?</button>
            <button onClick={() => store.toggleGrid()} className={`p-2 rounded-lg bg-slate-900/80 border border-slate-700 backdrop-blur text-xs ${store.showGrid ? 'text-emerald-400 border-emerald-500/30' : 'text-slate-500'}`} title="Toggle Grid">Grid</button>
            <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
            <button onClick={() => store.toggleFullScreen()} className={`p-2 rounded-lg bg-slate-900/80 border border-slate-700 backdrop-blur text-slate-300 hover:text-white hover:border-emerald-500/50 transition-all`}>
              {store.isFullScreen ? "Exit Full Screen" : "Full Screen"}
            </button>
          </div>

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
                  <button onClick={onApplyCustomCode} className="px-3 py-1 bg-emerald-600 text-white text-xs rounded">Run Custom</button>
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
            
            <div className="mt-6 text-sm text-slate-600 font-mono bg-slate-900/50 px-3 py-1 rounded border border-slate-800">
              Press <kbd className="text-emerald-500">{cmdKey}+K</kbd> for commands
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
