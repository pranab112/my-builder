
import React, { useState } from 'react';
import { SavedProject, WorkspaceMode } from '../types';
import { useGlobalStore } from '../../../stores/globalStore';

interface BuilderHeaderProps {
  project: SavedProject;
  onBack: () => void;
  activeModeConfig: { label: string; icon: string };
  modeConfig: Record<string, any>;
}

export const BuilderHeader: React.FC<BuilderHeaderProps> = ({ project, onBack, activeModeConfig, modeConfig }) => {
  const { workspaceMode, setWorkspaceMode } = useGlobalStore();
  const [showModeSelector, setShowModeSelector] = useState(false);

  return (
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
            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in custom-scrollbar max-h-[80vh] overflow-y-auto">
              <div className="py-2">
                {Object.entries(modeConfig).map(([key, config]: [string, any]) => (
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
            </div>
          </>
        )}
      </div>
    </div>
  );
};
