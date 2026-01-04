
import React from 'react';

interface ViewCubeProps {
  onViewChange: (view: string) => void;
}

export const ViewCube: React.FC<ViewCubeProps> = ({ onViewChange }) => {
  return (
    <div className="absolute top-4 right-4 z-40 w-24 h-24 perspective-3d pointer-events-auto">
      {/* Container to hold the interactive faces */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* CSS-only Cube Representation for UI */}
        <div className="grid grid-cols-3 grid-rows-3 gap-1 w-16 h-16 transform rotate-45">
           {/* Top Left - Isometric */}
           <button 
             onClick={() => onViewChange('iso')} 
             className="bg-slate-700 hover:bg-emerald-500 rounded-sm shadow-sm transition-colors"
             title="Isometric"
           />
           {/* Top - Top View */}
           <button 
             onClick={() => onViewChange('top')} 
             className="bg-slate-800 hover:bg-emerald-500 rounded-sm shadow-sm text-[8px] font-bold text-slate-300 hover:text-white flex items-center justify-center transition-colors"
           >
             TOP
           </button>
           {/* Top Right */}
           <div className="bg-transparent" />
           
           {/* Left - Side View */}
           <button 
             onClick={() => onViewChange('side')} 
             className="bg-slate-800 hover:bg-emerald-500 rounded-sm shadow-sm text-[8px] font-bold text-slate-300 hover:text-white flex items-center justify-center transition-colors"
           >
             SIDE
           </button>
           {/* Center - Center/Front View */}
           <button 
             onClick={() => onViewChange('center')} 
             className="bg-slate-600 hover:bg-emerald-500 rounded-sm shadow-sm text-[8px] font-bold text-white flex items-center justify-center border border-slate-500 transition-colors"
           >
             CTR
           </button>
           {/* Right - Front View (Logic swap for better UX usually, or Right Side) */}
           <button 
             onClick={() => onViewChange('front')} 
             className="bg-slate-800 hover:bg-emerald-500 rounded-sm shadow-sm text-[8px] font-bold text-slate-300 hover:text-white flex items-center justify-center transition-colors"
           >
             FRNT
           </button>
           
           {/* Bottom Row */}
           <div className="bg-transparent" />
           <button 
             onClick={() => onViewChange('iso')} 
             className="bg-slate-700 hover:bg-emerald-500 rounded-sm shadow-sm transition-colors"
             title="Isometric"
           />
           <div className="bg-transparent" />
        </div>
      </div>
    </div>
  );
};
