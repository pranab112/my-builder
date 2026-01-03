import React from 'react';
import { AspectRatio, GenerationMode } from '../types';

interface ControlsProps {
  prompt: string;
  setPrompt: (p: string) => void;
  mode: GenerationMode;
  setMode: (m: GenerationMode) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (r: AspectRatio) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hasImage: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  prompt,
  setPrompt,
  mode,
  setMode,
  aspectRatio,
  setAspectRatio,
  onGenerate,
  isGenerating,
  hasImage
}) => {
  
  const ratios = [
    { label: 'Square (1:1)', value: AspectRatio.SQUARE, icon: '▢' },
    { label: 'Portrait (3:4)', value: AspectRatio.PORTRAIT, icon: '▯' },
    { label: 'Landscape (4:3)', value: AspectRatio.LANDSCAPE, icon: '▭' },
    { label: 'Wide (16:9)', value: AspectRatio.WIDE, icon: '▭' },
    { label: 'Tall (9:16)', value: AspectRatio.TALL, icon: '▯' },
  ];

  return (
    <div className="flex flex-col gap-8">
      
      {/* Mode Selection */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-slate-700 text-xs flex items-center justify-center">2</span>
          Scene Configuration
        </h2>
        <div className="bg-slate-800 p-1 rounded-xl flex mb-4 border border-slate-700">
          <button
            onClick={() => setMode('auto')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
              ${mode === 'auto' 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Auto (AI Analysis)
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
              ${mode === 'manual' 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Manual Description
          </button>
        </div>

        {mode === 'manual' ? (
          <div className="animate-fade-in">
             <label className="block text-sm font-medium text-slate-400 mb-2">
              Describe the background & atmosphere
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A minimalist white marble podium with soft morning sunlight..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all h-32 resize-none"
            />
            <div className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['Minimalist Studio', 'Tropical Beach', 'Kitchen Counter', 'Luxury Dark Silk'].map((suggestion) => (
                    <button
                        key={suggestion}
                        onClick={() => setPrompt(suggestion)}
                        className="whitespace-nowrap px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs text-slate-300 transition-colors"
                    >
                        + {suggestion}
                    </button>
                ))}
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-6 text-center animate-fade-in">
             <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-3">
               <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
               </svg>
             </div>
             <h3 className="text-white font-medium mb-1">AI Scene Director</h3>
             <p className="text-slate-400 text-sm">
               The AI will analyze your product and automatically generate the perfect scene, lighting, and composition to showcase it.
             </p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-700 text-xs flex items-center justify-center">3</span>
            Output Size
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ratios.map((r) => (
            <button
              key={r.value}
              onClick={() => setAspectRatio(r.value)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200
                ${aspectRatio === r.value
                  ? 'bg-indigo-600/20 border-indigo-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }
              `}
            >
              <span className="text-2xl mb-1 opacity-50">{r.icon}</span>
              <span className="text-xs font-medium">{r.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};