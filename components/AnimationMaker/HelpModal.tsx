
import React from 'react';

export const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full p-8" onClick={e => e.stopPropagation()}>
         <div className="flex justify-between items-center mb-6">
             <h2 className="text-2xl font-bold text-white">Keyboard Shortcuts</h2>
             <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
         </div>
         
         <div className="grid grid-cols-2 gap-8">
             <div>
                 <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-3">Tools & Transform</h3>
                 <div className="space-y-2">
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Grab / Move</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">G</kbd></div>
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Rotate</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">R</kbd></div>
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Scale</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">S</kbd></div>
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Deselect Tool</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">Esc</kbd></div>
                 </div>
             </div>
             
             <div>
                 <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3">Camera Views</h3>
                 <div className="space-y-2">
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Front View</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">1</kbd></div>
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Side View</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">3</kbd></div>
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Top View</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">7</kbd></div>
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Reset View</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">0</kbd></div>
                 </div>
             </div>

             <div>
                 <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">Editor</h3>
                 <div className="space-y-2">
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Undo</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">Ctrl + Z</kbd></div>
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Redo</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">Ctrl + Y</kbd></div>
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Clear/Reset</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">Del</kbd></div>
                 </div>
             </div>

             <div>
                 <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-3">General</h3>
                 <div className="space-y-2">
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Command Palette</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">Cmd + K</kbd></div>
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Toggle Fullscreen</span> <kbd className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">Space</kbd></div>
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
};
