
import React, { useState } from 'react';
import { Button } from '../Button';
import { suggestProjectCategories, CategorySuggestion } from '../../services/geminiService';
import { WorkspaceMode } from './types';

interface WizardProps {
  onCancel: () => void;
  onFinalize: (name: string, desc: string, category: string, mode: WorkspaceMode) => void;
}

export const Wizard: React.FC<WizardProps> = ({ onCancel, onFinalize }) => {
  const [step, setStep] = useState<'mode' | 'details' | 'category'>('mode');
  const [details, setDetails] = useState({ name: '', desc: '' });
  const [selectedMode, setSelectedMode] = useState<WorkspaceMode>('designer');
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleModeSelect = (mode: WorkspaceMode) => {
      setSelectedMode(mode);
      setStep('details');
  };

  const handleAnalyze = async () => {
    if (!details.desc.trim()) return;
    setIsAnalyzing(true);
    try {
      const cats = await suggestProjectCategories(details.desc);
      setSuggestions(cats);
      setStep('category');
    } catch (e) {
      // Fallback
      setSuggestions([{ title: "General", description: "Standard project" }]);
      setStep('category');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const modes: { id: WorkspaceMode, icon: string, title: string, desc: string, color: string }[] = [
    { id: 'maker', icon: '🖨️', title: '3D Printing', desc: 'Watertight meshes for physical printing.', color: 'hover:border-emerald-500 hover:bg-emerald-500/10' },
    { id: 'designer', icon: '🎨', title: 'Product Design', desc: 'High-fidelity visuals for marketing.', color: 'hover:border-indigo-500 hover:bg-indigo-500/10' },
    { id: 'engineer', icon: '⚙️', title: 'Engineering', desc: 'Precision parts with tolerances.', color: 'hover:border-blue-500 hover:bg-blue-500/10' },
    { id: 'game_dev', icon: '🎮', title: 'Game Assets', desc: 'Low-poly optimized for engines.', color: 'hover:border-rose-500 hover:bg-rose-500/10' },
    { id: 'architect', icon: '🏛️', title: 'Architecture', desc: 'Buildings, interiors, and spaces.', color: 'hover:border-amber-500 hover:bg-amber-500/10' }
  ];

  if (step === 'mode') {
      return (
        <div className="max-w-2xl mx-auto py-12">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <span className="text-indigo-400 text-xs font-bold tracking-wider uppercase">Step 1 of 3</span>
                        <h2 className="text-2xl font-bold text-white mt-1">Select Workflow</h2>
                    </div>
                    <button onClick={onCancel} className="text-slate-500 hover:text-white">Cancel</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {modes.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => handleModeSelect(opt.id)}
                            className={`
                                group relative p-4 rounded-2xl bg-slate-800/50 border border-slate-700 transition-all duration-300 text-left
                                ${opt.color} hover:shadow-xl hover:-translate-y-1 hover:bg-slate-800
                            `}
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-2xl bg-slate-900 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-800 group-hover:scale-110 transition-transform">{opt.icon}</span>
                                <div>
                                    <h3 className="text-base font-bold text-white mb-0.5 group-hover:text-white transition-colors">{opt.title}</h3>
                                    <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">{opt.desc}</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      );
  }

  if (step === 'details') {
    return (
      <div className="max-w-xl mx-auto py-12">
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
            <div className="mb-6">
                <span className="text-indigo-400 text-xs font-bold tracking-wider uppercase">Step 2 of 3</span>
                <h2 className="text-2xl font-bold text-white mt-1">Project Details</h2>
            </div>
            <div className="space-y-4">
                <input 
                    type="text" 
                    value={details.name}
                    onChange={e => setDetails(prev => ({...prev, name: e.target.value}))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
                    placeholder="Project Name"
                />
                <textarea 
                    value={details.desc}
                    onChange={e => setDetails(prev => ({...prev, desc: e.target.value}))}
                    className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none resize-none"
                    placeholder="Describe what you want to build..."
                />
                <div className="flex gap-3 pt-4">
                    <Button variant="secondary" onClick={() => setStep('mode')}>Back</Button>
                    <Button onClick={handleAnalyze} isLoading={isAnalyzing} disabled={!details.name || !details.desc} className="flex-1">Next: Analyze</Button>
                </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-12">
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
            <div className="mb-6">
                <span className="text-indigo-400 text-xs font-bold tracking-wider uppercase">Step 3 of 3</span>
                <h2 className="text-2xl font-bold text-white mt-1">Select Strategy</h2>
            </div>
            <div className="grid gap-3 mb-6">
                {suggestions.map((cat, idx) => (
                    <button key={idx} onClick={() => onFinalize(details.name, details.desc, cat.title, selectedMode)} className="p-4 bg-slate-800 border border-slate-700 hover:border-indigo-500 rounded-xl text-left text-white group hover:bg-slate-700 transition-all">
                        <div className="font-bold text-sm mb-1 group-hover:text-indigo-300">{cat.title}</div>
                        <div className="text-xs text-slate-400">{cat.description}</div>
                    </button>
                ))}
            </div>
            <Button variant="secondary" className="w-full" onClick={() => setStep('details')}>Back</Button>
        </div>
    </div>
  );
};
