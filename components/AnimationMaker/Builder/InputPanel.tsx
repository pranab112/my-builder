
import React, { useRef, useState } from 'react';
import { useBuilderStore } from '../../../stores/builderStore';
import { Button } from '../../Button';
import { ImageUpload } from '../../ImageUpload';

interface BuilderInputPanelProps {
  onGenerate: () => void;
  onEnhance: () => void;
  templates: { icon: string; label: string; prompt: string }[];
  suggestions: { label: string; text: string }[];
}

export const BuilderInputPanel: React.FC<BuilderInputPanelProps> = ({ onGenerate, onEnhance, templates, suggestions }) => {
  const store = useBuilderStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  // Local history state or from store if preferred, utilizing local for now as per original
  // But wait, the original had promptHistory. Let's make it internal or passed prop.
  // Ideally, valid history should be in store, but for simplicity let's stick to prompt history in parent or here.
  // I will implement a simple local history here for prompts typed.
  const [promptHistory, setPromptHistory] = useState<string[]>([]);

  const handleAppendPrompt = (text: string) => {
    const current = store.prompt.trim();
    const separator = current && !current.endsWith(' ') ? ' ' : '';
    const next = current ? `${current}${separator}${text}` : text;
    store.setPrompt(next);
    textareaRef.current?.focus();
  };

  const handleGenerateClick = () => {
      if(store.prompt.trim()) {
          setPromptHistory(prev => [store.prompt, ...prev.filter(p => p !== store.prompt)].slice(0, 10));
      }
      onGenerate();
  }

  return (
    <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm flex flex-col">
      <div className="flex flex-col gap-4">
        <div className="min-h-[120px]">
          <ImageUpload onImagesChange={store.setRefImages} selectedImages={store.refImages} compact={true} />
        </div>
        
        <div className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-end">
            <p className="text-sm text-slate-300 font-medium">{store.htmlCode ? "Refine your design:" : "Describe the object:"}</p>
            
            <div className="flex items-center gap-2">
              {promptHistory.length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                    History
                  </button>
                  {showHistory && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="p-2 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase">Recent Prompts</div>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {promptHistory.map((h, i) => (
                          <button 
                            key={i} 
                            onClick={() => { store.setPrompt(h); setShowHistory(false); }}
                            className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 border-b border-slate-800/50 last:border-0 truncate"
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {showHistory && <div className="fixed inset-0 z-40" onClick={() => setShowHistory(false)} />}
                </div>
              )}

              <button onClick={onEnhance} disabled={store.isEnhancing || !store.prompt.trim()} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 disabled:opacity-50 transition-colors">
                {store.isEnhancing ? <span className="animate-pulse">Enhancing...</span> : "✨ Enhance"}
              </button>
            </div>
          </div>
          
          <textarea
            ref={textareaRef}
            value={store.prompt}
            onChange={(e) => store.setPrompt(e.target.value)}
            placeholder="e.g. Create a phone stand with adjustable angle..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all h-24 resize-none font-mono text-sm"
          />
          
          {/* Suggestions */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide pt-1">
            <span className="text-xs text-slate-500 py-1 select-none">💡</span>
            {suggestions.map((s, i) => (
              <button 
                key={i}
                onClick={() => handleAppendPrompt(s.text)}
                className="whitespace-nowrap px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-slate-300 transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Templates */}
          <div className="mt-2 pt-2 border-t border-slate-800/50">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">📚 Templates</p>
            <div className="grid grid-cols-4 gap-2">
              {templates.map((t, i) => (
                <button
                  key={i}
                  onClick={() => store.setPrompt(t.prompt)}
                  className="flex flex-col items-center justify-center p-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl transition-all group"
                >
                  <span className="text-xl mb-1 group-hover:scale-110 transition-transform">{t.icon}</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-emerald-400">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Button onClick={handleGenerateClick} isLoading={store.isGenerating} disabled={!store.prompt.trim() && store.refImages.length === 0} className="flex-1 !bg-gradient-to-r !from-emerald-600 !to-teal-600 hover:!from-emerald-500 hover:!to-teal-500 !shadow-emerald-500/20">
          {store.isGenerating ? (store.htmlCode ? "Engineering..." : "Initializing...") : (store.htmlCode ? "Update Design" : "Generate CAD Model")}
        </Button>
      </div>
      {store.error && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-200 text-xs">{store.error}</div>}
    </div>
  );
};
