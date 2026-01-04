import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ subtitle = "Ecom Image Designer" }) => {
  const { user, logout } = useAuth();

  return (
    <header className="w-full py-6 px-4 md:px-8 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20">
            P
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              ProShot AI
            </h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase transition-all duration-300">
              {subtitle}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex flex-col items-end text-xs font-medium text-slate-500">
                <span>Powered by Gemini 2.5</span>
                <span className="text-emerald-500/80">+ Robotics 1.5 Preview</span>
             </div>
             
             {user && (
                 <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-white">{user.name}</div>
                        <div className="text-[10px] text-slate-400">{user.email}</div>
                    </div>
                    <button 
                        onClick={logout}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Sign Out"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                 </div>
             )}
          </div>
        </div>
      </div>
    </header>
  );
};
