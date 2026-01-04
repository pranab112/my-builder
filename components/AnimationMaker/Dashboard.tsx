
import React, { useState, useRef } from 'react';
import { Button } from '../Button';
import { SavedProject } from './types';

interface DashboardProps {
  projects: SavedProject[];
  onStartCreation: () => void;
  onLoadProject: (p: SavedProject) => void;
  onDeleteProject: (e: React.MouseEvent, id: string) => void;
  onImport: (file: File) => void;
  onCreateFromTemplate: (template: { name: string, prompt: string, category: string }) => void;
}

const STARTER_TEMPLATES = [
  { id: 'vase', name: 'Twisted Vase', icon: '🏺', category: 'Decor', prompt: 'Create a parametric twisted vase using a lathe geometry with adjustable height, radius, and twist amount.' },
  { id: 'stand', name: 'Phone Stand', icon: '📱', category: 'Accessory', prompt: 'Create a phone stand with an adjustable viewing angle and a slot for a charging cable.' },
  { id: 'case', name: 'Rugged Case', icon: '🛡️', category: 'Protection', prompt: 'Create a rugged protective case for a generic device with reinforced corners and a pattern on the back.' },
  { id: 'hook', name: 'Wall Hook', icon: '🪝', category: 'Utility', prompt: 'Create a strong wall hook with countersunk screw holes and a rounded tip.' },
  { id: 'gear', name: 'Helical Gear', icon: '⚙️', category: 'Mechanical', prompt: 'Create a parametric helical gear with adjustable teeth count, module, and helix angle.' },
];

export const Dashboard: React.FC<DashboardProps> = ({ 
  projects, 
  onStartCreation, 
  onLoadProject, 
  onDeleteProject,
  onImport,
  onCreateFromTemplate
}) => {
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImport(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* HEADER SECTION */}
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
        <p className="text-slate-400">Manage your 3D assets, blueprints, and manufacturing files.</p>
      </div>

      {/* TOP ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* New Project */}
        <button 
          onClick={onStartCreation}
          className="group relative h-40 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 text-left shadow-lg transition-all hover:scale-[1.02] hover:shadow-emerald-500/20 overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform">
             <svg className="w-24 h-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v16m8-8H4" /></svg>
          </div>
          <div className="relative z-10 h-full flex flex-col justify-end">
             <h3 className="text-2xl font-bold text-white mb-1">+ New Project</h3>
             <p className="text-emerald-100 text-sm">Start from scratch with AI</p>
          </div>
        </button>

        {/* Import */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="group relative h-40 bg-slate-800 border border-slate-700 rounded-3xl p-6 text-left shadow-lg transition-all hover:bg-slate-750 hover:border-emerald-500/50 hover:scale-[1.02] overflow-hidden"
        >
           <input type="file" ref={fileInputRef} className="hidden" accept=".stl,.obj,.gltf,.glb" onChange={handleFileChange} />
           <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
             <svg className="w-24 h-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </div>
          <div className="relative z-10 h-full flex flex-col justify-end">
             <h3 className="text-2xl font-bold text-white mb-1">📥 Import File</h3>
             <p className="text-slate-400 text-sm">Analyze existing 3D models</p>
          </div>
        </button>

        {/* Templates */}
        <div className="group relative h-40 bg-slate-800 border border-slate-700 rounded-3xl p-6 text-left shadow-lg overflow-hidden">
           <div className="absolute top-0 right-0 p-6 opacity-10">
             <svg className="w-24 h-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <div className="relative z-10 h-full flex flex-col justify-between">
             <div>
                <h3 className="text-2xl font-bold text-white mb-1">📚 Templates</h3>
                <p className="text-slate-400 text-sm">Component Library</p>
             </div>
             <div className="flex -space-x-2 overflow-hidden py-1">
                {STARTER_TEMPLATES.slice(0,4).map((t, i) => (
                    <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-800 bg-slate-700 flex items-center justify-center text-xs shadow-md">
                        {t.icon}
                    </div>
                ))}
                <div className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-800 bg-slate-700 flex items-center justify-center text-[10px] text-slate-300 shadow-md">
                    +{STARTER_TEMPLATES.length - 4}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* STARTER TEMPLATES */}
      <div className="mb-12">
         <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Quick Start</h4>
         <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
             {STARTER_TEMPLATES.map((t) => (
                 <button 
                    key={t.id}
                    onClick={() => onCreateFromTemplate(t)}
                    className="flex flex-col items-center justify-center p-4 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-2xl transition-all group"
                 >
                     <span className="text-3xl mb-3 group-hover:scale-110 transition-transform">{t.icon}</span>
                     <span className="font-semibold text-slate-200 text-sm">{t.name}</span>
                     <span className="text-[10px] text-slate-500 mt-1">{t.category}</span>
                 </button>
             ))}
         </div>
      </div>

      {/* RECENT PROJECTS */}
      <div>
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-6 gap-4">
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Recent Projects</h4>
            <div className="relative w-full md:w-64">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                    type="text" 
                    placeholder="Search projects..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-slate-600 transition-colors"
                />
            </div>
        </div>

        {filteredProjects.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800">
                <p className="text-slate-500">No projects found matching your search.</p>
                {projects.length === 0 && <Button variant="secondary" onClick={onStartCreation} className="mt-4">Create your first project</Button>}
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map(p => (
                    <div key={p.id} onClick={() => onLoadProject(p)} className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 p-6 rounded-2xl cursor-pointer transition-all group relative">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors truncate pr-4">{p.name}</h3>
                            <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400 border border-slate-700 whitespace-nowrap">{p.category}</span>
                        </div>
                        <p className="text-slate-400 text-sm mb-4 line-clamp-2 h-10">{p.description}</p>
                        <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-700/50 pt-3">
                            <span>{new Date(p.date).toLocaleDateString()}</span>
                            <button 
                                onClick={(e) => onDeleteProject(e, p.id)}
                                className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors z-10"
                                title="Delete Project"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};
