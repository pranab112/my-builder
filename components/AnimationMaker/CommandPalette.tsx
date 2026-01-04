
import React, { useState, useEffect, useRef } from 'react';
import { useBuilderStore } from '../../stores/builderStore';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  category: string;
}

export const CommandPalette: React.FC<{ 
  onClose: () => void; 
  onViewChange: (v: string) => void;
  onExport: (f: string) => void; 
}> = ({ onClose, onViewChange, onExport }) => {
  const store = useBuilderStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: 'undo', label: 'Undo Change', shortcut: 'Ctrl+Z', action: store.undo, category: 'Edit' },
    { id: 'redo', label: 'Redo Change', shortcut: 'Ctrl+Y', action: store.redo, category: 'Edit' },
    { id: 'grid', label: 'Toggle Grid', action: store.toggleGrid, category: 'View' },
    { id: 'fullscreen', label: 'Toggle Fullscreen', shortcut: 'Space', action: store.toggleFullScreen, category: 'View' },
    { id: 'gizmo-move', label: 'Tool: Move/Grab', shortcut: 'G', action: () => store.setGizmoMode('translate'), category: 'Tools' },
    { id: 'gizmo-rotate', label: 'Tool: Rotate', shortcut: 'R', action: () => store.setGizmoMode('rotate'), category: 'Tools' },
    { id: 'gizmo-scale', label: 'Tool: Scale', shortcut: 'S', action: () => store.setGizmoMode('scale'), category: 'Tools' },
    { id: 'view-top', label: 'View: Top', shortcut: '7', action: () => onViewChange('top'), category: 'Camera' },
    { id: 'view-front', label: 'View: Front', shortcut: '1', action: () => onViewChange('front'), category: 'Camera' },
    { id: 'view-side', label: 'View: Side', shortcut: '3', action: () => onViewChange('side'), category: 'Camera' },
    { id: 'view-iso', label: 'View: Isometric', action: () => onViewChange('iso'), category: 'Camera' },
    { id: 'export-stl', label: 'Export STL', action: () => onExport('stl'), category: 'Export' },
    { id: 'export-glb', label: 'Export GLB', action: () => onExport('gltf'), category: 'Export' },
    { id: 'help', label: 'Keyboard Shortcuts', shortcut: '?', action: () => store.setHelpOpen(true), category: 'Help' },
  ];

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedIndex, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in ring-1 ring-white/10">
        <div className="flex items-center gap-3 p-4 border-b border-slate-800">
           <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           <input
             ref={inputRef}
             className="flex-1 bg-transparent border-none outline-none text-white placeholder-slate-500"
             placeholder="Type a command..."
             value={query}
             onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
           />
           <button onClick={onClose} className="px-2 py-1 text-xs bg-slate-800 rounded text-slate-400">ESC</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
           {filtered.length === 0 ? (
               <div className="p-4 text-center text-slate-500 text-sm">No commands found.</div>
           ) : (
               filtered.map((cmd, idx) => (
                   <button
                     key={cmd.id}
                     onClick={() => { cmd.action(); onClose(); }}
                     className={`w-full text-left px-4 py-3 flex items-center justify-between border-l-2 transition-colors
                       ${idx === selectedIndex ? 'bg-indigo-600/10 border-indigo-500' : 'bg-transparent border-transparent hover:bg-slate-800'}
                     `}
                   >
                       <div className="flex items-center gap-3">
                           <span className={`text-xs px-1.5 py-0.5 rounded ${idx === selectedIndex ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}>{cmd.category}</span>
                           <span className={idx === selectedIndex ? 'text-white' : 'text-slate-300'}>{cmd.label}</span>
                       </div>
                       {cmd.shortcut && (
                           <span className="text-xs font-mono text-slate-500 bg-slate-800/50 px-2 py-1 rounded">{cmd.shortcut}</span>
                       )}
                   </button>
               ))
           )}
        </div>
        <div className="p-2 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between px-4">
            <span>Use ↑↓ to navigate</span>
            <span>↵ to select</span>
        </div>
      </div>
    </div>
  );
};
