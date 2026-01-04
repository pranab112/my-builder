import React from 'react';
import { Button } from '../Button';
import { SavedProject } from './types';

interface DashboardProps {
  projects: SavedProject[];
  onStartCreation: () => void;
  onLoadProject: (p: SavedProject) => void;
  onDeleteProject: (e: React.MouseEvent, id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, onStartCreation, onLoadProject, onDeleteProject }) => {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">My Projects</h2>
          <p className="text-slate-400">Manage and continue your 3D engineering works.</p>
        </div>
        <Button onClick={onStartCreation}>
          + New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center">
           <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
             <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
             </svg>
           </div>
           <h3 className="text-xl font-medium text-white mb-2">No projects yet</h3>
           <Button variant="secondary" onClick={onStartCreation}>Create your first project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(p => (
            <div key={p.id} onClick={() => onLoadProject(p)} className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 p-6 rounded-2xl cursor-pointer transition-all group relative">
               <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">{p.name}</h3>
                  <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400 border border-slate-700">{p.category}</span>
               </div>
               <p className="text-slate-400 text-sm mb-4 line-clamp-2">{p.description}</p>
               <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Updated {new Date(p.date).toLocaleDateString()}</span>
                  <button 
                    onClick={(e) => onDeleteProject(e, p.id)}
                    className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors z-10"
                  >
                    Delete
                  </button>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
