
import React, { useEffect, useRef, useState } from 'react';
import { useBuilderStore } from '../../stores/builderStore';
import { PrinterPreset, WorkspaceMode, ParameterControl } from './types';
import { calculateFilamentCost } from '../../services/geometryCalculator';

interface PanelsProps {
  handleToolClick: (prompt: string) => void;
  handleExport: (format: string) => void;
  sendViewCommand: (cmd: string) => void;
  handleAutoOrient: () => void;
  workspaceMode: WorkspaceMode;
  handleSelectObject?: (id: string | null) => void;
  handleParameterChange?: (name: string, value: any) => void;
  handleSketchExtrude?: (points: {x:number, y:number}[], height: number) => void;
}

const CAD_TOOLS = [
  { id: 'fillet', label: 'Fillet Edges', prompt: 'Apply a smooth rounded fillet to all sharp edges of the selected part. Add a "Fillet Radius" slider to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-3.582-8-8-8zm0 14c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" /></svg> },
  { id: 'chamfer', label: 'Chamfer', prompt: 'Apply a 45-degree chamfer (flat bevel) to the edges. Add a "Chamfer Size" slider to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6l4-4h8l4 4v12l-4 4H8l-4-4V6z" /></svg> },
  { id: 'shell', label: 'Shell', prompt: 'Hollow out the interior to create a shell. Add a "Wall Thickness" slider to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11l-4-2m4 2l4-2" /></svg> },
  { id: 'trim', label: 'Trim', prompt: 'Trim the geometry by cutting away the [SPECIFY PART]. Add a "Cut Position" slider.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0 0L2.121 2.121" /></svg> },
  { id: 'erase', label: 'Delete', prompt: 'Remove the selected object from the model completely.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> },
  { id: 'explode', label: 'Explode', prompt: 'Create an animated exploded view. Add an "Expansion" slider to control the distance between parts.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg> },
  { id: 'pattern', label: 'Pattern', prompt: 'Create a linear array pattern. Add "Count" and "Spacing" sliders to the GUI.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
  { id: 'cut', label: 'Section', prompt: 'Apply a clipping plane to create a section view. Add a slider to move the plane.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg> },
];

export const Panels: React.FC<PanelsProps> = ({ handleToolClick, handleExport, sendViewCommand, handleAutoOrient, workspaceMode, handleSelectObject, handleParameterChange, handleSketchExtrude }) => {
  const store = useBuilderStore();
  
  // Sketch State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sketchPoints, setSketchPoints] = useState<{x:number, y:number}[]>([]);
  const [extrudeHeight, setExtrudeHeight] = useState(2);
  const [mousePos, setMousePos] = useState<{x:number, y:number} | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [orthoEnabled, setOrthoEnabled] = useState(false);

  // Helper: Format Time
  const formatTime = (ts: number) => {
      const d = new Date(ts);
      return `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
  };

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

  const handleBooleanClick = (op: 'union' | 'subtract' | 'intersect') => {
      if (store.selectedObjectIds.length > 0) {
          store.setBooleanOp(op);
          store.setBooleanTarget(store.selectedObjectIds[0]);
      } else {
          alert("Select a Target object first.");
      }
  };

  const handleAddBookmark = () => {
      window.postMessage({ type: 'requestCameraState' }, '*');
  };

  const handleRestoreBookmark = (bm: any) => {
      window.postMessage({ type: 'setCameraState', position: bm.position, target: bm.target }, '*');
  };

  // Sketch Handlers
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
      if(!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / rect.width * 20 - 10; 
      const rawY = -((e.clientY - rect.top) / rect.height * 20 - 10);
      
      let x = rawX;
      let y = rawY;

      // Snap to Grid
      if (snapEnabled) {
          x = Math.round(x);
          y = Math.round(y);
      }

      // Orthogonal (Shift)
      if (e.shiftKey && sketchPoints.length > 0) {
          const last = sketchPoints[sketchPoints.length - 1];
          const dx = Math.abs(x - last.x);
          const dy = Math.abs(y - last.y);
          if (dx > dy) y = last.y;
          else x = last.x;
          setOrthoEnabled(true);
      } else {
          setOrthoEnabled(false);
      }

      setMousePos({x, y});
  };

  const handleCanvasClick = () => {
      if(mousePos) {
          setSketchPoints(prev => [...prev, mousePos]);
      }
  };

  const handleClearSketch = () => setSketchPoints([]);
  
  const handleCloseLoop = () => {
      if(sketchPoints.length > 2) {
          setSketchPoints(prev => [...prev, prev[0]]);
      }
  };

  const handleAddRect = () => {
      setSketchPoints([
          {x: -5, y: -5},
          {x: 5, y: -5},
          {x: 5, y: 5},
          {x: -5, y: 5},
          {x: -5, y: -5}
      ]);
  };

  const handleAddCircle = () => {
      const pts = [];
      const segments = 32;
      for(let i=0; i<=segments; i++) {
          const theta = (i/segments) * Math.PI * 2;
          pts.push({
              x: Math.cos(theta) * 5,
              y: Math.sin(theta) * 5
          });
      }
      setSketchPoints(pts);
  };
  
  const handleExtrude = () => {
      if(handleSketchExtrude) handleSketchExtrude(sketchPoints, extrudeHeight);
      setSketchPoints([]);
  };

  // Draw Sketch Loop
  useEffect(() => {
      if(!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if(!ctx) return;
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;
      
      ctx.clearRect(0,0,w,h);
      
      // Grid
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(let i=0; i<=20; i++) {
          const x = i * (w/20);
          ctx.moveTo(x, 0); ctx.lineTo(x, h);
          const y = i * (h/20);
          ctx.moveTo(0, y); ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Axis
      ctx.strokeStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h);
      ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
      ctx.stroke();

      const toPxX = (v: number) => (v + 10) / 20 * w;
      const toPxY = (v: number) => (-v + 10) / 20 * h;

      // Draw Points
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#10b981';
      
      if(sketchPoints.length > 0) {
          ctx.beginPath();
          ctx.moveTo(toPxX(sketchPoints[0].x), toPxY(sketchPoints[0].y));
          for(let i=1; i<sketchPoints.length; i++) {
              ctx.lineTo(toPxX(sketchPoints[i].x), toPxY(sketchPoints[i].y));
          }
          ctx.stroke();
          
          sketchPoints.forEach(p => {
              ctx.beginPath();
              ctx.arc(toPxX(p.x), toPxY(p.y), 3, 0, Math.PI*2);
              ctx.fill();
          });
      }

      // Draw Ghost Line
      if (mousePos && sketchPoints.length > 0) {
          ctx.strokeStyle = '#34d399';
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          const last = sketchPoints[sketchPoints.length - 1];
          ctx.moveTo(toPxX(last.x), toPxY(last.y));
          ctx.lineTo(toPxX(mousePos.x), toPxY(mousePos.y));
          ctx.stroke();
          ctx.setLineDash([]);

          // Length Label
          const dist = Math.sqrt(Math.pow(mousePos.x - last.x, 2) + Math.pow(mousePos.y - last.y, 2));
          ctx.fillStyle = 'white';
          ctx.font = '10px monospace';
          ctx.fillText(`${dist.toFixed(1)}m`, toPxX(mousePos.x) + 10, toPxY(mousePos.y) - 10);
      }

      // Cursor
      if (mousePos) {
          ctx.beginPath();
          ctx.arc(toPxX(mousePos.x), toPxY(mousePos.y), 4, 0, Math.PI*2);
          ctx.strokeStyle = 'white';
          ctx.stroke();
      }

  }, [sketchPoints, mousePos]);

  useEffect(() => {
      if (store.booleanOp && store.booleanTarget && store.selectedObjectIds.length > 0) {
          const toolId = store.selectedObjectIds[0];
          if (toolId !== store.booleanTarget) {
              window.postMessage({ 
                  type: 'performBoolean', 
                  op: store.booleanOp, 
                  targetId: store.booleanTarget, 
                  toolId: toolId 
              }, '*');
              store.setBooleanOp(null);
              store.setBooleanTarget(null);
          }
      }
  }, [store.selectedObjectIds, store.booleanOp, store.booleanTarget]);

  return (
    <div className="absolute left-4 top-16 bottom-16 w-64 z-10 flex flex-col gap-2 overflow-y-auto custom-scrollbar pointer-events-none">
       
       {store.activeTab === 'history' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in flex flex-col max-h-[500px]">
               <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Design History</h4>
               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                   {store.historyEntries.length === 0 ? (
                       <p className="text-xs text-slate-500 italic">No history yet.</p>
                   ) : (
                       store.historyEntries.map((entry, idx) => (
                           <div key={entry.id} className="relative pl-4 border-l border-slate-700 last:border-0 group">
                               <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-slate-800 border border-slate-600 group-hover:bg-emerald-500 group-hover:border-emerald-400 transition-colors"></div>
                               <div className="bg-slate-800/50 p-2 rounded hover:bg-slate-700 transition-colors cursor-pointer" onClick={() => store.restoreHistoryEntry(entry)}>
                                   <div className="flex justify-between items-start mb-1">
                                       <span className="text-xs font-bold text-slate-300 truncate w-32">{entry.prompt}</span>
                                       <span className="text-[9px] text-slate-500 font-mono">{formatTime(entry.timestamp)}</span>
                                   </div>
                                   <p className="text-[10px] text-slate-400 truncate">v{store.historyEntries.length - idx}</p>
                               </div>
                           </div>
                       ))
                   )}
               </div>
               <div className="text-[9px] text-slate-500 text-center border-t border-slate-700 pt-2">
                   Click an entry to revert to that state.
               </div>
           </div>
       )}

       {store.activeTab === 'parameters' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
               <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Parametric Constraints</h4>
               {store.parameters.length === 0 ? (
                   <p className="text-xs text-slate-500 italic text-center p-4">No parameters exposed by model.</p>
               ) : (
                   <div className="space-y-3">
                       {store.parameters.map((param, idx) => (
                           <div key={idx} className="space-y-1">
                               <div className="flex justify-between text-xs text-slate-300">
                                   <span>{param.name}</span>
                                   <span className="font-mono text-[10px]">{typeof param.value === 'number' ? param.value.toFixed(2) : param.value}</span>
                               </div>
                               {param.type === 'number' && (
                                   <input 
                                       type="range" 
                                       min={param.min || 0} 
                                       max={param.max || 100} 
                                       step={param.step || 1} 
                                       value={param.value as number}
                                       onChange={(e) => {
                                           const val = parseFloat(e.target.value);
                                           store.updateParameter(param.name, val);
                                           if(handleParameterChange) handleParameterChange(param.name, val);
                                       }}
                                       className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                   />
                               )}
                               {param.type === 'boolean' && (
                                   <div className="flex items-center gap-2">
                                       <input 
                                           type="checkbox"
                                           checked={param.value as boolean}
                                           onChange={(e) => {
                                               const val = e.target.checked;
                                               store.updateParameter(param.name, val);
                                               if(handleParameterChange) handleParameterChange(param.name, val);
                                           }}
                                           className="accent-indigo-500"
                                       />
                                       <span className="text-xs text-slate-500">Enabled</span>
                                   </div>
                               )}
                               {param.type === 'color' && (
                                   <input 
                                       type="color"
                                       value={param.value as string}
                                       onChange={(e) => {
                                           const val = e.target.value;
                                           store.updateParameter(param.name, val);
                                           if(handleParameterChange) handleParameterChange(param.name, val);
                                       }}
                                       className="w-full h-6 bg-transparent rounded cursor-pointer"
                                   />
                               )}
                           </div>
                       ))}
                   </div>
               )}
           </div>
       )}

       {store.activeTab === 'sketch' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
               <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">2D Sketch Pad</h4>
               
               {/* Primitive Toolbar */}
               <div className="flex gap-2 mb-2">
                   <button onClick={handleAddRect} className="flex-1 bg-slate-800 text-[10px] text-slate-300 py-1 rounded hover:bg-slate-700 border border-slate-700" title="Add Rectangle">Rect</button>
                   <button onClick={handleAddCircle} className="flex-1 bg-slate-800 text-[10px] text-slate-300 py-1 rounded hover:bg-slate-700 border border-slate-700" title="Add Circle">Circle</button>
                   <button onClick={handleCloseLoop} disabled={sketchPoints.length < 3} className="flex-1 bg-indigo-900 text-[10px] text-indigo-300 py-1 rounded hover:bg-indigo-800 border border-indigo-700 disabled:opacity-50" title="Connect Last to First">Close Loop</button>
               </div>

               <div className="bg-slate-800 rounded border border-slate-700 overflow-hidden cursor-crosshair relative">
                   <canvas 
                       ref={canvasRef} 
                       width={220} 
                       height={220} 
                       onClick={handleCanvasClick}
                       onMouseMove={handleCanvasMouseMove}
                       onMouseLeave={() => setMousePos(null)}
                       className="w-full h-auto block"
                   />
                   <div className="absolute bottom-1 right-1 text-[9px] text-slate-500 bg-slate-900/50 px-1 rounded pointer-events-none">
                       Shift: Ortho | Click: Point
                   </div>
               </div>
               
               <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <input 
                           type="checkbox" 
                           checked={snapEnabled} 
                           onChange={(e) => setSnapEnabled(e.target.checked)}
                           className="accent-emerald-500 h-3 w-3"
                       />
                       <span className="text-xs text-slate-400">Snap Grid</span>
                   </div>
                   <button onClick={handleClearSketch} className="text-xs hover:text-white text-slate-400">Clear</button>
               </div>

               <div className="space-y-1">
                   <div className="flex justify-between text-xs text-slate-300">
                       <span>Extrude Height</span>
                       <span>{extrudeHeight}m</span>
                   </div>
                   <input 
                       type="range" min="0.1" max="10" step="0.1" 
                       value={extrudeHeight} 
                       onChange={(e) => setExtrudeHeight(parseFloat(e.target.value))}
                       className="w-full h-1 bg-slate-700 rounded-lg accent-emerald-500" 
                   />
               </div>
               <button 
                   onClick={handleExtrude}
                   disabled={sketchPoints.length < 3}
                   className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-bold shadow-lg shadow-emerald-500/20"
               >
                   Extrude Shape
               </button>
           </div>
       )}

       {store.activeTab === 'tools' && (
           <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto animate-fade-in space-y-4">
              {/* GIZMOS */}
              <div>
                  <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Gizmos & Measure</h4>
                  <div className="grid grid-cols-4 gap-2">
                      <button onClick={() => store.setGizmoMode('translate')} className={`p-2 rounded ${store.gizmoMode === 'translate' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Move"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                      <button onClick={() => store.setGizmoMode('rotate')} className={`p-2 rounded ${store.gizmoMode === 'rotate' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Rotate"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                      <button onClick={() => store.setGizmoMode('scale')} className={`p-2 rounded ${store.gizmoMode === 'scale' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Scale"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                      <button onClick={() => store.setGizmoMode('measure')} className={`p-2 rounded ${store.gizmoMode === 'measure' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Precise Measure"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg></button>
                  </div>
              </div>

              {/* MODELING PRIMITIVES */}
              <div className="pt-2 border-t border-slate-700">
                  <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Add Primitive</h4>
                  <div className="grid grid-cols-4 gap-2">
                      <button onClick={() => window.postMessage({ type: 'addPrimitive', primType: 'box' }, '*')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-xs flex flex-col items-center">Box</button>
                      <button onClick={() => window.postMessage({ type: 'addPrimitive', primType: 'cylinder' }, '*')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-xs flex flex-col items-center">Cyl</button>
                      <button onClick={() => window.postMessage({ type: 'addPrimitive', primType: 'sphere' }, '*')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-xs flex flex-col items-center">Sph</button>
                      <button onClick={() => window.postMessage({ type: 'addPrimitive', primType: 'plane' }, '*')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-xs flex flex-col items-center">Pln</button>
                  </div>
              </div>

              {/* BOOLEAN OPERATIONS */}
              <div className="pt-2 border-t border-slate-700">
                  <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Boolean (CSG)</h4>
                  {store.booleanOp ? (
                      <div className="bg-indigo-900/50 border border-indigo-500 rounded p-2 text-center animate-pulse">
                          <p className="text-xs text-indigo-200 font-bold mb-1">Select Tool Object</p>
                          <button onClick={() => { store.setBooleanOp(null); store.setBooleanTarget(null); }} className="text-[10px] bg-indigo-800 px-2 py-1 rounded hover:bg-indigo-700">Cancel Operation</button>
                      </div>
                  ) : (
                      <div className="flex gap-2">
                          <button onClick={() => handleBooleanClick('union')} className="flex-1 bg-slate-800 hover:bg-slate-700 p-2 rounded text-slate-300 text-xs border border-slate-700" title="Union (Combine)">
                              <div className="flex justify-center mb-1"><div className="w-3 h-3 rounded-full bg-slate-400 -mr-1"></div><div className="w-3 h-3 rounded-full bg-slate-400"></div></div>
                              Union
                          </button>
                          <button onClick={() => handleBooleanClick('subtract')} className="flex-1 bg-slate-800 hover:bg-slate-700 p-2 rounded text-slate-300 text-xs border border-slate-700" title="Subtract (Cut)">
                              <div className="flex justify-center mb-1"><div className="w-3 h-3 rounded-full bg-slate-400 -mr-1 z-10 border border-slate-800"></div><div className="w-3 h-3 rounded-full border border-slate-400"></div></div>
                              Sub
                          </button>
                          <button onClick={() => handleBooleanClick('intersect')} className="flex-1 bg-slate-800 hover:bg-slate-700 p-2 rounded text-slate-300 text-xs border border-slate-700" title="Intersect">
                              <div className="flex justify-center mb-1"><div className="w-3 h-3 rounded-full border border-slate-400 -mr-2"></div><div className="w-3 h-3 rounded-full border border-slate-400"></div></div>
                              Int
                          </button>
                      </div>
                  )}
              </div>

              {workspaceMode !== 'maker' && (
                  <div className="pt-2 border-t border-slate-700">
                    <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">CAD Modifiers (AI)</h4>
                    <div className="grid grid-cols-4 gap-2">
                        {CAD_TOOLS.map((tool) => (
                        <button key={tool.id} onClick={() => handleToolClick(tool.prompt)} className="aspect-square flex flex-col items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-600 hover:text-white transition-all bg-slate-800 border border-slate-700 hover:border-emerald-500" title={tool.label}>
                            {tool.icon}
                        </button>
                        ))}
                    </div>
                  </div>
              )}
              
              <div className="pt-2 border-t border-slate-700">
                  <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Mesh Tools</h4>
                  <div className="flex gap-2 mb-2">
                       <button onClick={() => window.postMessage({ type: 'repairMesh' }, '*')} className="flex-1 bg-slate-800 text-[10px] text-slate-300 py-1.5 rounded border border-slate-700 hover:bg-slate-700 flex items-center justify-center gap-1">
                          <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          Auto Repair
                       </button>
                  </div>
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

       {store.activeTab === 'hierarchy' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in flex flex-col max-h-[400px]">
              <div className="flex justify-between items-center">
                  <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Scene Graph</h4>
                  <button onClick={() => handleSelectObject && handleSelectObject(null)} className="text-[10px] text-slate-400 hover:text-white">Clear</button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                  {store.sceneGraph.length === 0 ? (
                      <div className="text-xs text-slate-500 italic p-2 text-center">No editable objects found.</div>
                  ) : (
                      store.sceneGraph.map((node) => (
                          <div 
                              key={node.id} 
                              onClick={() => handleSelectObject && handleSelectObject(node.id)}
                              className={`
                                  flex items-center justify-between p-2 rounded cursor-pointer text-xs
                                  ${node.selected ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50' : 'bg-slate-800/50 text-slate-300 border border-transparent hover:bg-slate-700'}
                              `}
                          >
                              <div className="flex items-center gap-2 truncate">
                                  <span className={`w-2 h-2 rounded-full ${node.visible ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                                  <span className="truncate">{node.name}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 uppercase">{node.type.replace('Mesh', '')}</span>
                          </div>
                      ))
                  )}
              </div>
           </div>
       )}

       {store.activeTab === 'bookmarks' && (
           <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md pointer-events-auto space-y-4 animate-fade-in">
                <div className="flex justify-between items-center">
                    <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Saved Views</h4>
                    <button onClick={handleAddBookmark} className="text-[10px] bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded border border-slate-700">
                        + Add View
                    </button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {store.bookmarks.length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center p-2">No bookmarks saved.</p>
                    ) : (
                        store.bookmarks.map((bm) => (
                            <div key={bm.id} className="flex items-center justify-between p-2 bg-slate-800 rounded group hover:bg-slate-750">
                                <button onClick={() => handleRestoreBookmark(bm)} className="text-xs text-slate-300 hover:text-white flex-1 text-left truncate">
                                    {bm.name}
                                </button>
                                <button onClick={() => store.removeBookmark(bm.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100">
                                    &times;
                                </button>
                            </div>
                        ))
                    )}
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
                   <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Performance</h4>
                   <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-300">Auto-LOD System</span>
                      <input type="checkbox" defaultChecked={true} onChange={(e) => window.postMessage({ type: 'setLOD', active: e.target.checked }, '*')} className="accent-emerald-500" />
                   </div>
                   <p className="text-[9px] text-slate-500">Automatically creates low-poly versions of imported meshes.</p>
              </div>
              <div className="pt-2 border-t border-slate-700">
                   <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Media</h4>
                   <button onClick={handleToggleRecording} className={`w-full py-2 rounded text-xs font-bold border flex items-center justify-center gap-2 ${store.isRecording ? 'bg-red-500/20 text-red-400 border-red-500 animate-pulse' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>
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
                      <input type="range" min="-5" max="5" step="0.1" value={store.clippingValue} onChange={(e) => { store.setClippingValue(parseFloat(e.target.value)); window.postMessage({ type: 'setClipping', value: parseFloat(e.target.value) }, '*'); }} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500" />
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
                       {store.showSupports ? 'Hide Supports' : 'Generate Supports'}
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
                   <button onClick={() => handleExport('3mf')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-cyan-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-cyan-400">3MF</span>
                           <span className="text-[10px] text-slate-500">3D Print Package</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                   </button>
                   <button onClick={() => handleExport('usdz')} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-blue-500 group transition-all">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-white group-hover:text-blue-400">USDZ</span>
                           <span className="text-[10px] text-slate-500">Apple AR Ready</span>
                       </div>
                       <svg className="w-5 h-5 text-slate-500 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                   </button>
                   <button onClick={() => alert("STEP export requires backend processing. This is a placeholder for future implementation.")} className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-slate-500 group transition-all opacity-70">
                       <div className="flex flex-col text-left">
                           <span className="text-sm font-bold text-slate-300 group-hover:text-white">STEP (Beta)</span>
                           <span className="text-[10px] text-slate-500">CAD Exchange</span>
                       </div>
                       <span className="text-[10px] bg-slate-700 px-2 py-1 rounded">Soon</span>
                   </button>
              </div>
           </div>
       )}
    </div>
  );
};
