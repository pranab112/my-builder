import React from 'react';
import { useBuilderStore } from '../../stores/builderStore';
import { PrinterPreset } from './types';
import { calculateFilamentCost } from '../../services/geometryCalculator';

interface PanelsProps {
  handleToolClick: (prompt: string) => void;
  handleExport: (format: string) => void;
  sendViewCommand: (cmd: string) => void;
  handleAutoOrient: () => void;
}

const CAD_TOOLS = [
  { id: 'fillet', label: 'Fillet Edges', prompt: 'Apply a smooth rounded fillet to all sharp edges of the model. Add a "Fillet Radius" slider to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-3.582-8-8-8zm0 14c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" /></svg> },
  { id: 'chamfer', label: 'Chamfer / Bevel', prompt: 'Apply a 45-degree chamfer (flat bevel) to the edges. Add a "Chamfer Size" slider to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6l4-4h8l4 4v12l-4 4H8l-4-4V6z" /></svg> },
  { id: 'shell', label: 'Shell / Hollow', prompt: 'Hollow out the interior to create a shell. Add a "Wall Thickness" slider to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11l-4-2m4 2l4-2" /></svg> },
  { id: 'trim', label: 'Trim / Crop', prompt: 'Trim the geometry by cutting away the [SPECIFY PART]. Add a "Cut Position" slider.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0 0L2.121 2.121" /></svg> },
  { id: 'erase', label: 'Eraser / Delete', prompt: 'Remove the [SPECIFY PART] from the model completely.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> },
  { id: 'explode', label: 'Explode View', prompt: 'Create an animated exploded view. Add an "Expansion" slider to control the distance between parts.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg> },
  { id: 'pattern', label: 'Linear Pattern', prompt: 'Create a linear array pattern. Add "Count" and "Spacing" sliders to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
  { id: 'cut', label: 'Section Cut', prompt: 'Apply a clipping plane to create a section view. Add a slider to move the plane.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg> },
  { id: 'measure', label: 'Dimensions', prompt: 'Add technical dimension lines and annotations to the model to show its scale.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg> },
];

export const Panels: React.FC<PanelsProps> = ({ handleToolClick, handleExport, sendViewCommand, handleAutoOrient }) => {
  const store = useBuilderStore();
  
  // Use the extracted service for calculation
  const { weight, cost } = store.specs 
    ? calculateFilamentCost(
        store.specs.width,
        store.specs.height,
        store.specs.depth,
        store.materialType,
        store.infillPercentage
      )
    : { weight: 0, cost: 0 };

  return (
    <div className="absolute left-4 top-16 bottom-16 w-64 z-10 flex flex-col gap-2 overflow-y-auto custom-scrollbar pointer-events-none">
       
       {store.activeTab === 'tools' && (
           <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Transform Gizmos</h4>
              <div className="grid grid-cols-4 gap-2 mb-4">
                   <button onClick={() => store.setGizmoMode('translate')} className={`p-2 rounded ${store.gizmoMode === 'translate' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Move"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                   <button onClick={() => store.setGizmoMode('rotate')} className={`p-2 rounded ${store.gizmoMode === 'rotate' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Rotate"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                   <button onClick={() => store.setGizmoMode('scale')} className={`p-2 rounded ${store.gizmoMode === 'scale' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Scale"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                   <button onClick={() => store.setGizmoMode('none')} className={`p-2 rounded ${store.gizmoMode === 'none' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="No Gizmo"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>

              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">CAD Operations</h4>
              <div className="grid grid-cols-4 gap-2">
                 {CAD_TOOLS.map((tool) => (
                   <button key={tool.id} onClick={() => handleToolClick(tool.prompt)} className="aspect-square flex flex-col items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-600 hover:text-white transition-all bg-slate-800 border border-slate-700 hover:border-emerald-500">
                     {tool.icon}
                   </button>
                 ))}
              </div>
           </div>
       )}

       {store.activeTab === 'print' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Printer Setup</h4>
              
              <div>
                  <label className="text-xs text-slate-300 block mb-2">Printer Model</label>
                  <select value={store.printerPreset} onChange={(e) => store.setPrinterPreset(e.target.value as PrinterPreset)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white">
                      <option value="ender3">Ender 3 (220x220)</option>
                      <option value="bambu">Bambu Lab X1 (256x256)</option>
                      <option value="prusa">Prusa MK3S+ (250x210)</option>
                  </select>
              </div>

              <div>
                  <label className="text-xs text-slate-300 block mb-2">Material</label>
                  <div className="flex gap-1 mb-2">
                      <button onClick={() => store.setMaterialType('pla')} className={`flex-1 text-[10px] py-1 rounded ${store.materialType === 'pla' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>PLA</button>
                      <button onClick={() => store.setMaterialType('petg')} className={`flex-1 text-[10px] py-1 rounded ${store.materialType === 'petg' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>PETG</button>
                      <button onClick={() => store.setMaterialType('abs')} className={`flex-1 text-[10px] py-1 rounded ${store.materialType === 'abs' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>ABS</button>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Infill: {store.infillPercentage}%</span>
                      <input type="range" min="0" max="100" value={store.infillPercentage} onChange={(e) => store.setInfillPercentage(parseInt(e.target.value))} className="w-20 h-1 bg-slate-700 rounded-lg accent-orange-500" />
                  </div>
              </div>

              <div className="pt-2 border-t border-slate-700 space-y-3">
                   <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Analysis</h4>
                   <button onClick={() => store.setRenderMode(store.renderMode === 'overhang' ? 'blueprint' : 'overhang')} className={`w-full py-2 rounded text-xs font-medium border ${store.renderMode === 'overhang' ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                       {store.renderMode === 'overhang' ? 'Hide Overhangs' : 'Show Overhangs (>45°)'}
                   </button>
                   
                   <div>
                       <div className="flex justify-between text-xs text-slate-400 mb-1">
                           <span>Layer View</span>
                           <span>{store.slicerLayer}%</span>
                       </div>
                       <input 
                          type="range" min="0" max="100" 
                          value={store.slicerLayer} 
                          onChange={(e) => { store.setSlicerLayer(parseInt(e.target.value)); store.setRenderMode('slicer'); }} 
                          className="w-full h-1 bg-slate-700 rounded-lg accent-orange-500" 
                       />
                   </div>

                   <button onClick={handleAutoOrient} className="w-full py-2 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700">
                       Auto-Orient (Lay Flat)
                   </button>
              </div>

              <div className="pt-2 border-t border-slate-700">
                   <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Estimates</h4>
                   <div className="bg-slate-800 p-2 rounded border border-slate-700 space-y-1">
                       <div className="flex justify-between text-xs text-slate-300">
                           <span>Weight</span>
                           <span className="font-mono">{weight.toFixed(1)}g</span>
                       </div>
                       <div className="flex justify-between text-xs text-slate-300">
                           <span>Cost</span>
                           <span className="font-mono text-emerald-400">${cost.toFixed(2)}</span>
                       </div>
                   </div>
              </div>
           </div>
       )}

       {/* ... (Other tabs remain unchanged) ... */}
       {store.activeTab === 'environment' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Viewport Settings</h4>
              
              <div>
                  <label className="text-xs text-slate-300 block mb-2">Projection View</label>
                  <div className="grid grid-cols-3 gap-1">
                      <button onClick={() => sendViewCommand('top')} className="px-2 py-1 bg-slate-800 text-xs text-slate-300 rounded hover:bg-slate-700">Top</button>
                      <button onClick={() => sendViewCommand('front')} className="px-2 py-1 bg-slate-800 text-xs text-slate-300 rounded hover:bg-slate-700">Front</button>
                      <button onClick={() => sendViewCommand('side')} className="px-2 py-1 bg-slate-800 text-xs text-slate-300 rounded hover:bg-slate-700">Side</button>
                      <button onClick={() => sendViewCommand('iso')} className="px-2 py-1 bg-slate-800 text-xs text-slate-300 rounded hover:bg-slate-700">Iso</button>
                      <button onClick={() => sendViewCommand('center')} className="col-span-2 px-2 py-1 bg-slate-800 text-xs text-slate-300 rounded hover:bg-slate-700">Center View</button>
                  </div>
              </div>

              <div>
                   <label className="text-xs text-slate-300 block mb-2">Lighting Studio</label>
                   <div className="flex bg-slate-800 rounded-lg p-1">
                       <button onClick={() => store.setEnvironment('studio')} className={`flex-1 text-[10px] py-1 rounded ${store.environment === 'studio' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Studio</button>
                       <button onClick={() => store.setEnvironment('dark')} className={`flex-1 text-[10px] py-1 rounded ${store.environment === 'dark' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Dark</button>
                       <button onClick={() => store.setEnvironment('sunset')} className={`flex-1 text-[10px] py-1 rounded ${store.environment === 'sunset' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Warm</button>
                   </div>
              </div>

              <div className="pt-2 border-t border-slate-700">
                   <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-300">Auto-Rotate</span>
                      <input type="checkbox" checked={store.turntableActive} onChange={(e) => store.setTurntableActive(e.target.checked)} className="accent-purple-500" />
                   </div>
                   
                   <div className="space-y-1">
                      <div className="flex justify-between">
                          <span className="text-xs text-slate-300">Cross-Section Y</span>
                          <span className="text-[10px] text-slate-500">{store.clippingValue.toFixed(1)}</span>
                      </div>
                      <input type="range" min="-5" max="5" step="0.1" value={store.clippingValue} onChange={(e) => store.setClippingValue(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500" />
                   </div>
              </div>
           </div>
       )}

       {store.activeTab === 'material' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Surface Finish</h4>
              <div>
                  <label className="text-xs text-slate-300 block mb-1">Base Color</label>
                  <div className="flex gap-2">
                      <input type="color" value={store.materialConfig.color} onChange={(e) => store.setMaterialConfig(p => ({...p, color: e.target.value}))} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                      <input type="text" value={store.materialConfig.color} readOnly className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 text-xs text-slate-400 font-mono" />
                  </div>
              </div>
              <div>
                  <label className="text-xs text-slate-300 block mb-1 flex justify-between">
                      <span>Roughness</span> 
                      <span className="text-slate-500">{Math.round(store.materialConfig.roughness * 100)}%</span>
                  </label>
                  <input type="range" min="0" max="1" step="0.1" value={store.materialConfig.roughness} onChange={(e) => store.setMaterialConfig(p => ({...p, roughness: parseFloat(e.target.value)}))} className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                  <label className="text-xs text-slate-300 block mb-1 flex justify-between">
                      <span>Metalness</span>
                      <span className="text-slate-500">{Math.round(store.materialConfig.metalness * 100)}%</span>
                  </label>
                  <input type="range" min="0" max="1" step="0.1" value={store.materialConfig.metalness} onChange={(e) => store.setMaterialConfig(p => ({...p, metalness: parseFloat(e.target.value)}))} className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              
              <div className="space-y-2 pt-2 border-t border-slate-700">
                   <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Inspection Mode</h4>
                   <div className="flex gap-1 flex-wrap">
                       <button onClick={() => store.setRenderMode('blueprint')} className={`px-2 py-1 text-[10px] rounded ${store.renderMode === 'blueprint' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Blueprint</button>
                       <button onClick={() => store.setRenderMode('realistic')} className={`px-2 py-1 text-[10px] rounded ${store.renderMode === 'realistic' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Realistic</button>
                       <button onClick={() => store.setRenderMode('wireframe')} className={`px-2 py-1 text-[10px] rounded ${store.renderMode === 'wireframe' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Wireframe</button>
                       <button onClick={() => store.setRenderMode('analysis')} className={`px-2 py-1 text-[10px] rounded ${store.renderMode === 'analysis' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Topology</button>
                   </div>
              </div>
           </div>
       )}
       
       {store.activeTab === 'export' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Export Formats</h4>
              <p className="text-xs text-slate-400 leading-relaxed">Download your model for use in Game Engines, 3D Printing, or Web XR.</p>
              
              <div className="grid grid-cols-1 gap-2">
                   <button onClick={() => handleExport('gltf')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-emerald-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-emerald-400">GLB / GLTF</span>
                           <span className="text-[10px] text-slate-500">Web Standard (Textures included)</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   </button>
                   
                   <button onClick={() => handleExport('obj')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-blue-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-blue-400">OBJ</span>
                           <span className="text-[10px] text-slate-500">Universal Geometry</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   </button>
                   
                   <button onClick={() => handleExport('stl')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-amber-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-amber-400">STL</span>
                           <span className="text-[10px] text-slate-500">3D Printing Ready</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   </button>
              </div>
           </div>
       )}

       {store.activeTab === 'specs' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Geometry Audit</h4>
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
                              <span className="text-sm font-mono text-amber-400">{store.specs.tris.toLocaleString()} tris</span>
                          </div>
                      </div>
                      <div className="pt-2 border-t border-slate-700">
                          <h5 className="text-xs font-semibold text-slate-300 mb-2">Estimates (PLA)</h5>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>Volume</span>
                              <span>{(store.specs.width * store.specs.height * store.specs.depth).toFixed(0)} cm³</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400">
                              <span>Weight</span>
                              <span>~{weight.toFixed(1)} g</span>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="text-xs text-slate-500 text-center py-4">Calculating geometry...</div>
              )}
           </div>
       )}
    </div>
  );
};
