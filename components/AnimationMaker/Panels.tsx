
import React from 'react';
import { useBuilderStore } from '../../stores/builderStore';
import { PrinterPreset, WorkspaceMode } from './types';
import { calculateFilamentCost } from '../../services/geometryCalculator';

interface PanelsProps {
  handleToolClick: (prompt: string) => void;
  handleExport: (format: string) => void;
  sendViewCommand: (cmd: string) => void;
  handleAutoOrient: () => void;
  workspaceMode: WorkspaceMode;
}

const CAD_TOOLS = [
  { id: 'fillet', label: 'Fillet Edges', prompt: 'Apply a smooth rounded fillet to all sharp edges of the model. Add a "Fillet Radius" slider to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-3.582-8-8-8zm0 14c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" /></svg> },
  { id: 'chamfer', label: 'Chamfer', prompt: 'Apply a 45-degree chamfer (flat bevel) to the edges. Add a "Chamfer Size" slider to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6l4-4h8l4 4v12l-4 4H8l-4-4V6z" /></svg> },
  { id: 'shell', label: 'Shell', prompt: 'Hollow out the interior to create a shell. Add a "Wall Thickness" slider to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11l-4-2m4 2l4-2" /></svg> },
  { id: 'trim', label: 'Trim', prompt: 'Trim the geometry by cutting away the [SPECIFY PART]. Add a "Cut Position" slider.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0 0L2.121 2.121" /></svg> },
  { id: 'erase', label: 'Delete', prompt: 'Remove the [SPECIFY PART] from the model completely.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> },
  { id: 'explode', label: 'Explode', prompt: 'Create an animated exploded view. Add an "Expansion" slider to control the distance between parts.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg> },
  { id: 'pattern', label: 'Pattern', prompt: 'Create a linear array pattern. Add "Count" and "Spacing" sliders to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
  { id: 'cut', label: 'Section', prompt: 'Apply a clipping plane to create a section view. Add a slider to move the plane.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg> },
];

export const Panels: React.FC<PanelsProps> = ({ handleToolClick, handleExport, sendViewCommand, handleAutoOrient, workspaceMode }) => {
  const store = useBuilderStore();
  
  const { weight, cost } = store.specs 
    ? calculateFilamentCost(
        store.specs.width,
        store.specs.height,
        store.specs.depth,
        store.materialType,
        store.infillPercentage
      )
    : { weight: 0, cost: 0 };

  const handleToggleRecording = () => {
    store.setIsRecording(!store.isRecording);
    window.postMessage({ type: store.isRecording ? 'stopRecording' : 'startRecording' }, '*');
  };

  return (
    <div className="absolute left-4 top-16 bottom-16 w-64 z-10 flex flex-col gap-2 overflow-y-auto custom-scrollbar pointer-events-none">
       
       {store.activeTab === 'tools' && (
           <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Gizmos & Measure</h4>
              <div className="grid grid-cols-4 gap-2 mb-4">
                   <button onClick={() => store.setGizmoMode('translate')} className={`p-2 rounded ${store.gizmoMode === 'translate' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Move"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                   <button onClick={() => store.setGizmoMode('rotate')} className={`p-2 rounded ${store.gizmoMode === 'rotate' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Rotate"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                   <button onClick={() => store.setGizmoMode('scale')} className={`p-2 rounded ${store.gizmoMode === 'scale' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Scale"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                   <button onClick={() => store.setGizmoMode('measure')} className={`p-2 rounded ${store.gizmoMode === 'measure' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Precise Measure"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg></button>
              </div>

              {/* HIDE COMPLEX CAD TOOLS FOR MAKERS TO SIMPLIFY UI */}
              {workspaceMode !== 'maker' && (
                  <>
                    <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">CAD Modifiers</h4>
                    <div className="grid grid-cols-4 gap-2">
                        {CAD_TOOLS.map((tool) => (
                        <button key={tool.id} onClick={() => handleToolClick(tool.prompt)} className="aspect-square flex flex-col items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-600 hover:text-white transition-all bg-slate-800 border border-slate-700 hover:border-emerald-500" title={tool.label}>
                            {tool.icon}
                        </button>
                        ))}
                    </div>
                  </>
              )}
              
              <div className="mt-3 pt-2 border-t border-slate-700">
                  <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Game Dev</h4>
                  <div className="flex gap-2">
                       <button onClick={() => window.postMessage({ type: 'decimate', level: 0.5 }, '*')} className="flex-1 bg-slate-800 text-[10px] text-slate-300 py-1.5 rounded border border-slate-700 hover:bg-slate-700">
                          Decimate 50%
                       </button>
                       <button onClick={() => window.postMessage({ type: 'decimate', level: 0.2 }, '*')} className="flex-1 bg-slate-800 text-[10px] text-slate-300 py-1.5 rounded border border-slate-700 hover:bg-slate-700">
                          Decimate 80%
                       </button>
                  </div>
              </div>
           </div>
       )}

       {store.activeTab === 'print' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Maker Setup</h4>
              
              <select value={store.printerPreset} onChange={(e) => store.setPrinterPreset(e.target.value as PrinterPreset)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white">
                  <option value="ender3">Ender 3 (220x220)</option>
                  <option value="bambu">Bambu Lab X1 (256x256)</option>
                  <option value="prusa">Prusa MK3S+ (250x210)</option>
              </select>

              <div>
                  <label className="text-xs text-slate-300 block mb-2">Material</label>
                  <div className="flex gap-1 mb-2">
                      {(['pla','petg','abs','tpu'] as const).map(m => (
                          <button key={m} onClick={() => store.setMaterialType(m)} className={`flex-1 text-[10px] py-1 uppercase rounded ${store.materialType === m ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{m}</button>
                      ))}
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Infill: {store.infillPercentage}%</span>
                      <input type="range" min="0" max="100" value={store.infillPercentage} onChange={(e) => store.setInfillPercentage(parseInt(e.target.value))} className="w-16 h-1 bg-slate-700 rounded-lg accent-orange-500" />
                  </div>
              </div>

              <div className="pt-2 border-t border-slate-700 space-y-2">
                   <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pre-Flight Check</h4>
                   
                   <button onClick={() => window.postMessage({ type: 'checkManifold' }, '*')} className="w-full py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-2">
                       <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       Manifold Check
                   </button>
                   
                   <button onClick={() => { store.setShowSupports(!store.showSupports); window.postMessage({ type: 'toggleSupports', active: !store.showSupports }, '*'); }} className={`w-full py-1.5 rounded text-xs font-medium border flex items-center justify-center gap-2 ${store.showSupports ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                       <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                       {store.showSupports ? 'Hide Supports' : 'Preview Supports'}
                   </button>
                   
                   <div className="pt-1">
                       <div className="flex justify-between text-xs text-slate-400 mb-1">
                           <span>Slicer Preview</span>
                           <span>{store.slicerLayer}%</span>
                       </div>
                       <input 
                          type="range" min="0" max="100" 
                          value={store.slicerLayer} 
                          onChange={(e) => { store.setSlicerLayer(parseInt(e.target.value)); store.setRenderMode('slicer'); }} 
                          className="w-full h-1 bg-slate-700 rounded-lg accent-orange-500" 
                       />
                   </div>
              </div>

              <div className="bg-slate-800 p-2 rounded border border-slate-700 space-y-1 mt-2">
                   <div className="flex justify-between text-xs text-slate-300">
                       <span>Weight</span>
                       <span className="font-mono">{weight.toFixed(1)}g</span>
                   </div>
                   <div className="flex justify-between text-xs text-slate-300">
                       <span>Est. Cost</span>
                       <span className="font-mono text-emerald-400">${cost.toFixed(2)}</span>
                   </div>
              </div>
           </div>
       )}

       {store.activeTab === 'environment' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Lighting & HDRI</h4>
              
              <div className="space-y-2">
                   <label className="text-xs text-slate-300 block">Environment Preset</label>
                   <select value={store.environment} onChange={(e) => store.setEnvironment(e.target.value as any)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white">
                      <option value="studio">Studio Light</option>
                      <option value="sunset">Warm Sunset</option>
                      <option value="dark">Dark Mode</option>
                      <option value="park">Outdoor Park</option>
                      <option value="lobby">Hotel Lobby</option>
                   </select>
              </div>

              <div className="pt-2 border-t border-slate-700">
                   <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Media</h4>
                   <button 
                       onClick={handleToggleRecording} 
                       className={`w-full py-2 rounded text-xs font-bold border flex items-center justify-center gap-2 ${store.isRecording ? 'bg-red-500/20 text-red-400 border-red-500 animate-pulse' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                   >
                       <div className={`w-2 h-2 rounded-full ${store.isRecording ? 'bg-red-500' : 'bg-red-500'}`}></div>
                       {store.isRecording ? 'Recording...' : 'Record Turntable'}
                   </button>
              </div>

              <div className="pt-2 border-t border-slate-700">
                   <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-300">Auto-Rotate</span>
                      <input type="checkbox" checked={store.turntableActive} onChange={(e) => store.setTurntableActive(e.target.checked)} className="accent-purple-500" />
                   </div>
                   
                   <div className="space-y-1">
                      <div className="flex justify-between">
                          <span className="text-xs text-slate-300">Section Cut</span>
                          <span className="text-[10px] text-slate-500">{store.clippingValue.toFixed(1)}</span>
                      </div>
                      <input type="range" min="-5" max="5" step="0.1" value={store.clippingValue} onChange={(e) => store.setClippingValue(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500" />
                   </div>
              </div>
           </div>
       )}

       {store.activeTab === 'specs' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Engineering</h4>
              
              <div className="flex gap-2 mb-2">
                   <button onClick={() => { store.setUnits('mm'); window.postMessage({ type: 'setUnits', units: 'mm' }, '*'); }} className={`flex-1 py-1 rounded text-xs ${store.units === 'mm' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Metric (mm)</button>
                   <button onClick={() => { store.setUnits('inch'); window.postMessage({ type: 'setUnits', units: 'inch' }, '*'); }} className={`flex-1 py-1 rounded text-xs ${store.units === 'inch' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Imperial (in)</button>
              </div>

              {store.specs ? (
                  <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-800 p-2 rounded border border-slate-700">
                              <span className="text-[10px] text-slate-500 block">Width (X)</span>
                              <span className="text-sm font-mono text-emerald-400">{store.specs.width.toFixed(2)}</span>
                          </div>
                          <div className="bg-slate-800 p-2 rounded border border-slate-700">
                              <span className="text-[10px] text-slate-500 block">Height (Y)</span>
                              <span className="text-sm font-mono text-emerald-400">{store.specs.height.toFixed(2)}</span>
                          </div>
                          <div className="bg-slate-800 p-2 rounded border border-slate-700">
                              <span className="text-[10px] text-slate-500 block">Depth (Z)</span>
                              <span className="text-sm font-mono text-emerald-400">{store.specs.depth.toFixed(2)}</span>
                          </div>
                          <div className="bg-slate-800 p-2 rounded border border-slate-700">
                              <span className="text-[10px] text-slate-500 block">Poly Count</span>
                              <span className="text-sm font-mono text-amber-400">{store.specs.tris.toLocaleString()}</span>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="text-xs text-slate-500 text-center py-4">Calculating geometry...</div>
              )}
           </div>
       )}
       
       {store.activeTab === 'material' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Appearance</h4>
              <div>
                  <label className="text-xs text-slate-300 block mb-1">Base Color</label>
                  <div className="flex gap-2">
                      <input type="color" value={store.materialConfig.color} onChange={(e) => store.setMaterialConfig(p => ({...p, color: e.target.value}))} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                      <input type="text" value={store.materialConfig.color} readOnly className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 text-xs text-slate-400 font-mono" />
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Roughness</label>
                    <input type="range" min="0" max="1" step="0.1" value={store.materialConfig.roughness} onChange={(e) => store.setMaterialConfig(p => ({...p, roughness: parseFloat(e.target.value)}))} className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Metalness</label>
                    <input type="range" min="0" max="1" step="0.1" value={store.materialConfig.metalness} onChange={(e) => store.setMaterialConfig(p => ({...p, metalness: parseFloat(e.target.value)}))} className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                  </div>
              </div>
           </div>
       )}

       {store.activeTab === 'export' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Export Formats</h4>
              
              <div className="grid grid-cols-1 gap-2">
                   <button onClick={() => handleExport('gltf')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-emerald-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-emerald-400">GLB / GLTF</span>
                           <span className="text-[10px] text-slate-500">Game & Web Ready</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   </button>
                   
                   <button onClick={() => handleExport('stl')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-amber-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-amber-400">STL</span>
                           <span className="text-[10px] text-slate-500">Manufacturing Ready</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   </button>
              </div>
           </div>
       )}
    </div>
  );
};
