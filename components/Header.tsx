import React from 'react';

interface HeaderProps {
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ subtitle = "Ecom Image Designer" }) => {
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
        <div className="hidden sm:block text-sm text-slate-500">
          Powered by Gemini 2.5
        </div>
      </div>
    </header>
  );
};